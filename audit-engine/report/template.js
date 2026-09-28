/* Etapa ④ — El informe.

   Un solo archivo HTML, autocontenido, sin una sola petición externa: ni
   fuentes, ni scripts, ni imágenes remotas. El informe es en sí mismo la
   demostración del producto (doc §4). Un consultor de velocidad que manda
   un PDF de 8 MB se contradice a sí mismo.

   Por eso IBM Plex se pide pero no se descarga: si el cliente la tiene
   instalada, la usa; si no, cae a la del sistema. Cero red. */

import { fallasCampo } from '../src/cwv.js';
import { fmt, num, calcularPerdida } from '../src/money.js';

const T = {
  en: {
    title: 'Speed audit',
    for: 'Prepared for',
    measured: 'Measured',
    costing: 'What this is costing you',
    ofRevenue: 'of monthly revenue',
    perMonth: '/month',
    assumptions: 'Assumptions',
    source: 'Source',
    cruxSrc: 'Chrome UX Report (CrUX), real users on phones, 75th percentile',
    labSrc: 'PageSpeed Insights, lab test',
    cwvFailed: 'Core Web Vitals, real users on phones: failed',
    cwvUnit: 'p75 · CrUX',
    cwvNoMoney: 'Your real-user LCP passes, so there is no revenue figure: the only published coefficient is for load time, and INP or layout shift have none. Rather than invent one, this shows what fails.',
    basisField: 'Calculated on the LCP your real visitors get',
    basisLab: 'Calculated on the lab LCP: no real-user data exists for this store',
    lcpLab: 'LCP · lab',
    lcpField: 'LCP · real users',
    vsCompetitors: 'You against your competitors',
    vsIntro: 'Same test, same day, same connection. Mobile largest contentful paint.',
    vsIntroField: 'Real shoppers on phones, last 28 days, the same Google dataset for all three. Largest contentful paint, 75th percentile.',
    you: 'You',
    findings: 'What I found',
    findingsIntro: 'Five things, ordered by what they cost you. Not by what is easy to fix.',
    evidence: 'Evidence',
    whatIWouldDo: 'What I would do',
    impact: 'Impact',
    effort: 'Effort',
    hours: 'h',
    quickWin: 'Fix this one yourself, today',
    quickWinNote: 'No charge, no strings. You do not need me for this one.',
    expected: 'Expected improvement',
    noDevNeeded: 'No developer needed',
    devNeeded: 'Needs a developer',
    plan: 'The three-week plan',
    planIntro: 'This is exactly the scope of the sprint, written out. If you want to hand it to your own developer instead, it is yours.',
    week: 'Week',
    result: 'Expected result',
    ifNothing: 'If nothing changes',
    walkthrough: 'The three-minute walkthrough',
    cta: 'Book 20 minutes',
    ctaNote: 'No pitch deck. We look at your numbers together and you decide.',
    missing: 'What this audit could not measure',
    missingNote: 'Listed so you know exactly where the gaps are. A number that is not here was not measured, and I will not guess at it.',
    confidence: 'Confidence',
    theme: 'Theme',
    apps: 'Apps detected',
    weight: 'Page weight',
    print: 'Print',
    notMeasured: 'not measured',
    analysed: 'URL analysed',
    medianOf: 'median of {n} runs',
    range: 'range',
    score: 'score',
    high: 'high', medium: 'medium', low: 'low',
  },
  es: {
    title: 'Auditoría de velocidad',
    for: 'Preparado para',
    measured: 'Medido el',
    costing: 'Lo que te está costando',
    ofRevenue: 'de la facturación mensual',
    perMonth: '/mes',
    assumptions: 'Supuestos',
    source: 'Fuente',
    cruxSrc: 'Chrome UX Report (CrUX), usuarios reales en móvil, percentil 75',
    labSrc: 'PageSpeed Insights, test de laboratorio',
    cwvFailed: 'Core Web Vitals, usuarios reales en móvil: no aprueba',
    cwvUnit: 'p75 · CrUX',
    cwvNoMoney: 'Tu LCP con usuarios reales aprueba, así que no hay cifra de facturación: el único coeficiente publicado es para el tiempo de carga, y ni el INP ni el desplazamiento de diseño tienen uno. En vez de inventarlo, aquí está lo que falla.',
    basisField: 'Calculado sobre el LCP que ven tus visitantes reales',
    basisLab: 'Calculado sobre el LCP de laboratorio: no hay datos de usuarios reales de esta tienda',
    lcpLab: 'LCP · laboratorio',
    lcpField: 'LCP · usuarios reales',
    vsCompetitors: 'Tú frente a tu competencia',
    vsIntro: 'Mismo test, mismo día, misma conexión. Largest contentful paint en móvil.',
    vsIntroField: 'Compradores reales en móvil, últimos 28 días, el mismo conjunto de datos de Google para los tres. Largest contentful paint, percentil 75.',
    you: 'Tú',
    findings: 'Lo que he encontrado',
    findingsIntro: 'Cinco cosas, ordenadas por lo que te cuestan. No por lo fácil que son de arreglar.',
    evidence: 'Evidencia',
    whatIWouldDo: 'Qué haría yo',
    impact: 'Impacto',
    effort: 'Esfuerzo',
    hours: 'h',
    quickWin: 'Esto arréglalo tú, hoy',
    quickWinNote: 'Gratis y sin compromiso. Para esto no me necesitas.',
    expected: 'Mejora estimada',
    noDevNeeded: 'No hace falta desarrollador',
    devNeeded: 'Necesita desarrollador',
    plan: 'El plan de tres semanas',
    planIntro: 'Esto es exactamente el alcance del sprint, escrito. Si prefieres dárselo a tu propio desarrollador, es tuyo.',
    week: 'Semana',
    result: 'Resultado esperado',
    ifNothing: 'Si no se toca nada',
    walkthrough: 'El vídeo de tres minutos',
    cta: 'Reservar 20 minutos',
    ctaNote: 'Sin presentación de ventas. Miramos tus números juntos y decides.',
    missing: 'Lo que esta auditoría no ha podido medir',
    missingNote: 'Lo listo para que sepas exactamente dónde están los huecos. Un número que no está aquí es que no se ha medido, y no lo voy a adivinar.',
    confidence: 'Confianza',
    theme: 'Tema',
    apps: 'Apps detectadas',
    weight: 'Peso de la página',
    print: 'Imprimir',
    notMeasured: 'sin medir',
    analysed: 'URL analizada',
    medianOf: 'mediana de {n} corridas',
    range: 'rango',
    score: 'score',
    high: 'alto', medium: 'medio', low: 'bajo',
  },
};

