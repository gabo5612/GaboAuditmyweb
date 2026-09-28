/* PageSpeed Insights API — móvil y escritorio.
   Cuota gratuita: ~25.000 consultas/día, 240/min. Sin clave funciona con
   cuota mucho menor, así que en lote conviene PAGESPEED_API_KEY. */

import { fetchJson, round, log } from './util.js';

const ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

/** Métricas de laboratorio que nos interesan, con su unidad. */
const LAB_METRICS = {
  'largest-contentful-paint': { clave: 'lcp_s', divisor: 1000, decimales: 2 },
  'cumulative-layout-shift': { clave: 'cls', divisor: 1, decimales: 3 },
  'total-blocking-time': { clave: 'tbt_ms', divisor: 1, decimales: 0 },
  'speed-index': { clave: 'speed_index_s', divisor: 1000, decimales: 2 },
  'first-contentful-paint': { clave: 'fcp_s', divisor: 1000, decimales: 2 },
  'interactive': { clave: 'tti_s', divisor: 1000, decimales: 2 },
};

/* Reintento tardío para cortes de red: ver fetchRetry. Medio minuto cubre
   el corte que se comió el PSI de escritorio de NaturVet. */
const REINTENTO_TARDIO_MS = 25000;

/**
 * @param {string} url
 * @param {'mobile'|'desktop'} strategy
 * @param {object} [opciones] esperas de reintento, inyectables para los tests
 */
export async function runPsi(url, strategy = 'mobile', opciones = {}) {
  const { esperaBaseMs, reintentoTardioMs = REINTENTO_TARDIO_MS } = opciones;
  const params = new URLSearchParams({ url, strategy, category: 'performance' });
  const key = process.env.PAGESPEED_API_KEY;
  if (key) params.set('key', key);

  log(`  · PSI ${strategy}: ${url}`);
  const data = await fetchJson(`${ENDPOINT}?${params}`, { timeout: 120000, esperaBaseMs, reintentoTardioMs });

  const lh = data.lighthouseResult;
  if (!lh) throw new Error('PSI no devolvió lighthouseResult');

  const audits = lh.audits || {};
  const metricas = {};
  for (const [id, spec] of Object.entries(LAB_METRICS)) {
    const v = audits[id]?.numericValue;
    metricas[spec.clave] = v == null ? null : round(v / spec.divisor, spec.decimales);
  }

  return {
    estrategia: strategy,
    score: lh.categories?.performance?.score == null
      ? null
      : Math.round(lh.categories.performance.score * 100),
    metricas,
    oportunidades: extraerOportunidades(audits),
    recursos: extraerRecursos(audits),
    terceros: extraerTerceros(audits),
    // Provenance (regla 4): toda cifra viaja con fuente y fecha.
    fuente: 'PageSpeed Insights',
    version_lighthouse: lh.lighthouseVersion || null,
    fecha: (lh.fetchTime || new Date().toISOString()).slice(0, 10),
    // Identifica la corrida: PSI devuelve la misma respuesta cacheada si se
    // le pregunta dos veces por la misma URL en ~60 s, con el mismo fetchTime.
    fetch_time: lh.fetchTime || null,
    /* Lo que Lighthouse cargó de verdad, después de redirecciones. Desde
       Lighthouse 10 `finalUrl` ya no existe y el campo caía siempre a la URL
       pedida: el JSON decía www.naturvet.com y PSI había medido el ápex. */
    url_analizada: lh.finalDisplayedUrl || lh.mainDocumentUrl || lh.finalUrl || url,
  };
}

/** Oportunidades de Lighthouse con su ahorro estimado en ms y KB (doc §2). */
function extraerOportunidades(audits) {
  return Object.entries(audits)
    .filter(([, a]) => a?.details?.type === 'opportunity' && a.score !== 1)
    .map(([id, a]) => ({
      id,
      titulo: a.title,
      ahorro_ms: Math.round(a.details.overallSavingsMs || 0),
      ahorro_kb: Math.round((a.details.overallSavingsBytes || 0) / 1024),
      // Los primeros elementos concretos, para que el hallazgo tenga evidencia.
      ejemplos: (a.details.items || []).slice(0, 5).map(i => i.url).filter(Boolean),
    }))
    .filter(o => o.ahorro_ms > 0 || o.ahorro_kb > 0)
    .sort((a, b) => b.ahorro_ms - a.ahorro_ms);
}

/** Peso total y desglose por tipo de recurso. */
function extraerRecursos(audits) {
  const items = audits['resource-summary']?.details?.items || [];
  const desglose = {};
  let total_kb = 0;
  for (const it of items) {
    const kb = Math.round((it.transferSize || 0) / 1024);
    if (it.resourceType === 'total') { total_kb = kb; continue; }
    desglose[it.resourceType] = { kb, peticiones: it.requestCount || 0 };
  }
  return { total_kb, desglose };
}

/** Scripts de terceros agrupados por entidad, con su bloqueo de hilo principal. */
function extraerTerceros(audits) {
  const items = audits['third-party-summary']?.details?.items || [];
  return items
    .map(i => ({
      entidad: typeof i.entity === 'string' ? i.entity : i.entity?.text || 'desconocida',
      kb: Math.round((i.transferSize || 0) / 1024),
      bloqueo_ms: Math.round(i.blockingTime || 0),
    }))
    .sort((a, b) => b.bloqueo_ms - a.bloqueo_ms);
}

/**
 * Elige la corrida mediana por LCP y resume el resto. Una corrida suelta no
 * es un dato: el LCP móvil de NaturVet dio 15,29 / 20,72 / 21,45 s el mismo
 * día. Se publica la corrida del medio —con todas sus cifras, para que
 * score, LCP y oportunidades vengan de la misma medición— y el rango.
 *
 * Con un número par de corridas gana la más rápida de las dos centrales: el
 * titular tiene que resistir que el prospecto lo vuelva a medir.
 */
export function elegirMediana(corridas) {
  const validas = corridas.filter(Boolean);
  if (!validas.length) return null;
  const orden = [...validas].sort((a, b) =>
    (a.metricas.lcp_s ?? Infinity) - (b.metricas.lcp_s ?? Infinity));
  const mediana = orden[Math.floor((orden.length - 1) / 2)];

  const serie = clave => validas.map(c => clave(c)).filter(v => v != null);
  const rango = xs => (xs.length ? [Math.min(...xs), Math.max(...xs)] : null);
  const scores = serie(c => c.score);
  const lcps = serie(c => c.metricas.lcp_s);

  return {
    ...mediana,
    corridas: validas.map(c => ({ score: c.score, lcp_s: c.metricas.lcp_s, fetch_time: c.fetch_time })),
    criterio: validas.length > 1 ? `mediana de ${validas.length} corridas por LCP` : 'una sola corrida',
    rango: { score: rango(scores), lcp_s: rango(lcps) },
  };
}
