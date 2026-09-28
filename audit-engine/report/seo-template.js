/* Etapa ④ SEO — El informe.

   Mismas reglas que el de velocidad: un solo archivo HTML, autocontenido,
   sin una sola petición externa. Comparte los estilos con él a propósito;
   los dos informes tienen que parecer del mismo sitio.

   Diferencia de fondo: aquí el titular no es dinero, es un recuento. Y
   debajo va la lista entera de las 22 comprobaciones, incluidas las que
   pasan. Enseñar lo que está bien es lo que hace creíble lo que está mal,
   y además el cliente puede verificar cualquier fila desde su navegador.  */

import { CSS } from './template.js';

const T = {
  en: {
    title: 'Technical SEO audit',
    for: 'Prepared for',
    measured: 'Measured',
    headline: 'Checks failed',
    of: 'of',
    checked: 'checks run',
    health: 'Passing',
    groups: {
      indexabilidad: 'Crawling & indexing',
      duplicados: 'Duplicate content',
      metadatos: 'Page metadata',
      enriquecidos: 'Rich results & AI search',
    },
    findings: 'What I found',
    findingsIntro: 'Ordered by impact, not by how easy they are to fix. Every one of them points at a check below that you can run yourself.',
    evidence: 'Evidence',
    whatIWouldDo: 'What I would do',
    verify: 'How you verify it',
    impact: 'Impact',
    effort: 'Effort',
    hours: 'h',
    checklist: 'Every check, including the ones you pass',
    checklistIntro: 'Twenty-two checks against your home page, one product page and one collection page. Run any of them yourself — that is the point.',
    quickWin: 'Fix this one yourself, today',
    quickWinNote: 'No charge, no strings. You do not need me for this one.',
    expected: 'Expected result',
    noDevNeeded: 'No developer needed',
    devNeeded: 'Needs a developer',
    plan: 'The four-week plan',
    planIntro: 'This is exactly the scope of the SEO sprint. The fourth week is not new work: it is the re-crawl, because a fix nobody has crawled again is deployed, not finished.',
    week: 'Week',
    result: 'Expected result',
    verifyWeek: 'Verified by',
    notPromised: 'What this does not promise',
    ifNothing: 'If nothing changes',
    walkthrough: 'The three-minute walkthrough',
    cta: 'Book 20 minutes',
    ctaNote: 'No pitch deck. We look at your checks together and you decide.',
    missing: 'What this audit could not measure',
    missingNote: 'Listed so you know exactly where the gaps are. A fact that is not here was not measured, and I will not guess at it.',
    confidence: 'Confidence',
    theme: 'Theme',
    print: 'Print',
    high: 'high', medium: 'medium', low: 'low',
    estados: { pasa: 'pass', falla: 'fail', aviso: 'warning', no_aplica: 'not applicable', no_medible: 'not measurable' },
    unmeasured: 'not measured',
  },
  es: {
    title: 'Auditoría de SEO técnico',
    for: 'Preparado para',
    measured: 'Medido el',
    headline: 'Comprobaciones fallidas',
    of: 'de',
    checked: 'comprobaciones hechas',
    health: 'Correctas',
    groups: {
      indexabilidad: 'Rastreo e indexación',
      duplicados: 'Contenido duplicado',
      metadatos: 'Metadatos de página',
      enriquecidos: 'Resultados enriquecidos y buscadores con IA',
    },
    findings: 'Lo que he encontrado',
    findingsIntro: 'Ordenado por impacto, no por lo fácil que es de arreglar. Cada punto señala una comprobación de la lista de abajo que puedes repetir tú.',
    evidence: 'Evidencia',
    whatIWouldDo: 'Qué haría yo',
    verify: 'Cómo lo compruebas tú',
    impact: 'Impacto',
    effort: 'Esfuerzo',
    hours: 'h',
    checklist: 'Todas las comprobaciones, incluidas las que pasas',
    checklistIntro: 'Veintidós comprobaciones sobre tu home, una ficha de producto y una colección. Repite la que quieras — de eso se trata.',
    quickWin: 'Esto arréglalo tú, hoy',
    quickWinNote: 'Gratis y sin compromiso. Para esto no me necesitas.',
    expected: 'Resultado esperado',
    noDevNeeded: 'No hace falta desarrollador',
    devNeeded: 'Necesita desarrollador',
    plan: 'El plan de cuatro semanas',
    planIntro: 'Esto es exactamente el alcance del sprint de SEO. La cuarta semana no es trabajo nuevo: es el re-rastreo, porque un arreglo que nadie ha vuelto a rastrear está desplegado, no terminado.',
    week: 'Semana',
    result: 'Resultado esperado',
    verifyWeek: 'Se verifica con',
    notPromised: 'Lo que esto no promete',
    ifNothing: 'Si no se toca nada',
    walkthrough: 'El vídeo de tres minutos',
    cta: 'Reservar 20 minutos',
    ctaNote: 'Sin presentación de ventas. Miramos tus comprobaciones juntos y decides.',
    missing: 'Lo que esta auditoría no ha podido medir',
    missingNote: 'Lo listo para que sepas exactamente dónde están los huecos. Un dato que no está aquí es que no se ha medido, y no lo voy a adivinar.',
    confidence: 'Confianza',
    theme: 'Tema',
    print: 'Imprimir',
    high: 'alto', medium: 'medio', low: 'bajo',
    estados: { pasa: 'pasa', falla: 'falla', aviso: 'aviso', no_aplica: 'no aplica', no_medible: 'no medible' },
    unmeasured: 'sin medir',
  },
};