/* «median of 3 runs (score 48–55, LCP 15.29–21.45 s)». El rango va en el
   informe porque el prospecto va a volver a medir, y si le sale otra cifra
   tiene que caer dentro de lo que ya le dijimos. */
function medianaTexto(movil, t) {
  const r = movil.rango || {};
  const tramo = (par, u = '') => (par && par[0] !== par[1] ? `${par[0]}–${par[1]}${u}` : null);
  const partes = [
    tramo(r.score) && `${t.score} ${tramo(r.score)}`,
    tramo(r.lcp_s, ' s') && `LCP ${tramo(r.lcp_s, ' s')}`,
  ].filter(Boolean);
  return `${t.medianOf.replace('{n}', movil.corridas.length)}${partes.length ? ` (${t.range}: ${partes.join(', ')})` : ''}`;
}

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * @param {object} datos  salida de bin/audit.js
 * @param {object} analisis salida de la etapa ③ (validada contra schema.json)
 * @param {object} opciones { loomUrl, calUrl, contacto }
 */
export function renderInforme(datos, analisis, opciones = {}) {
  const es = analisis.idioma === 'es';
  const t = T[es ? 'es' : 'en'];
  const locale = es ? 'es-ES' : 'en-US';
  const movil = datos.rendimiento.movil;

  // Se recalcula con los mismos datos sólo para reformatear las cifras en
  // el locale del cliente: 250,000 frente a 250.000. Mismo número, misma
  // fórmula que la calculadora de la web.
  const dinero = {
    ...datos.dinero,
    ...calcularPerdida(datos.dinero.lcp_s, datos.dinero.facturacion_mensual, datos.dinero.moneda, locale),
  };

  return `<!DOCTYPE html>
<html lang="${esc(analisis.idioma || 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(t.title)} · ${esc(datos.tienda.host)}</title>
<style>${CSS}</style>
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

  ${seccionTitular(datos, analisis, t, movil, dinero, locale)}
  ${seccionCompetencia(datos, t)}
  ${seccionHallazgos(analisis, t)}
  ${seccionQuickWin(analisis, t)}
  ${seccionPlan(analisis, t)}
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

/* ── 1. El titular con el número que duele ───────────────────────── */
function seccionTitular(datos, a, t, movil, dinero, locale) {
  const coste = a.coste_estimado_mensual || {};
  const importe = coste.valor ?? dinero.perdida_importe;
  const pct = coste.porcentaje ?? dinero.perdida_pct;

  /* Sin facturación conocida no se inventa un importe: se muestra el %.
     Y sin LCP medido no se muestra ninguna de las dos cosas: una raya dice
     la verdad, un "0 %" tranquiliza y miente. */
  /* Usuarios reales con el LCP en «good» pero INP o CLS fallando: un «0 %»
     de titular diría «no pasa nada» a una tienda que PageSpeed marca en
     rojo. Se enseña lo que falla, y se dice por qué no hay dinero. */
  const cwv = fallasCampo(datos.campo);
  const soloCwv = importe == null && pct === 0 && dinero.base === 'campo' && cwv?.fallas.length;
  if (soloCwv) {
    return seccionTitularCwv(datos, a, t, movil, dinero, cwv);
  }

  const cifra = importe != null
    ? `${fmt(importe, coste.moneda || dinero.moneda, locale)}<span class="unit">${esc(t.perMonth)}</span>`
    : pct != null
      ? `${num(pct, 1, locale)}%<span class="unit">${esc(t.ofRevenue)}</span>`
      : `—<span class="unit">${esc(t.notMeasured)}</span>`;

  return `
  <section class="hero">
    <h2 class="diag">${esc(a.diagnostico_una_linea)}</h2>
    <div class="lbl">${esc(t.costing)}</div>
    <div class="bignum">${cifra}</div>
    ${dinero.formula ? `<div class="formula mono">${esc(dinero.formula)}</div>` : ''}
    ${dinero.base ? `<div class="prov">${esc(dinero.base === 'campo' ? t.basisField : t.basisLab)} · ${esc(dinero.base === 'campo' ? `${t.cruxSrc}, ${datos.campo?.fecha || ''}` : `${t.labSrc}, ${movil.fecha || ''}`)}</div>` : ''}

    <div class="vitals">
      ${vital('PageSpeed', movil.score, null, estadoScore(movil.score))}
      ${dinero.base === 'campo'
        ? `${vital(t.lcpField, dinero.lcp_s, 's', estadoLcp(dinero.lcp_s))}${vital(t.lcpLab, movil.metricas.lcp_s, 's', estadoLcp(movil.metricas.lcp_s))}`
        : vital('LCP', movil.metricas.lcp_s, 's', estadoLcp(movil.metricas.lcp_s))}
      ${vital('CLS', movil.metricas.cls, '', umbral(movil.metricas.cls, 0.1, 0.25))}
      ${vital('TBT', movil.metricas.tbt_ms, 'ms', umbral(movil.metricas.tbt_ms, 200, 600))}
    </div>

    <div class="prov">
      ${esc(t.source)}: ${esc(movil.fuente)}${movil.version_lighthouse ? ` v${esc(movil.version_lighthouse)}` : ''} · ${esc(movil.fecha)}
      ${movil.url_analizada ? ` · ${esc(t.analysed)}: ${esc(movil.url_analizada)}` : ''}
      ${movil.corridas?.length > 1 ? ` · ${esc(medianaTexto(movil, t))}` : ''}
      ${datos.tema?.nombre ? ` · ${esc(t.theme)}: ${esc(datos.tema.nombre)}` : ''}
      ${datos.apps?.total != null ? ` · ${esc(t.apps)}: ${datos.apps.total}` : ''}
      ${movil.recursos?.total_kb ? ` · ${esc(t.weight)}: ${movil.recursos.total_kb} KB` : ''}
    </div>

    <details class="assum">
      <summary>${esc(t.assumptions)}</summary>
      <ul>${(coste.supuestos || dinero.supuestos).map(s => `<li>${esc(s)}</li>`).join('')}</ul>
      <p class="prov">${esc(coste.fuente || dinero.fuente)}</p>
    </details>
  </section>`;
}

function seccionTitularCwv(datos, a, t, movil, dinero, cwv) {
  return `
  <section class="hero">
    <h2 class="diag">${esc(a.diagnostico_una_linea)}</h2>
    <div class="lbl">${esc(t.cwvFailed)}</div>
    <div class="bignum">${cwv.fallas.map(f => esc(f.texto)).join(' · ')}<span class="unit">${esc(t.cwvUnit)}</span></div>
    <div class="prov">${esc(t.cruxSrc)} · ${esc(cwv.fecha || '')}</div>
    <p class="prov">${esc(t.cwvNoMoney)}</p>

    <div class="vitals">
      ${vital('PageSpeed', movil.score, null, estadoScore(movil.score))}
      ${vital(t.lcpField, dinero.lcp_s, 's', estadoLcp(dinero.lcp_s))}
      ${vital(t.lcpLab, movil.metricas.lcp_s, 's', estadoLcp(movil.metricas.lcp_s))}
      ${vital('TBT', movil.metricas.tbt_ms, 'ms', umbral(movil.metricas.tbt_ms, 200, 600))}
    </div>

    <div class="prov">
      ${esc(t.source)}: ${esc(movil.fuente)}${movil.version_lighthouse ? ` v${esc(movil.version_lighthouse)}` : ''} · ${esc(movil.fecha)}
      ${movil.url_analizada ? ` · ${esc(t.analysed)}: ${esc(movil.url_analizada)}` : ''}
      ${movil.corridas?.length > 1 ? ` · ${esc(medianaTexto(movil, t))}` : ''}
    </div>
  </section>`;
}

function vital(nombre, valor, unidad, estado) {
  const icono = { good: '●', warn: '▲', bad: '■' }[estado] || '·';
  return `<div class="vital vital--${estado}">
    <div class="lbl">${esc(nombre)}</div>
    <div class="vital__v mono"><span class="ico" aria-hidden="true">${icono}</span>${valor ?? '—'}${esc(unidad || '')}</div>
  </div>`;
}
const estadoScore = s => s == null ? 'none' : s >= 90 ? 'good' : s >= 50 ? 'warn' : 'bad';
const estadoLcp = v => v == null ? 'none' : v <= 2.5 ? 'good' : v <= 4 ? 'warn' : 'bad';
/* `null <= 0.1` es true en JavaScript, así que una métrica que falta salía
   con el punto verde de "bien" al lado de una raya. Un hueco nunca se pinta
   como un aprobado. */
const umbral = (v, bien, regular) =>
  v == null ? 'none' : v <= bien ? 'good' : v <= regular ? 'warn' : 'bad';

/* ── 2. La comparativa ───────────────────────────────────────────── */
function seccionCompetencia(datos, t) {
  if (!datos.competencia?.length) return '';
  /* Campo contra campo si todos lo tienen: es lo que viven los compradores
     de cada tienda y no depende de una corrida de laboratorio. Si falta en
     alguno, laboratorio para todos — nunca mezclar las dos escalas. */
  const campo = datos.dinero?.base === 'campo' && datos.competencia.every(c => c.campo?.lcp_s != null);
  const tu = campo ? datos.dinero.lcp_s : datos.rendimiento.movil.metricas.lcp_s;
  const filas = [
    { host: datos.tienda.host, lcp: tu, score: datos.rendimiento.movil.score, tuyo: true },
    ...datos.competencia.map(c => ({ host: c.host, lcp: campo ? c.campo.lcp_s : c.lcp_s, score: c.score, tuyo: false })),
  ];
  const max = Math.max(...filas.map(f => f.lcp || 0), 1);

  return `
  <section class="sec">
    <h3>${esc(t.vsCompetitors)}</h3>
    <p class="lede">${esc(campo ? t.vsIntroField : t.vsIntro)}</p>
    <div class="bars">
      ${filas.map(f => `
      <div class="row">
        <div class="row__name${f.tuyo ? ' row__name--you' : ''}">${esc(f.host)}${f.tuyo ? ` <span class="you">${esc(t.you)}</span>` : ''}</div>
        <div class="row__track">
          <div class="row__fill ${f.tuyo ? 'row__fill--you' : 'row__fill--them'}" style="width:${Math.max(4, ((f.lcp || 0) / max) * 100)}%"></div>
        </div>
        <div class="row__val mono">${f.lcp ?? '—'}s</div>
      </div>`).join('')}
    </div>
    <p class="prov">${esc(t.source)}: ${campo ? `${esc(t.cruxSrc)} · ${esc(datos.competencia[0].campo.fecha || '')}` : `PageSpeed Insights · ${esc(datos.competencia[0].fecha)}`}</p>
  </section>`;
}

/* ── 3. Los hallazgos ────────────────────────────────────────────── */
function seccionHallazgos(a, t) {
  const orden = { alto: 0, medio: 1, bajo: 2 };
  const lista = [...(a.hallazgos || [])].sort((x, y) => orden[x.impacto] - orden[y.impacto]);

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
          <span class="pill pill--${h.impacto}">${iconoImpacto(h.impacto)} ${esc(t.impact)}: ${esc(traducirImpacto(h.impacto, t))}</span>
        </div>
        <p>${esc(h.que_pasa)}</p>
        <p class="cost">${esc(h.por_que_cuesta_dinero)}</p>
        <div class="ev">
          <span class="lbl">${esc(t.evidence)}</span>
          <span class="mono">${esc(h.evidencia.metrica)}: ${esc(h.evidencia.valor)}</span>
          <span class="prov">${esc(h.evidencia.fuente)} · ${esc(h.evidencia.fecha)}</span>
        </div>
        <div class="do">
          <span class="lbl">${esc(t.whatIWouldDo)}</span>
          <p>${esc(h.que_haria)}</p>
          <span class="prov">${esc(t.effort)}: ${esc(String(h.esfuerzo_horas))}${esc(t.hours)}</span>
        </div>
      </li>`).join('')}
    </ol>
  </section>`;
}
const iconoImpacto = i => ({ alto: '■', medio: '▲', bajo: '●' }[i] || '·');
const traducirImpacto = (i, t) => ({ alto: t.high, medio: t.medium, bajo: t.low }[i] || i);

/* ── 4. El quick win regalado ────────────────────────────────────── */
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

/* ── 5. El plan de tres semanas ──────────────────────────────────── */
function seccionPlan(a, t) {
  if (!a.plan_3_semanas?.length) return '';
  return `
  <section class="sec">
    <h3>${esc(t.plan)}</h3>
    <p class="lede">${esc(t.planIntro)}</p>
    <div class="weeks">
      ${a.plan_3_semanas.map(s => `
      <div class="week">
        <div class="lbl">${esc(t.week)} ${s.semana}</div>
        <h4>${esc(s.objetivo)}</h4>
        <ul>${(s.tareas || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        <div class="week__res"><span class="lbl">${esc(t.result)}</span><span>${esc(s.resultado_esperado)}</span></div>
      </div>`).join('')}
    </div>
  </section>`;
}

/* ── 6. Qué pasa si no se arregla ────────────────────────────────── */
function seccionConsecuencia(a, t) {
  if (!a.que_pasa_si_no_se_arregla) return '';
  return `
  <section class="sec">
    <h3>${esc(t.ifNothing)}</h3>
    <p class="lede lede--wide">${esc(a.que_pasa_si_no_se_arregla)}</p>
  </section>`;
}

/* ── El Loom ─────────────────────────────────────────────────────── */
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

/* ── 7. Un solo CTA ──────────────────────────────────────────────── */
function seccionCta(o, t) {
  if (!o.calUrl) return '';
  return `
  <section class="cta">
    <a class="btn" href="${esc(o.calUrl)}">${esc(t.cta)}</a>
    <p class="prov">${esc(t.ctaNote)}</p>
  </section>`;
}

/* ── Provenance: lo que no se pudo medir ─────────────────────────── */
function seccionFaltantes(datos, a, t) {
  /* Las del motor están en español: en otro idioma sólo cuenta la lista del
     análisis, que validate.js obliga a traer completa y traducida. */
  const faltantes = [...new Set([...((a.idioma || 'en') === 'es' ? datos.datos_faltantes || [] : []), ...(a.datos_faltantes || [])])];
  if (!faltantes.length) return '';
  return `
  <section class="sec sec--quiet">
    <h3 class="h3--small">${esc(t.missing)}</h3>
    <p class="prov">${esc(t.missingNote)}</p>
    <ul class="miss">${faltantes.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
    <p class="prov">${esc(t.confidence)}: ${esc(a.confianza)}</p>
  </section>`;
}

/* ── Estilos ─────────────────────────────────────────────────────
   Mismos tokens que el sitio. IBM Plex se pide, no se descarga.     */
export const CSS = `
:root{
  color-scheme:dark;
  --plane:#0E1013;--s1:#16191E;--s2:#1D2127;
  --ink:#F2F4F5;--ink2:#A8B0B8;--ink3:#8A929B;
  --hair:rgba(242,244,245,.10);--hair2:rgba(242,244,245,.18);
  --brand:#10AC70;--brand-hi:#2DD48F;--warn:#C98500;--bad:#E5484D;
  --ui:"IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif;
  --mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
}
*{box-sizing:border-box}
body{margin:0;background:var(--plane);color:var(--ink);font-family:var(--ui);-webkit-font-smoothing:antialiased;line-height:1.6}
.wrap{max-width:820px;margin:0 auto;padding:0 24px 96px}
.mono{font-family:var(--mono);font-variant-numeric:tabular-nums}
.lbl{font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink3)}
.prov{font-size:13px;color:var(--ink3);line-height:1.5;margin:8px 0 0}
h1,h2,h3,h4{letter-spacing:-.02em;margin:0}
.head{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;padding:40px 0 32px;border-bottom:1px solid var(--hair);flex-wrap:wrap}
.store{font-size:22px;font-weight:600;margin-top:4px}
.head__meta{text-align:right}

