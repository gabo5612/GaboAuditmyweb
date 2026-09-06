# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A three-page marketing site for Gabriel Arias, a Shopify performance and technical-SEO consultant. Repo `gabo5612/GaboAuditmyweb`. It replaces an older React portfolio — the repositioning dropped the experience timeline, skills grid and personal projects in favour of two service offers, sold separately.

Two separate things live here: the public marketing site, and `audit-engine/`, the internal tooling that produces the audit the site sells.

## Commands

The site has no build step. `audit-engine/` has a test suite (`node:test`,
no dependencies): the network is intercepted at `fetch`, so the collectors
run their real code paths against recorded PSI and CrUX payloads.

```bash
python3 -m http.server 8000     # serve the site from source; file:// works too
node build.js --check           # minify into dist/ and prove it renders the same

cd audit-engine
npm test                        # node:test, nothing to install
export PAGESPEED_API_KEY=...    # without it PSI returns 429 immediately
node bin/audit.js tienda.com --competidores a.com,b.com   # fase 0, velocidad
node bin/seo.js tienda.com                                # fase 0, SEO — sin API key
node bin/batch.js queue.csv --out auditorias/             # fase 2
node bin/batch.js queue.csv --seo --out auditorias-seo/   # fase 2, SEO
node bin/report.js auditorias/x.json analisis/x.json --out informes/
```

`bin/report.js` picks the speed or SEO template from the audit's `tipo`
field; there is no second command and no flag to remember.

To exercise the report template without spending PSI quota, render the fixtures:
`node bin/report.js fixtures/ejemplo.audit.json fixtures/ejemplo.analysis.json --out /tmp/r`.

## Architecture — the site

Three pages, one shared stylesheet and two shared scripts. No build step.

| File | Role |
|---|---|
| `index.html` | The hub: both tracks side by side, the audit anatomy, process, FAQ. |
| `speed.html` | The speed sprint: filmstrip, revenue calculator, three-week plan, pricing. |
| `seo.html` | The SEO sprint: crawler-read demo, the 22 checks, four-week plan, pricing. |
| `assets/styles.css` | Design tokens in `:root`, then BEM-ish component classes. |
| `assets/i18n.js` | Language detection and the Spanish dictionary for all three pages. |
| `assets/main.js` | Three IIFEs: sticky header, load filmstrip, revenue calculator. |

**Two tracks, sold separately.** Speed and technical SEO are separate 30-day
sprints with separate guarantees (`PageSpeed 85+` vs `every failed check
green`). Never blur them, never offer a bundle: the copy says explicitly that
running both in one month would force cutting one short, and then neither
guarantee is defensible.

The hub carries a compact filmstrip; the full one with its readout and the
calculator live on `speed.html`. `main.js` guards every hook, so the same file
serves all three pages and does nothing on the one that lacks a given control.

**The SEO template switch is CSS, not JS.** `seo.html`'s crawler-read demo is a
radio group plus sibling selectors, so it works with `main.js` blocked exactly
as it does with it — same reasoning as the FAQ's native `<details>`. Do not
convert it to a script.

**Source is what you edit; `dist/` is what you deploy.** `build.js` minifies
the three pages and the three assets with no dependencies — about 17% off the
raw bytes, 5 KB off the whole home page once gzip has had its turn. It is not
a bundler and does not rewrite code: it strips comments and collapses
whitespace, nothing else.

Three things it is deliberately careful about, each of which broke the site
while it was being written:

- CSS comments are removed *before* strings are set aside. The other order
  lets an apostrophe inside a prose comment open a string that swallows every
  rule until the next apostrophe.
- `clamp()` / `calc()` are left untouched inside: their `+` and `−` require
  the surrounding spaces, and without them the whole declaration is dropped.
- Whitespace between tags is *collapsed to one space, never removed*. Between
  two inline elements that gap is painted, and deleting it runs the words
  together. The bytes this leaves behind are bytes gzip takes anyway.