/* Regla 2 del sistema de diseño: el estado nunca es sólo color. Cada uno
   lleva icono y etiqueta de texto, porque el ámbar y el rojo son casi el
   mismo color bajo deuteranopia. */
const ICONO = { pasa: '●', falla: '■', aviso: '▲', no_aplica: '·', no_medible: '·' };

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * @param {object} datos    salida de bin/seo.js
 * @param {object} analisis salida de la etapa ③ (validada contra seo-schema.json)
 * @param {object} opciones { loomUrl, calUrl, contacto }
 */
export function renderInformeSeo(datos, analisis, opciones = {}) {
  const t = T[analisis.idioma === 'es' ? 'es' : 'en'];

  return `<!DOCTYPE html>
<html lang="${esc(analisis.idioma || 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(t.title)} · ${esc(datos.tienda.host)}</title>
<style>${CSS}${CSS_SEO}</style>
</head>
<body>
<main class="wrap">

  <header class="head">
    <div>
      <div class="lbl">${esc(t.for)}</div>
      <h1 class="store">${esc(datos.tienda.host)}</h1>
    </div>
    <div class="head__meta">
      <div class="lbl">${esc(t.measured)}</div>
      <div class="mono">${esc(datos.fecha_auditoria)}</div>
    </div>
  </header>

  ${seccionTitular(datos, analisis, t)}
  ${seccionHallazgos(analisis, t)}
  ${seccionQuickWin(analisis, t)}
  ${seccionChecklist(datos, t)}
  ${seccionPlan(analisis, t)}
  ${seccionNoPromete(analisis, t)}
  ${seccionConsecuencia(analisis, t)}
  ${seccionLoom(opciones, t)}
  ${seccionCta(opciones, t)}
  ${seccionFaltantes(datos, analisis, t)}

  <footer class="foot">
    <span>${esc(opciones.contacto || 'Gabriel Arias · gabrielariasdev@gmail.com')}</span>
    <button type="button" class="print" onclick="print()">${esc(t.print)}</button>
  </footer>
</main>
</body>
</html>`;
}