.hero{padding:48px 0;border-bottom:1px solid var(--hair)}
.diag{font-size:clamp(1.75rem, 1.3rem + 1.8vw, 2.5rem);line-height:1.15;font-weight:600;margin-bottom:32px;text-wrap:pretty}
.bignum{font-family:var(--mono);font-weight:600;font-size:clamp(2.5rem, 1.8rem + 3vw, 4rem);line-height:1;letter-spacing:-.03em;color:var(--bad);font-variant-numeric:tabular-nums;margin-top:8px}
.unit{font-size:.32em;color:var(--ink2);margin-left:12px;letter-spacing:0}
.formula{font-size:13px;color:var(--ink2);margin-top:16px}
.vitals{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-top:32px}
.vital{background:var(--s1);border:1px solid var(--hair);border-radius:10px;padding:16px}
.vital__v{font-size:24px;font-weight:600;margin-top:6px;display:flex;align-items:baseline;gap:8px}
.ico{font-size:13px}
.vital--good .ico{color:var(--brand-hi)}.vital--warn .ico{color:var(--warn)}.vital--bad .ico{color:var(--bad)}.vital--muted .ico{color:var(--ink3)}
.vital__gap{font-size:12px;color:var(--ink3);margin-top:4px}
.assum{margin-top:24px;border-top:1px solid var(--hair);padding-top:16px}
.assum summary{cursor:pointer;font-size:14px;color:var(--ink2);list-style:none}
.assum summary::after{content:" +";font-family:var(--mono);color:var(--ink3)}
.assum[open] summary::after{content:" −"}
.assum ul{margin:12px 0 0;padding-left:20px;font-size:14px;color:var(--ink2)}