`node build.js --check` compares source against `dist/` — text, per-gap
whitespace, `data-i18n` keys, `data-*` hooks, ids and hrefs — and refuses to
pass if any of them moved. A silent minifier bug looks exactly like a working
site until someone reads the page.

`vercel.json` makes that the deploy: build command `node build.js --check`,
output `dist`. Font filenames get a content hash in `dist/` (`sans.<hash>.woff2`)
and the CSS `url()` and the preload `href`s are rewritten to match — that hash
is the only thing that makes the one-year `immutable` header honest, since
otherwise re-subsetting the fonts would leave returning visitors on the old
glyphs for a year. Without it Vercel serves the repository root, which is the
unminified source — that is exactly what happened on the first deploy, and
nothing in the site looks wrong when it does. Fonts get a one-year immutable
cache; the other assets are unhashed, so they get an hour and revalidate.
`cleanUrls` is off on purpose: the internal links are `speed.html`, and it
would add a 308 to every one of them.

Two things about `vercel.json` that cost a deploy each to learn:

- **It is validated against a strict schema.** An unknown key — a `_comment`,
  say — is not ignored, it fails the build, and the site keeps serving the
  previous deploy while looking perfectly fine. Any explanation goes here, not
  in the file.
- **Every matching header rule applies and the last one wins.** `/assets/(.*)`
  has to come *before* `/assets/fonts/(.*)`, or the short cache overwrites the
  immutable one.

**No framework, deliberately.** The site's pitch is page speed and its hero is a PageSpeed gauge, so shipping a bundle would undercut the product. Keep it dependency-free.

**Zero external requests, fonts included.** Google Fonts cost two extra
origins *in series* — the stylesheet on `fonts.googleapis.com` has to arrive
and parse before the first request to `fonts.gstatic.com` can start, and each
pays its own DNS + TCP + TLS. That chain was blocking first paint by ~800 ms
on a throttled phone. The fonts now live in `assets/fonts/`, subset to the
characters these three pages actually use: 55 KB in three files, fewer bytes
than Google sent and no chain. `sans.woff2` and `mono-400.woff2` are
preloaded — they are what the first screen needs.

Three things about that subset:

- **Three files, not six.** IBM Plex Sans is variable, so one file covers
  400–600. Mono is only ever used at 400 and 600; the single 500 rule
  (`.btn--secondary`) is sans.
- **`tnum` is retained deliberately.** Rule 01 of the design system puts every
  score, second and price in mono with tabular figures. Drop that feature and
  the digits stop lining up the moment a value changes.
- **`▲ ● ■ ◆` and the arrows come from the system font.** IBM Plex has them in
  no subset, so they always did, Google Fonts included — this is not a
  regression from the subsetting. `assets/fonts/cobertura.json` records which
  codepoints are in the fonts and which fall back, and `build.js` warns when
  new copy uses a character in neither. That warning matters because the
  failure is silent: one letter quietly changes typeface and nothing breaks.

**JS only refines.** Every section is legible and usable with `main.js` blocked: the filmstrip renders a valid mid-load state from inline `opacity` attributes, the calculator ships a correct default result in the HTML, and the FAQ is native `<details>`. Static markup and the JS initial render must agree — at the default scrubber value of `30` (3.0s) that means before-header visible, before-hero/grid hidden, all after-frames visible. Never introduce markup that only becomes correct after JS runs.

JS reads the DOM through `data-*` hooks (`data-scrub`, `data-leak`, `data-frame="bHero"`, …), never through class names. Classes are for styling; renaming one must not break behaviour.

**English is the source of truth, Spanish is a layer.** The page ships fully
written in English; `assets/i18n.js` swaps in Spanish over it, keyed by
`data-i18n` (and `-aria`, `-content`, `-href` for attributes). Consequences
worth keeping in mind:

- A key missing from the Spanish dictionary falls back to whatever the markup
  says, so a half-translated page degrades to English, never to blanks.
- Adding copy means adding the attribute *and* the key. `node -e` over both
  files is the check: every `data-i18n*` value across the three pages must
  exist in `ES`, and nothing in `ES` should be unreachable.
