/* Traducción a dinero.

   Usa EXACTAMENTE la misma fórmula que la calculadora de assets/main.js.
   Coherencia de marca (doc §2): el número del informe y el número de la web
   tienen que coincidir. Si cambias el coeficiente, cámbialo en los dos
   sitios o parecerás improvisado.

   Si tocas esto, toca también:  assets/main.js → calculator() */

export const OBJETIVO_LCP_S = 2.5;   // umbral "good" de Core Web Vitals
export const PERDIDA_POR_S = 8;      // % de conversión por segundo de más
export const PERDIDA_MAXIMA = 45;    // tope; más allá la estimación no es creíble

/* Verificado contra el PDF el 28 sep 2026 (Deloitte Digital, Google y
   Fifty-Five, «Milliseconds Make Millions», 2020, pág. 15): en retail, una
   mejora de 0,1 s en cada una de sus cuatro métricas de velocidad se
   correlacionó con +8,4 % de transacciones — 37 marcas, 30 M de sesiones,
   4 semanas, regresión logarítmica. El 0,8 % por 100 ms NO sale del estudio:
   es un décimo de ese efecto, aplicado en lineal al LCP. Se dice así, en vez
   de citar el 8,4 % como si fuera el coeficiente. */
export const FUENTE_COEFICIENTE =
  '0,8% de conversión por cada 100 ms de LCP: un décimo del +8,4% de transacciones por cada 0,1 s que midió en retail Deloitte, «Milliseconds Make Millions» (2020). Correlación, no causalidad.';
export const FUENTE_COEFICIENTE_EN =
  '0.8% of conversion per 100 ms of LCP: one tenth of the +8.4% in retail transactions per 0.1 s measured by Deloitte, "Milliseconds Make Millions" (2020). Correlation, not causation.';

/**
 * @param {number} lcpSegundos LCP móvil medido
 * @param {number|null} facturacionMensual si no se conoce, el importe queda a null
 */
export function calcularPerdida(lcpSegundos, facturacionMensual = null, moneda = 'EUR', locale = 'es-ES') {
  const facturacion = Number(facturacionMensual) || null;

  /* Sin LCP no hay estimación. Devolver 0 sería rellenar el hueco en
     silencio, que es justo lo que el motor no debe hacer: el titular del
     informe saldría con un "0 %" tranquilizador y falso. */
  const lcp = Number(lcpSegundos);
  if (!Number.isFinite(lcp) || lcp <= 0) {
    return {
      medible: false,
      lcp_s: null, objetivo_s: OBJETIVO_LCP_S, exceso_s: null,
      perdida_pct: null, perdida_importe: null,
      moneda, facturacion_mensual: facturacion,
      formula: null,
      fuente: FUENTE_COEFICIENTE,
      supuestos: ['No hay LCP móvil medido: no se puede estimar la pérdida.'],
    };
  }

  const exceso = Math.max(0, lcp - OBJETIVO_LCP_S);
  const sinTope = exceso * PERDIDA_POR_S;
  const perdidaPct = Math.min(PERDIDA_MAXIMA, sinTope);
  const topeAplicado = sinTope > PERDIDA_MAXIMA;

  const importe = facturacion ? (facturacion * perdidaPct) / 100 : null;

  return {
    medible: true,
    lcp_s: lcp,
    objetivo_s: OBJETIVO_LCP_S,
    exceso_s: Math.round(exceso * 100) / 100,
    perdida_pct: Math.round(perdidaPct * 10) / 10,
    // En outbound no conoces la facturación. El importe se queda vacío y el
    // hecho de que falta se declara, en vez de estimarlo por analogía.
    perdida_importe: importe == null ? null : Math.round(importe),
    moneda,
    facturacion_mensual: facturacion,
    tope_aplicado: topeAplicado,
    /* Fórmula puramente simbólica: el informe puede salir en cualquier
       idioma y ésta se lee igual. La etiqueta la pone la plantilla.

       Cuando el tope entra en juego, tiene que aparecer escrito: si no, la
       ecuación impresa no da el número impreso justo encima, y eso pasa
       precisamente en las tiendas más lentas, que son el cliente objetivo. */
    formula: construirFormula({ facturacion, lcp, perdidaPct, importe, topeAplicado, moneda, locale }),
    fuente: FUENTE_COEFICIENTE,
    supuestos: [
      `Objetivo de LCP: ${OBJETIVO_LCP_S}s (umbral "good" de Core Web Vitals).`,
      `Coeficiente: ${PERDIDA_POR_S}% de conversión por segundo por encima del objetivo.`,
      topeAplicado
        ? `Tope del ${PERDIDA_MAXIMA}% aplicado: sin él la estimación sería del ${num(sinTope, 1, locale)}%, que no es creíble.`
        : `Tope disponible: ${PERDIDA_MAXIMA}% (no ha hecho falta aplicarlo).`,
      facturacion
        ? 'Facturación mensual aportada por el cliente.'
        : 'Facturación mensual desconocida: sólo se expresa el porcentaje.',
    ],
  };
}

function construirFormula({ facturacion, lcp, perdidaPct, importe, topeAplicado, moneda, locale }) {
  const s = n => `${num(n, 1, locale)}s`;
  // Con el tope activo la tasa se escribe como mín(...), que sí evalúa al
  // resultado que se muestra.
  const tasa = topeAplicado
    ? `mín(${PERDIDA_MAXIMA}%, (${s(lcp)} − ${s(OBJETIVO_LCP_S)}) × ${PERDIDA_POR_S}%/s)`
    : `(${s(lcp)} − ${s(OBJETIVO_LCP_S)}) × ${PERDIDA_POR_S}%/s`;

  return facturacion
    ? `${fmt(facturacion, moneda, locale)} × ${tasa} = ${fmt(importe, moneda, locale)}`
    : `${tasa} = ${num(perdidaPct, 1, locale)}%`;
}

/* El informe se escribe en el idioma del cliente, así que las cifras se
   formatean con su locale: 250,000 para un inglés y 250.000 para un
   español. Un separador de miles equivocado delata que el informe es una
   plantilla. */
export function fmt(n, moneda = 'EUR', locale = 'es-ES') {
  if (n == null) return '—';
  const simbolo = { EUR: '€', USD: '$', GBP: '£', CAD: 'CA$', AUD: 'A$' }[moneda] || '';
  return simbolo + Math.round(n).toLocaleString(locale);
}

export function num(n, decimales = 1, locale = 'es-ES') {
  if (n == null) return '—';
  return Number(n).toLocaleString(locale, {
    minimumFractionDigits: 0, maximumFractionDigits: decimales,
  });
}