.sec{padding:48px 0;border-bottom:1px solid var(--hair)}
.sec--quiet{opacity:.85}
.sec h3{font-size:clamp(1.4rem, 1.2rem + .8vw, 1.75rem);font-weight:600}
.h3--small{font-size:1.05rem}
.lede{color:var(--ink2);margin:12px 0 32px;max-width:62ch}
.lede--wide{margin-bottom:0;font-size:17px}

.bars{display:grid;gap:12px}
.row{display:grid;grid-template-columns:minmax(120px,1fr) 3fr auto;gap:16px;align-items:center}
.row__name{font-size:14px;color:var(--ink2)}
.row__name--you{color:var(--ink);font-weight:600}
.you{font-family:var(--mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--bad)}
.row__track{height:28px;background:var(--s1);border-radius:4px;overflow:hidden}
.row__fill{height:100%;border-radius:4px}
.row__fill--you{background:var(--bad);opacity:.55}
.row__fill--them{background:var(--brand);opacity:.45}
.row__val{font-size:14px;font-weight:600;min-width:52px;text-align:right}

.finds{list-style:none;margin:0;padding:0;display:grid;gap:16px}
.find{background:var(--s1);border:1px solid var(--hair);border-radius:14px;padding:24px}
.find__head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px}
.find__head h4{font-size:18px;font-weight:600;flex:1;min-width:200px}
.n{color:var(--ink3);font-size:13px}
.find p{margin:0 0 12px;color:var(--ink2);font-size:15px}
.cost{color:var(--ink) !important}
.pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}
/* La mejora estimada es una frase, no una etiqueta: puede partir línea. */
.qw__foot .pill{white-space:normal;border-radius:12px;line-height:1.5}
.pill--alto,.pill--bad{background:rgba(229,72,77,.14);color:var(--bad)}
.pill--medio,.pill--warn{background:rgba(201,133,0,.14);color:var(--warn)}
.pill--bajo,.pill--good{background:rgba(16,172,112,.14);color:var(--brand-hi)}
.ev{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 12px;padding:12px 16px;background:var(--plane);border-radius:10px;font-size:14px;margin-bottom:12px}
.do{border-left:2px solid var(--brand);padding-left:16px}
.do p{margin:6px 0 0;color:var(--ink) !important}

