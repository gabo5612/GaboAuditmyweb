/* Score de calificación del lead, 0-100 (doc §①).

   No filtra a nadie: ordena. Sirve para saber a quién grabas el Loom
   primero cuando tienes 20 informes esperando y dos horas. */

const GEO_OBJETIVO = {
  USD: 'US', CAD: 'CA', GBP: 'UK', AUD: 'AU',
};
const TLD_GEO = {
  '.co.uk': 'UK', '.uk': 'UK', '.ca': 'CA', '.com.au': 'AU', '.au': 'AU', '.us': 'US',
};

export function calcularScore({ psiMovil, apps, tema, moneda, host, facturacionRango, dinero = null }) {
  const señales = [];
  let total = 0;

  const suma = (puntos, señal, evidencia) => {
    total += puntos;
    señales.push({ señal, puntos, evidencia });
  };

  const score = psiMovil?.score;
  if (score != null && score < 40) {
    suma(30, 'PageSpeed móvil por debajo de 40', `score ${score}`);
  }
  if (score != null && score > 75) {
    // Doc §③ regla 6: un "tu tienda va bien" honesto gana más respeto que un
    // informe inflado. Este −40 es lo que empuja ese caso al final de la cola.
    suma(-40, 'PageSpeed móvil por encima de 75 — poco que vender', `score ${score}`);
  }
  /* Si los usuarios reales ya ven el LCP en «good», un score de laboratorio
     bajo no es una venta: es un correo que el prospecto desmiente. */
  if (dinero?.base === 'campo' && dinero.lcp_s <= 2.5) {
    suma(-40, 'Usuarios reales ya con LCP en «good» (CrUX p75)', `${dinero.lcp_s}s`);
  }
  if (apps?.total > 15) {
    suma(20, 'Más de 15 apps detectadas', `${apps.total} apps`);
  }

  const geo = detectarGeo(moneda, host);
  if (geo.pais && ['US', 'UK', 'CA', 'AU'].includes(geo.pais)) {
    suma(20, `Geo objetivo: ${geo.pais}`, geo.evidencia);
  }
  if (facturacionRango && /alto|high|\+/.test(String(facturacionRango))) {
    suma(20, 'Rango de facturación declarado alto', String(facturacionRango));
  }
  if (tema?.a_medida) {
    suma(10, 'Tema a medida o premium — invierten en su tienda', tema.nombre || 'sin nombre');
  }

  return {
    total: Math.max(0, Math.min(100, total)),
    señales,
    geo,
    prioridad: total >= 60 ? 'alta' : total >= 30 ? 'media' : 'baja',
  };
}

/**
 * Score del lead para la auditoría SEO. Mismo propósito que el de
 * velocidad — ordenar la cola, no filtrar a nadie — y misma regla honesta:
 * una tienda con el SEO técnico en orden baja al final, porque no hay nada
 * que venderle sin inventárselo.
 */
export function calcularScoreSeo({ resumen, comprobaciones, tema, moneda, host, facturacionRango }) {
  const señales = [];
  let total = 0;
  const suma = (puntos, señal, evidencia) => {
    total += puntos;
    señales.push({ señal, puntos, evidencia });
  };
  const falla = id => comprobaciones.some(c => c.id === id && c.estado === 'falla');
  const grupo = g => resumen.por_grupo?.[g] || { falla: 0, aviso: 0 };

  // Indexabilidad rota es urgente y se explica en una frase por teléfono.
  if (grupo('indexabilidad').falla) {
    suma(30, 'Fallos de indexabilidad', `${grupo('indexabilidad').falla} comprobación(es) de robots, sitemap, noindex o 404`);
  }
  // Sin schema Product no hay precio ni disponibilidad en el resultado de
  // búsqueda. Es el hallazgo que más fácil se demuestra en pantalla.
  if (falla('schema_product')) {
    suma(25, 'Schema Product incompleto o ausente', 'la ficha no opta a resultado enriquecido');
  }
  if (grupo('duplicados').falla) {
    suma(15, 'Contenido duplicado', `${grupo('duplicados').falla} comprobación(es) de canonical o rutas duplicadas`);
  }
  if (grupo('metadatos').falla >= 2) {
    suma(10, 'Metadatos por defecto o incompletos', `${grupo('metadatos').falla} comprobaciones de title, description o h1`);
  }

  const geo = detectarGeo(moneda, host);
  if (geo.pais && ['US', 'UK', 'CA', 'AU'].includes(geo.pais)) {
    suma(20, `Geo objetivo: ${geo.pais}`, geo.evidencia);
  }
  if (facturacionRango && /alto|high|\+/.test(String(facturacionRango))) {
    suma(20, 'Rango de facturación declarado alto', String(facturacionRango));
  }
  if (tema?.a_medida) {
    suma(10, 'Tema a medida o premium — invierten en su tienda', tema.nombre || 'sin nombre');
  }

  // Espejo de la regla 6 del prompt de velocidad.
  if (resumen.falla <= 1) {
    suma(-40, 'El SEO técnico está en orden — poco que vender', `${resumen.falla} comprobación(es) fallida(s) de ${resumen.evaluadas}`);
  }

  return {
    total: Math.max(0, Math.min(100, total)),
    señales,
    geo,
    prioridad: total >= 60 ? 'alta' : total >= 30 ? 'media' : 'baja',
  };
}

export function detectarGeo(moneda, host) {
  if (moneda && GEO_OBJETIVO[moneda]) {
    return { pais: GEO_OBJETIVO[moneda], evidencia: `moneda activa ${moneda}`, confianza: 'media' };
  }
  for (const [tld, pais] of Object.entries(TLD_GEO)) {
    if (host?.endsWith(tld)) return { pais, evidencia: `dominio ${tld}`, confianza: 'alta' };
  }
  return { pais: null, evidencia: null, confianza: null };
}

/** Moneda activa, del objeto Shopify.currency del HTML. */
export function detectarMoneda(html) {
  const m = html?.match(/Shopify\.currency\s*=\s*(\{[^;]*\})/);
  if (!m) return null;
  try { return JSON.parse(m[1]).active || null; } catch { return null; }
}
