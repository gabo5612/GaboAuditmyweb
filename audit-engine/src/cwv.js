/* Core Web Vitals con usuarios reales: qué falla, según el p75 de CrUX.

   Es la misma evaluación que enseña PageSpeed Insights arriba del todo
   («Core Web Vitals Assessment: Failed»), y por eso es el gancho del
   correo: el prospecto la comprueba en un clic. Los umbrales son los de
   Google (web.dev/articles/vitals): LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1.

   Una sola función para el correo y el informe: si cada uno decidiera por
   su cuenta qué «falla», acabarían diciendo cosas distintas. */

export const UMBRALES = { lcp_ms: 2500, inp_ms: 200, cls: 0.1 };

/**
 * @param {object} campo el bloque `campo` de la auditoría (CrUX History)
 * @returns {null | { fallas: Array<{metrica, valor, umbral, texto}>, fecha, fuente }}
 *   null si no hay dato de usuarios reales; `fallas` vacío si aprueba.
 */
export function fallasCampo(campo) {
  if (!campo?.disponible) return null;
  const s = campo.series || {};
  const ultimo = k => {
    const v = s[k]?.ultimo;
    return Number.isFinite(Number(v)) ? Number(v) : null;
  };
  const lcp = ultimo('largest_contentful_paint');
  const inp = ultimo('interaction_to_next_paint');
  const cls = ultimo('cumulative_layout_shift');

  const fallas = [];
  if (lcp != null && lcp > UMBRALES.lcp_ms) {
    fallas.push({ metrica: 'LCP', valor: lcp, umbral: UMBRALES.lcp_ms, texto: `LCP ${(lcp / 1000).toFixed(1)} s` });
  }
  if (inp != null && inp > UMBRALES.inp_ms) {
    fallas.push({ metrica: 'INP', valor: inp, umbral: UMBRALES.inp_ms, texto: `INP ${Math.round(inp)} ms` });
  }
  if (cls != null && cls > UMBRALES.cls) {
    fallas.push({ metrica: 'CLS', valor: cls, umbral: UMBRALES.cls, texto: `CLS ${cls.toFixed(2)}` });
  }
  return { fallas, fecha: campo.fecha, fuente: campo.fuente };
}