/* ── 1. El titular: un recuento, no un importe ───────────────────── */
function seccionTitular(datos, a, t) {
  const r = datos.resumen;
  const grupos = Object.entries(r.por_grupo || {});

  return `
  <section class="hero">
    <h2 class="diag">${esc(a.diagnostico_una_linea)}</h2>
    <div class="lbl">${esc(t.headline)}</div>
    <div class="bignum${r.falla ? '' : ' bignum--ok'}">${r.falla}<span class="unit">${esc(t.of)} ${r.evaluadas} ${esc(t.checked)}</span></div>
    <div class="formula mono">${esc(t.health)}: ${r.pasa}/${r.evaluadas} · ${r.salud_pct}%</div>

    <div class="vitals">
      ${grupos.map(([g, v]) => tile(t.groups[g] || g, v, t)).join('')}
    </div>

    <div class="prov">
      ${esc(t.measured)}: ${esc(datos.fecha_auditoria)}
      ${datos.tema?.nombre ? ` · ${esc(t.theme)}: ${esc(datos.tema.nombre)}` : ''}
      · ${datos.paginas.map(p => esc(p.rol)).join(', ')}
    </div>
  </section>`;
}

/* Aprobadas sobre evaluadas, y lo no medido a la vista. Un grupo sin nada
   fallido pero con huecos no sale verde: sale neutro, con el hueco
   contado. El verde sólo significa «todo lo de aquí se midió y pasa». */
function tile(nombre, v, t) {
  const pasa = v.pasa ?? (v.total - v.falla - v.aviso);
  const sinMedir = v.no_medible || 0;
  const evaluadas = v.evaluadas ?? (pasa + v.falla + v.aviso);
  const estado = v.falla ? 'bad' : v.aviso ? 'warn' : sinMedir ? 'muted' : 'good';
  const icono = { good: '●', warn: '▲', bad: '■', muted: '◆' }[estado];
  return `<div class="vital vital--${estado}">
    <div class="lbl">${esc(nombre)}</div>
    <div class="vital__v mono"><span class="ico" aria-hidden="true">${icono}</span>${pasa}/${evaluadas}</div>
    ${sinMedir ? `<div class="vital__gap mono">${sinMedir} ${esc(t.unmeasured)}</div>` : ''}
  </div>`;
}

/* ── 2. Los hallazgos ────────────────────────────────────────────── */
function seccionHallazgos(a, t) {
  const orden = { alto: 0, medio: 1, bajo: 2 };
  const lista = [...(a.hallazgos || [])].sort((x, y) => orden[x.impacto] - orden[y.impacto]);
  if (!lista.length) return '';

  return `
  <section class="sec">
    <h3>${esc(t.findings)}</h3>
    <p class="lede">${esc(t.findingsIntro)}</p>
    <ol class="finds">
      ${lista.map((h, i) => `
      <li class="find">
        <div class="find__head">
          <span class="n mono">${String(i + 1).padStart(2, '0')}</span>
          <h4>${esc(h.titulo)}</h4>
          <span class="pill pill--${h.impacto}">${ICONO[h.impacto === 'alto' ? 'falla' : h.impacto === 'medio' ? 'aviso' : 'pasa']} ${esc(t.impact)}: ${esc(traducirImpacto(h.impacto, t))}</span>
        </div>
        <p>${esc(h.que_pasa)}</p>
        <p class="cost">${esc(h.por_que_importa)}</p>
        <div class="ev">
          <span class="lbl">${esc(t.evidence)}</span>
          <span class="mono">${esc(h.evidencia.comprobacion)}: ${esc(h.evidencia.valor)}</span>
          <span class="prov">${esc(h.evidencia.fuente)} · ${esc(h.evidencia.fecha)}</span>
        </div>
        <div class="do">
          <span class="lbl">${esc(t.whatIWouldDo)}</span>
          <p>${esc(h.que_haria)}</p>
          <span class="prov">${esc(t.effort)}: ${esc(String(h.esfuerzo_horas))}${esc(t.hours)}</span>
        </div>
        <div class="verify">
          <span class="lbl">${esc(t.verify)}</span>
          <p>${esc(h.verificable_como)}</p>
        </div>
      </li>`).join('')}
    </ol>
  </section>`;
}
const traducirImpacto = (i, t) => ({ alto: t.high, medio: t.medium, bajo: t.low }[i] || i);