- Strings assembled in JS (the leak formula, the leak CTA) live in `main.js`
  in English as the fallback argument to `i18n.t()`, with `{placeholders}`
  the dictionary reuses verbatim.
- Numbers go through `i18n.num` / `i18n.money`, so the same figure reads
  `$34,000` in English and `$34.000` in Spanish — matching `money.js`, which
  already formats per locale. The amounts themselves never change.
- The switch in the header only overrides the guess; order is `?lang=`, then
  the stored choice, then `navigator.languages`, then English. It is a pair
  of real `?lang=` links, so it still works if the click handler never binds.
- The English render must stay byte-identical to the static markup, the
  filmstrip clock and leak formula included. That is the no-JS invariant
  above, and it is the reason English is not itself a dictionary.

Not translated on purpose: the brand name, the plan prices, `Milliseconds
Make Millions` (a report title), the schema type names a client will see in
their own HTML (`Product`, `ProductGroup`, `BreadcrumbList`, `ItemList`,
`Organization`), the check ids, and the mono placeholders. Single URL per
page, so there are no `hreflang` tags — add them alongside the real domain if
the Spanish version ever needs to be indexed separately.

## Architecture — audit-engine

Zero dependencies, Node 18+, ESM. Implements phases 0–2 of
`workflow-auditoria-automatizada.md` (the spec doc, kept outside this repo).
Its code and comments are in Spanish, matching the spec and its only user.
The site is written in English — its buyers are US/UK/CA/AU — and serves
Spanish to Spanish-speaking visitors through `assets/i18n.js`. Full operating
manual in `audit-engine/README.md`.

Pipeline: `bin/audit.js` → raw JSON → **you paste it into Claude with
`analysis/prompt.md`** → analysis JSON → `bin/report.js` → self-contained
HTML report. `bin/batch.js` runs the first step over a CSV; the GitHub
Actions workflow runs the batch nightly.

**Two audits, two pipelines, shared plumbing.** The SEO side mirrors the
speed side file for file — `bin/seo.js` → `src/seo-collect.js` →
`src/seo.js` → `analysis/seo-prompt.md` + `seo-schema.json` →
`validarAnalisisSeo` → `report/seo-template.js` — and reuses `page.js`,
`infra.js`, `util.js` and the report CSS. A prospect picks one; they are
sold separately.

The SEO audit runs 22 checks in four groups (6 crawl/index · 4 duplicates ·
5 metadata · 7 rich results), needs no API key, and costs six extra HTTP
requests. **The total is always 22**: a check that cannot be run is emitted
as `no_medible`, never dropped, because the site publishes the number 22.

Two rules specific to it, both about not inventing:

- **No money, ever.** Revenue lost to SEO needs search volume and CTR by
  position; neither is in the input. The headline is a count of failed
  checks. `validarAnalisisSeo` rejects an analysis whose findings mention
  currency, or promise positions or traffic.
- **Findings are anchored to checks.** Every finding must cite the `id` of a
  check whose state is `falla` or `aviso`. A finding about a problem the
  audit did not measure is rejected, not warned about.

False positives are the failure mode that ends the sale in the first
sentence, so two parsing rules are load-bearing: robots.txt is evaluated
**only** for the `User-agent: *` group (Shopify's default file ends with
`User-agent: Nutch` + `Disallow: /`), and `alt=""` is correct on decorative
images — only a missing `alt` attribute counts. `ProductGroup` counts as
product schema alongside `Product`.

The guarantee differs by track and must not be blurred: speed is
`PageSpeed 85+ or refund`; SEO is `every failed check green, or refund`.
Rankings are never guaranteed, and `que_no_promete` is a required field in
the SEO analysis for exactly that reason.

Four invariants that are load-bearing, not stylistic:

- **`src/money.js` mirrors `assets/main.js`.** Same target, same coefficient,
  same cap. The number in a client's report and the number in the site's
  calculator must match or the whole thing reads as improvised. Change one,
  change both.