.qw{background:var(--s1);border:1px solid var(--brand);border-radius:14px;padding:32px}
.qw__kicker{color:var(--brand-hi)}
.qw__title{font-size:20px;font-weight:600;margin:8px 0 16px}
.qw__steps{margin:0;padding-left:20px;color:var(--ink2);display:grid;gap:8px;font-size:15px}
.qw__foot{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}

.weeks{display:grid;gap:16px}
.week{background:var(--s1);border:1px solid var(--hair);border-radius:14px;padding:24px}
.week h4{font-size:17px;font-weight:600;margin:8px 0 12px}
.week ul{margin:0;padding-left:20px;color:var(--ink2);font-size:15px;display:grid;gap:6px}
.week__res{margin-top:16px;padding-top:12px;border-top:1px solid var(--hair);display:grid;gap:4px;font-size:14px;color:var(--ink2)}

.loom{position:relative;padding-top:56.25%;border-radius:14px;overflow:hidden;border:1px solid var(--hair)}
.loom iframe{position:absolute;inset:0;width:100%;height:100%}

.cta{padding:56px 0;text-align:center;border-bottom:1px solid var(--hair)}
.btn{display:inline-flex;align-items:center;min-height:56px;padding:0 32px;border-radius:999px;background:var(--ink);color:var(--plane);font-size:18px;font-weight:600;text-decoration:none}
.miss{margin:12px 0 0;padding-left:20px;font-size:14px;color:var(--ink2);display:grid;gap:6px}

.foot{display:flex;justify-content:space-between;align-items:center;gap:16px;padding-top:32px;font-size:13px;color:var(--ink3);flex-wrap:wrap}
.print{background:none;border:1px solid var(--hair2);color:var(--ink2);border-radius:999px;padding:8px 16px;font-size:13px;cursor:pointer;font-family:inherit}

@media (max-width:600px){
  .row{grid-template-columns:1fr auto;grid-template-areas:"name val" "track track"}
  .row__name{grid-area:name}.row__val{grid-area:val}.row__track{grid-area:track}
  .head{align-items:flex-start}.head__meta{text-align:left}
}

/* En papel, tinta negra sobre blanco. Nadie imprime un fondo #0E1013. */
@media print{
  :root{--plane:#fff;--s1:#fff;--s2:#f4f4f5;--ink:#111;--ink2:#333;--ink3:#666;--hair:#ddd;--hair2:#ccc}
  body{background:#fff;color:#111}
  .print,.loom,.cta{display:none}
  .find,.week,.qw{break-inside:avoid;border-color:#ddd}
  .sec{break-inside:auto;padding:24px 0}
  a{color:#111;text-decoration:underline}
}
`;
