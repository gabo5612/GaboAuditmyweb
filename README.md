# GaboAuditmyweb

## Architecture

[`docs/architecture.html`](docs/architecture.html) is an interactive map of this system: components,
trust boundaries, and the exact routes between them. Open the file in a browser — it is a
single self-contained page with no server and no network calls, carrying dark and light
themes, node search, relationship tracing and three guided views.

Live: <https://gabriel-arias-portfolio.vercel.app/architecture/gaboauditmyweb.html>

The typed source is [`docs/architecture.json`](docs/architecture.json). The map is rendered and checked from
it by [archify](https://github.com/tt-a1i/archify) (MIT, by tt-a1i) — a third-party tool, not
part of this project:

```bash
node <archify>/bin/archify.mjs deliver architecture \
  docs/architecture.json docs/architecture.html --quality showcase
```

That command refuses to write the page unless nine layout checks pass with zero composition
errors: no edge crossing an unrelated node, no two relationships sharing a corridor, no
label masking a route. Edit the JSON, re-run it, and the checks decide.