- **A number with no source is not published.** Collection records
  `fuente` + `fecha` alongside every figure; `validate.js` rejects an
  analysis whose finding lacks evidence, and warns about figures that appear
  in the prose but not in the collected data.
- **Missing data fails the audit rather than filling the gap.** If mobile PSI
  fails, `collect.js` returns `estado: 'fallida'` and `report.js` refuses to
  render. Everything unmeasurable goes into `datos_faltantes`, which the
  report prints.
- **Nothing reaches a prospect without human review.** No sending code exists
  here, deliberately — that is phase 3, and the spec says not to build it
  until this one has produced a booked call.

Detection has honest limits, recorded in the output as `alcance` fields:
apps injected by a Tag Manager are invisible, `@font-face` is only read from
inline CSS, and competitors are supplied by hand because guessing them would
produce false comparisons.

`queue.csv`, `auditorias/`, `informes/` and `analisis/` are gitignored — they
hold prospect emails and third-party store data.

## Design system

Canonical source is the Claude Design project `5cae3bfa-7493-4859-82c8-ca64d6e9d52d` (`Design System · Gabriel Arias.dc.html`, plus `Home · Gabriel Arias.dc.html` which this page implements). Those files are `.dc.html` components — a `<x-dc>` template with `{{ }}` bindings and a `DCLogic` class — not runnable web pages. Port them; do not copy the runtime.

Four rules from the system that outrank visual preference:

1. **Data is mono.** Every score, second, percentage and price uses `--font-mono` with `font-variant-numeric: tabular-nums`. The same number set in sans reads as a marketing promise.
2. **State is never colour alone.** Every status badge carries an icon (`▲`, `●`, `■`) plus a text label — amber and red are near-identical under deuteranopia.
3. **Before is red, after is green.** Fixed, never assigned to an arbitrary series. Beyond two series the order is `--brand` → `--status-warn` → `--data-neutral` → `--status-bad`.
4. **Provenance is mandatory.** Source and date under every figure. No source, no number — the component renders an em-dash empty state instead.

Dark only. `color-scheme: dark` is set and there is no light palette; do not add `prefers-color-scheme` branches.

## Unpublished placeholders

The page ships several deliberate empty states, each marked in the UI with an amber `▲` badge. These are not bugs and must not be filled with invented values:

- PageSpeed gauge — awaits a real build-time fetch from the PageSpeed Insights API, published with a link to the public report.
- The three stat cards, and the case-study before/after bars — awaiting figures verified against primary sources.
- Case study slot 02 — needs client permission, both captures, and both dates.
- Client logos column.

FAQ answers are marked `Placeholder.` in their copy and need review before
launch — except `faq.a2`, which carries the real 50-day answer.

**Prices are set, in USD.** Speed sprint `$2,750`, SEO sprint `$2,400`,
retainer `$1,500/mo`. Both tracks back to back are `$5,150` over 50 days —
three weeks of speed then four of SEO, which is 49 days of actual work, so
neither is compressed and both guarantees survive. There is no bundle
discount, deliberately: a discount for combining them would argue against the
reason the site gives for not combining them. USD because the target market is
US/UK/CA/AU; invoicing stays in EUR.

**The audit CTAs stay `mailto:`** — one per track, with Spanish subject and
body under `cta.speedMailto` / `cta.seoMailto`. They are not a booking, and
turning them into one would contradict the promise they make (`cta.lede`:
"arrives without a call attached").

Booking is the secondary option, and it is a plain link to
`cal.com/gabriel-arias-dev/audit`, never an embed: the Cal.com script would be a
third-party request on the page whose argument is speed, and the site makes a
point of having none. The primary place the call is offered is the end of the
audit report, via `bin/report.js --cal` — after the prospect has the free
audit and its giveaway quick win in hand. `report/template.js` renders nothing
when the flag is absent, so the report is correct either way.

Two placeholders are specific to the split: the hub's dual panel shows both
`—` for PageSpeed and `—/22` for SEO checks, and each track has one empty case
study slot.