/* ── 3. El quick win regalado ────────────────────────────────────── */
function seccionQuickWin(a, t) {
  const q = a.quick_win_regalado;
  if (!q) return '';
  return `
  <section class="sec">
    <div class="qw">
      <div class="lbl qw__kicker">${esc(t.quickWin)}</div>
      <h3 class="qw__title">${esc(q.titulo)}</h3>
      <ol class="qw__steps">${(q.pasos || []).map(p => `<li>${esc(p)}</li>`).join('')}</ol>
      <div class="qw__foot">
        <span class="pill pill--good">● ${esc(t.expected)}: ${esc(q.mejora_estimada)}</span>
        <span class="pill pill--${q.requiere_dev ? 'warn' : 'good'}">${q.requiere_dev ? '▲' : '●'} ${esc(q.requiere_dev ? t.devNeeded : t.noDevNeeded)}</span>
      </div>
      <p class="prov">${esc(t.quickWinNote)}</p>
    </div>
  </section>`;
}

/* ── 4. La lista entera, aprobados incluidos ─────────────────────── */
function seccionChecklist(datos, t) {
  const grupos = {};
  for (const c of datos.comprobaciones) (grupos[c.grupo] ??= []).push(c);

  // Primero lo que falla: dentro de cada grupo y entre grupos.
  const peso = { falla: 0, aviso: 1, pasa: 2, no_aplica: 3, no_medible: 3 };
  const orden = Object.entries(grupos)
    .sort((a, b) => cuenta(b[1]) - cuenta(a[1]));

  return `
  <section class="sec">
    <h3>${esc(t.checklist)}</h3>
    <p class="lede">${esc(t.checklistIntro)}</p>
    ${orden.map(([g, lista]) => `
    <div class="grp">
      <div class="lbl grp__name">${esc(t.groups[g] || g)}</div>
      <ul class="checks">
        ${[...lista].sort((a, b) => peso[a.estado] - peso[b.estado]).map(c => `
        <li class="check check--${c.estado}">
          <span class="check__ico" aria-hidden="true">${ICONO[c.estado]}</span>
          <span class="check__estado lbl">${esc(t.estados[c.estado] || c.estado)}</span>
          <span class="check__t">${esc(c.titulo)}</span>
          <span class="check__v mono">${esc(c.valor ?? '—')}</span>
          ${c.evidencia ? `<span class="check__ev prov">${esc(c.evidencia)}</span>` : ''}
        </li>`).join('')}
      </ul>
    </div>`).join('')}
  </section>`;
}
const cuenta = lista => lista.filter(c => c.estado === 'falla').length * 2 + lista.filter(c => c.estado === 'aviso').length;

