/* Descarga y parseo del HTML de home, ficha de producto y colección.

   Parseo con expresiones regulares y sin dependencias, a propósito: el
   workflow de GitHub Actions arranca sin `npm install`. A cambio, sólo se
   extrae lo que se puede extraer con fiabilidad: atributos de etiquetas
   concretas. Nada que dependa de entender la estructura del documento. */

import { fetchRetry, hostOf, log, unirUrl } from './util.js';

const RE_SCRIPT = /<script[^>]+src=["']([^"']+)["']/gi;
const RE_LINK_TAG = /<link\b[^>]*>/gi;
const RE_IMG = /<img\b[^>]*>/gi;
/* El lookbehind evita capturar los atributos enlazados de Vue/Alpine:
   en `<img :src="producto.imagen">` no hay una imagen real, hay una
   plantilla que el navegador rellena luego. Sin esto, los ejemplos del
   informe salen con cosas como `cardRefs[` dentro. */
/* La comilla de cierre es la misma que la de apertura, capturada con un
   retroceso. Sin él, `alt="Australia's best"` se corta en "Australia", y el
   apóstrofo es comunísimo en el copy de tiendas en inglés. */
const RE_ATTR = attr => new RegExp(`(?<![\\w:@.-])${attr}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i');
/** El valor del atributo, o null si no está. */
const valorAttr = (tag, attr) => (tag.match(RE_ATTR(attr)) || [])[2] ?? null;
const RE_FONT_FACE = /@font-face\s*\{[^}]*\}/gi;
// Protocolo-relativo incluido: Shopify sirve //cdn.shopify.com/...
const RE_ARCHIVO_FUENTE = /(?:https?:)?\/\/[^"'\s)]+\.(?:woff2?|ttf|otf)/gi;

/** rel que provocan una descarga de verdad. `alternate` (hreflang) y
    `canonical` apuntan a otros dominios pero no cargan nada: contarlos como
    terceros infla el número y te deja en evidencia en la primera frase. */
const RELS_QUE_CARGAN = new Set(['stylesheet', 'preload', 'modulepreload', 'prefetch', 'icon', 'apple-touch-icon']);

/** Quita el contenido de script/noscript/template: dentro hay <img> de
    plantillas JS que no son imágenes reales de la página. */
function sinPlantillas(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, '');
}

/** Descarga una página y extrae lo que necesitamos de ella. */
export async function cargarPagina(url) {
  try {
    const res = await fetchRetry(url, { timeout: 45000, retries: 2 });
    if (!res.ok) return { url, error: `HTTP ${res.status}` };
    const html = await res.text();
    return {
      url,
      final_url: res.url,
      html,
      bytes: Buffer.byteLength(html),
      recursos: extraerRecursos(html, res.url),
      imagenes: analizarImagenes(sinPlantillas(html)),
      fuentes: analizarFuentes(html),
    };
  } catch (err) {
    return { url, error: String(err.message || err) };
  }
}

function absolutizar(href, base) {
  try { return new URL(href, base).href; } catch { return href; }
}

function extraerRecursos(html, base) {
  const scripts = [], links = [], meta = [];
  let m;

  while ((m = RE_SCRIPT.exec(html))) scripts.push(absolutizar(m[1], base));
  RE_SCRIPT.lastIndex = 0;

  while ((m = RE_LINK_TAG.exec(html))) {
    const tag = m[0];
    const href = valorAttr(tag, 'href');
    if (!href) continue;
    const rel = (valorAttr(tag, 'rel') || '').toLowerCase().trim();
    const destino = absolutizar(href, base);
    (RELS_QUE_CARGAN.has(rel) ? links : meta).push(destino);
  }
  RE_LINK_TAG.lastIndex = 0;

  return {
    scripts: [...new Set(scripts)],
    links: [...new Set(links)],   // sólo lo que se descarga de verdad
    meta: [...new Set(meta)],     // hreflang, canonical… se guardan, no se analizan
  };
}

/**
 * Imágenes: lazy loading, formato moderno, srcset y dimensiones declaradas.
 *
 * Lo que NO se mide aquí: si una imagen se sirve a más resolución de la que
 * se muestra. Eso necesita renderizar la página, así que se toma de la
 * oportunidad `uses-responsive-images` de Lighthouse en vez de estimarlo.
 */
export function analizarImagenes(html) {
  const tags = html.match(RE_IMG) || [];
  const total = tags.length;
  let sin_lazy = 0, sin_formato_moderno = 0, sin_srcset = 0, sin_dimensiones = 0;
  let renderizadas_por_js = 0;
  const ejemplos_sin_lazy = [];

  tags.forEach((tag, i) => {
    const src = valorAttr(tag, 'src') || '';
    const loading = valorAttr(tag, 'loading') || '';
    const srcset = RE_ATTR('srcset').test(tag);
    const w = RE_ATTR('width').test(tag), h = RE_ATTR('height').test(tag);

    // <img :src> / <img v-bind:src>: la pinta el cliente, no viene en el HTML.
    if (!src) renderizadas_por_js++;

    // Las primeras imágenes son la marca de agua y el hero: ésas deben cargar
    // con prioridad, no en diferido. Sólo contamos a partir de la tercera.
    if (i >= 2 && loading.toLowerCase() !== 'lazy') {
      sin_lazy++;
      if (ejemplos_sin_lazy.length < 5 && src) ejemplos_sin_lazy.push(src);
    }
    /* El CDN de Shopify negocia el formato: el mismo «.jpg» llega como WebP a
       un navegador que lo acepta (comprobado el 28 sep 2026 con Accept:
       image/webp). Contarlo daría «147 de 150 sin formato moderno» a una
       tienda que ya los sirve modernos. */
    const cdnShopify = /(^|\/\/)(cdn\.shopify\.com\/|[^/]+\/cdn\/shop\/)|^\/cdn\/shop\//i.test(src || '');
    if (src && !cdnShopify && !/\.(webp|avif)(\?|$)/i.test(src) && /\.(jpe?g|png)(\?|$)/i.test(src)) sin_formato_moderno++;
    if (!srcset) sin_srcset++;
    if (!w || !h) sin_dimensiones++; // sin dimensiones declaradas → CLS
  });

  return {
    total, sin_lazy, sin_formato_moderno, sin_srcset, sin_dimensiones,
    renderizadas_por_js, ejemplos_sin_lazy,
  };
}

/** Fuentes: cuántas familias, cuántos pesos, y si hay font-display: swap. */
function analizarFuentes(html) {
  const caras = html.match(RE_FONT_FACE) || [];
  const familias = new Set();
  let con_swap = 0;

  for (const cara of caras) {
    const familia = (cara.match(/font-family\s*:\s*["']?([^;"'}]+)/i) || [])[1];
    if (familia) familias.add(familia.trim());
    if (/font-display\s*:\s*(swap|optional|fallback)/i.test(cara)) con_swap++;
  }

  const googleFonts = (html.match(/fonts\.googleapis\.com\/css2?\?[^"']+/gi) || []);
  const archivos = [...new Set(html.match(RE_ARCHIVO_FUENTE) || [])];

  return {
    familias_declaradas: [...familias],
    caras_font_face: caras.length,
    caras_con_font_display: con_swap,
    // font-display ausente = texto invisible mientras carga la fuente (FOIT)
    falta_font_display: caras.length > 0 && con_swap < caras.length,
    google_fonts: googleFonts.length,
    google_fonts_sin_display: googleFonts.filter(u => !/display=/i.test(u)).length,
    archivos_fuente: archivos.length,
    // Sólo se ve el CSS embebido en el HTML. Si el tema declara las fuentes
    // en una hoja externa, esto sale a cero y no significa que no haya
    // problema — significa que aquí no se puede saber.
    alcance: 'sólo CSS embebido en el HTML; las hojas externas no se descargan',
  };
}

/**
 * Encuentra una ficha de producto y una colección reales de la tienda.
 * Primero por los endpoints públicos de Shopify; si están capados, por los
 * enlaces del propio HTML de la home.
 */
/* Primero lo que la home enlaza, y sólo si no enlaza nada, products.json.
   products.json empieza por lo último creado, que en muchas tiendas es un
   complemento o una copia oculta a propósito («headboard-add-on-cherry»,
   «…-sachet-5ml-copy»): el lote del 28 sep 2026 marcó 7 de 60 tiendas con
   «plantilla en noindex» por eso, y en esas páginas el noindex es correcto.
   Lo que la home enlaza es lo que la tienda quiere público: ahí un noindex
   sí es un fallo. */
export async function descubrirPaginas(origin, homeHtml) {
  /* /collections/x/products/y es la misma ficha en otra ruta, y su canonical
     apunta —bien— a /products/y: tomarla como muestra haría fallar
     «canonical autorreferente» a una tienda que lo tiene correcto. */
  const enlazado = primerEnlace(homeHtml, origin, '/products/');
  const producto = (enlazado && enlazado.replace(/\/collections\/[^/]+(?=\/products\/)/, ''))
    || await primerHandle(unirUrl(origin, '/products.json?limit=1'), 'products');
  const coleccion = primerEnlace(homeHtml, origin, '/collections/', /\/collections\/(all|frontpage|vendors|types)(\/|$)/)
    || await primerHandle(unirUrl(origin, '/collections.json?limit=1'), 'collections');

  log(`  · producto: ${producto || 'no encontrado'}`);
  log(`  · colección: ${coleccion || 'no encontrada'}`);
  return { producto, coleccion };
}

async function primerHandle(url, clave) {
  try {
    const res = await fetchRetry(url, { timeout: 20000, retries: 1 });
    if (!res.ok) return null;
    const data = await res.json();
    const handle = data?.[clave]?.[0]?.handle;
    return handle ? new URL(`/${clave}/${handle}`, url).href : null;
  } catch { return null; }
}

function primerEnlace(html, origin, prefijo, excluir = null) {
  if (!html) return null;
  const re = new RegExp(`href=["']([^"']*${prefijo}[^"'?#]+)`, 'gi');
  for (const m of html.matchAll(re)) {
    const abs = absolutizar(m[1], origin);
    if (hostOf(abs) !== hostOf(origin)) continue;
    // /collections/all y compañía son listados automáticos, no una colección
    // que alguien haya montado; /collections/x/products/y es un producto.
    if (excluir && excluir.test(new URL(abs).pathname)) continue;
    if (prefijo === '/collections/' && /\/products\//.test(abs)) continue;
    // Una tarjeta regalo no tiene descripción ni schema de producto que
    // juzgar: como muestra, sólo produce «falta meta description».
    if (prefijo === '/products/' && /gift-?card/i.test(abs)) continue;
    return abs;
  }
  return null;
}