/* ── 5. El plan de cuatro semanas ────────────────────────────────── */
function seccionPlan(a, t) {
  if (!a.plan_4_semanas?.length) return '';
  return `
  <section class="sec">
    <h3>${esc(t.plan)}</h3>
    <p class="lede">${esc(t.planIntro)}</p>
    <div class="weeks">
      ${a.plan_4_semanas.map(s => `
      <div class="week">
        <div class="lbl">${esc(t.week)} ${s.semana}</div>
        <h4>${esc(s.objetivo)}</h4>
        <ul>${(s.tareas || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        <div class="week__res">
          <span class="lbl">${esc(t.result)}</span><span>${esc(s.resultado_esperado)}</span>
          ${s.verificable_como ? `<span class="lbl">${esc(t.verifyWeek)}</span><span>${esc(s.verificable_como)}</span>` : ''}
        </div>
      </div>`).join('')}
    </div>
  </section>`;
}

/* ── 6. Lo que no se promete. Va antes de cobrar, no después ─────── */
function seccionNoPromete(a, t) {
  if (!a.que_no_promete) return '';
  return `
  <section class="sec">
    <div class="nope">
      <div class="lbl nope__kicker">▲ ${esc(t.notPromised)}</div>
      <p class="nope__text">${esc(a.que_no_promete)}</p>
    </div>
  </section>`;
}

function seccionConsecuencia(a, t) {
  if (!a.que_pasa_si_no_se_arregla) return '';
  return `
  <section class="sec">
    <h3>${esc(t.ifNothing)}</h3>
    <p class="lede lede--wide">${esc(a.que_pasa_si_no_se_arregla)}</p>
  </section>`;
}

function seccionLoom(o, t) {
  if (!o.loomUrl) return '';
  const id = String(o.loomUrl).match(/([a-f0-9]{20,})/i)?.[1];
  if (!id) return '';
  return `
  <section class="sec">
    <h3>${esc(t.walkthrough)}</h3>
    <div class="loom">
      <iframe src="https://www.loom.com/embed/${esc(id)}" title="${esc(t.walkthrough)}"
              frameborder="0" allowfullscreen loading="lazy"></iframe>
    </div>
  </section>`;
}

function seccionCta(o, t) {
  if (!o.calUrl) return '';
  return `
  <section class="cta">
    <a class="btn" href="${esc(o.calUrl)}">${esc(t.cta)}</a>
    <p class="prov">${esc(t.ctaNote)}</p>
  </section>`;
}

function seccionFaltantes(datos, a, t) {
  const faltantes = [...new Set([...(datos.datos_faltantes || []), ...(a.datos_faltantes || [])])];
  if (!faltantes.length) return '';
  return `
  <section class="sec sec--quiet">
    <h3 class="h3--small">${esc(t.missing)}</h3>
    <p class="prov">${esc(t.missingNote)}</p>
    <ul class="miss">${faltantes.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
    <p class="prov">${esc(t.confidence)}: ${esc(a.confianza)}</p>
  </section>`;
}

/* ── Lo que el informe de velocidad no necesita ──────────────────── */
const CSS_SEO = `
.bignum--ok{color:var(--brand-hi)}
.verify{margin-top:12px;border-left:2px solid var(--hair2);padding-left:16px}
.verify p{margin:6px 0 0;color:var(--ink2) !important;font-size:15px}

.grp{margin-bottom:32px}
.grp__name{margin-bottom:12px}
.checks{list-style:none;margin:0;padding:0;display:grid;gap:1px;background:var(--hair);border:1px solid var(--hair);border-radius:10px;overflow:hidden}
.check{
  display:grid;
  grid-template-columns:20px 92px minmax(0,1.4fr) minmax(0,1fr);
  gap:12px;align-items:baseline;
  background:var(--s1);padding:12px 16px;font-size:14px;
}
.check__ico{font-size:12px}
.check--pasa .check__ico,.check--pasa .check__estado{color:var(--brand-hi)}
.check--falla .check__ico,.check--falla .check__estado{color:var(--bad)}
.check--aviso .check__ico,.check--aviso .check__estado{color:var(--warn)}
.check--no_aplica,.check--no_medible{opacity:.6}
.check__v{color:var(--ink2);font-size:13px}
.check__ev{grid-column:3 / -1;margin:0}

.nope{background:var(--s1);border:1px solid var(--warn);border-radius:14px;padding:32px}
.nope__kicker{color:var(--warn)}
.nope__text{margin:12px 0 0;color:var(--ink);font-size:17px;line-height:1.6;max-width:62ch}

@media (max-width:600px){
  .check{grid-template-columns:20px 1fr;gap:4px 12px}
  .check__estado{text-align:right}
  .check__t,.check__v,.check__ev{grid-column:2 / -1}
}
`;
