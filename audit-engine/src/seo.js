/* Comprobaciones de SEO técnico de Shopify — la auditoría pequeña.

   Qué es: la parte del SEO que se puede verificar desde fuera, sin acceso
   a la tienda, sin API de pago y sin adivinar nada. Cada comprobación
   devuelve un estado, el valor medido, la evidencia que lo dispara y la
   fecha. Salen 21 y cuestan seis peticiones extra.

   Qué NO es: palabras clave, backlinks, intención de búsqueda ni calidad
   de contenido. Eso necesita Search Console del cliente y APIs de pago —
   y es exactamente el trabajo del sprint de 30 días. Regalarlo en la
   auditoría automática lo devalúa, y encima desde fuera no se puede medir
   sin inventar.

   Regla que gobierna el archivo: si algo no se puede comprobar, el estado
   es `no_medible` y se explica por qué. Nunca `pasa` por defecto — un
   falso "todo correcto" es peor que un hueco declarado, porque el cliente
   descubre el error él solo y ya no vuelve.

   Paridad con el motor de velocidad: mismas fuentes con fecha, mismo
   vocabulario de estados, misma prohibición de rellenar huecos. */

import { fetchRetry, today, unirUrl } from './util.js';

/** Estados posibles. `aviso` es un fallo menor o dependiente del contexto;
    `no_aplica` es una comprobación que esta tienda no necesita. */
export const ESTADOS = ['pasa', 'falla', 'aviso', 'no_aplica', 'no_medible'];

const FUENTE_HTML = 'HTML servido por la tienda';

/* ── Parseo, con las mismas limitaciones declaradas que page.js ───── */

const RE_JSONLD = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
const RE_META = /<meta\b[^>]*>/gi;
const RE_LINK = /<link\b[^>]*>/gi;
const RE_IMG = /<img\b[^>]*>/gi;
const RE_H1 = /<h1\b[^>]*>/gi;

/* Mismo lookbehind que page.js: en `<img :alt="x">` no hay un alt, hay una
   plantilla que el navegador rellena luego. */
const attr = (tag, nombre) => {
  const m = tag.match(new RegExp(`(?<![\\w:@.-])${nombre}\\s*=\\s*["']([^"']*)["']`, 'i'));
  return m ? m[1].trim() : null;   // null = ausente; '' = presente y vacío
};

/** Quita script/noscript/template antes de contar h1 e img, por lo mismo
    que page.js: dentro hay marcado de plantillas que no se renderiza. */
const sinPlantillas = html => String(html || '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '')
  .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, '');

const texto = s => String(s || '').replace(/\s+/g, ' ').trim();

function etiquetas(html, re) {
  const out = String(html || '').match(re) || [];
  re.lastIndex = 0;
  return out;
}

/** Metadatos de una página: lo que Google lee antes de leer nada más. */
export function leerMetadatos(pagina) {
  const html = pagina?.html || '';
  const limpio = sinPlantillas(html);

  const metas = etiquetas(html, RE_META).map(t => ({
    name: (attr(t, 'name') || '').toLowerCase(),
    property: (attr(t, 'property') || '').toLowerCase(),
    content: attr(t, 'content'),
  }));
  const links = etiquetas(html, RE_LINK).map(t => ({
    rel: (attr(t, 'rel') || '').toLowerCase().trim(),
    href: attr(t, 'href'),
    hreflang: attr(t, 'hreflang'),
  }));

  const meta = n => metas.find(m => m.name === n)?.content ?? null;
  const og = p => metas.find(m => m.property === p)?.content ?? null;

  const imgs = etiquetas(limpio, RE_IMG);
  const conSrc = imgs.filter(t => attr(t, 'src'));

  return {
    url: pagina.url,
    url_final: pagina.final_url || pagina.url,
    title: texto((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]),
    meta_description: texto(meta('description')),
    meta_robots: texto(meta('robots')),
    canonical: links.find(l => l.rel === 'canonical')?.href || null,
    h1: etiquetas(limpio, RE_H1).length,
    og_title: og('og:title'),
    og_image: og('og:image'),
    hreflang: links.filter(l => l.rel === 'alternate' && l.hreflang)
      .map(l => ({ hreflang: l.hreflang.toLowerCase(), href: l.href })),
    imagenes: {
      // Sólo las que traen src: las que pinta el cliente no se pueden juzgar.
      total: conSrc.length,
      /* `alt` ausente y `alt=""` no son lo mismo. El vacío es la forma
         correcta de marcar una imagen decorativa, y contarlo como fallo
         convierte un tema bien hecho en un hallazgo inventado. Sólo la
         ausencia del atributo es un fallo. */
      sin_alt: conSrc.filter(t => attr(t, 'alt') === null).length,
      alt_vacio: conSrc.filter(t => attr(t, 'alt') === '').length,
      renderizadas_por_js: imgs.length - conSrc.length,
    },
    json_ld: leerJsonLd(html),
    /* Microdatos: Google los acepta igual que el JSON-LD, y muchos temas
       antiguos sólo emiten eso. Sin leerlos, 4 de 14 «sin schema Product» del
       lote del 28 sep 2026 eran tiendas que lo tienen. */
    microdatos: {
      producto: /itemtype=["']https?:\/\/schema\.org\/(Product|ProductGroup)["']/i.test(html),
      precio: /itemprop=["']price["']/i.test(html),
      disponibilidad: /itemprop=["']availability["']/i.test(html),
    },
  };
}

/** Bloques JSON-LD, aplanando @graph, que es como los sirve la mitad de
    los temas. Un bloque que no parsea se cuenta como roto, no se ignora:
    Google tampoco lo lee. */
/* Tres casos, no dos (lote del 28 sep 2026, hawkinsnewyork.com):

   - vacío: un <script type="application/ld+json"></script> sin nada dentro
     no hace daño a nadie. No cuenta.
   - tolerable: sólo le sobran saltos de línea o tabuladores crudos dentro de
     una cadena (una descripción de producto pegada tal cual por Liquid).
     JSON.parse lo rechaza; el parser de Google es más tolerante, y afirmar
     que Google no lo lee sería inventar. Se lee igual —así se ve el Product
     que lleva dentro— y se cuenta aparte, como aviso.
   - roto: no se puede leer de ninguna manera. Eso sí es un fallo. */
export function leerJsonLd(html) {
  const bloques = [];
  let rotos = 0;
  let tolerables = 0;
  let m;
  while ((m = RE_JSONLD.exec(String(html || '')))) {
    const texto = m[1].trim();
    if (!texto) continue;
    let parsed;
    try {
      parsed = JSON.parse(texto);
    } catch {
      try {
        parsed = JSON.parse(escaparControlesEnCadenas(texto));
        tolerables++;
      } catch { rotos++; continue; }
    }
    for (const nodo of aplanar(parsed)) bloques.push(nodo);
  }
  RE_JSONLD.lastIndex = 0;

  return {
    tipos: [...new Set(bloques.map(b => tipoDe(b)).filter(Boolean))],
    bloques,
    rotos,
    tolerables,
  };
}

/** Escapa \n, \r y \t crudos, pero sólo dentro de cadenas JSON. */
function escaparControlesEnCadenas(t) {
  let out = '', enCadena = false, escape = false;
  for (const ch of t) {
    if (enCadena) {
      if (escape) { escape = false; out += ch; continue; }
      if (ch === '\\') { escape = true; out += ch; continue; }
      if (ch === '"') enCadena = false;
      out += ch === '\n' ? '\\n' : ch === '\r' ? '\\r' : ch === '\t' ? '\\t' : ch;
    } else {
      if (ch === '"') enCadena = true;
      out += ch;
    }
  }
  return out;
}

function aplanar(nodo) {
  if (Array.isArray(nodo)) return nodo.flatMap(aplanar);
  if (!nodo || typeof nodo !== 'object') return [];
  const hijos = Array.isArray(nodo['@graph']) ? nodo['@graph'].flatMap(aplanar) : [];
  return nodo['@type'] ? [nodo, ...hijos] : hijos;
}

const tipoDe = b => {
  const t = b?.['@type'];
  return Array.isArray(t) ? t[0] : t || null;
};
const buscarTipo = (jsonLd, tipo) =>
  (jsonLd?.bloques || []).find(b => {
    const t = b?.['@type'];
    return Array.isArray(t) ? t.includes(tipo) : t === tipo;
  }) || null;

/**
 * ¿Lo que hemos descargado es realmente el escaparate?
 *
 * Nace de un caso real: `gymshark.com` con un User-Agent que no es un
 * navegador acaba, tras la cadena de redirecciones, en
 * `us.checkout.gymshark.com`. Esa máquina es el checkout de Shopify y
 * sirve, con toda la razón, páginas sin título, sin h1 y sin metadatos.
 * La auditoría las leía y escupía cuatro fallos catastróficos sobre una
 * tienda impecable.
 *
 * El invariante del motor manda: si no se puede medir lo que se dice que
 * se mide, la auditoría falla. No se emite un informe sobre otro host.
 */
export function pareceEscaparate(meta, urlFinal) {
  const host = (() => { try { return new URL(urlFinal).hostname; } catch { return ''; } })();

  /* Una tienda cerrada redirige a /password (westernrise.com, 28 sep 2026:
     tema «Wind down: Store closed»). Auditarla es auditar una pantalla de
     contraseña, y escribirle es escribirle a un negocio que ya no vende. */
  if (/^\/password\/?$/i.test((() => { try { return new URL(urlFinal).pathname; } catch { return ''; } })())) {
    return { ok: false, motivo: `${host} redirige a /password: la tienda está cerrada al público` };
  }
  if (/(^|\.)checkout\./i.test(host)) {
    return { ok: false, motivo: `la cadena de redirecciones acaba en ${host}, que es el checkout de Shopify y no el escaparate` };
  }
  // Sin título y sin un solo h1 no es una plantilla de tienda: es una
  // pantalla de bloqueo, un muro de bots o una redirección a medias.
  if (!meta.title && meta.h1 === 0) {
    return { ok: false, motivo: `${host} devuelve una página sin <title> y sin ningún h1: no es una plantilla de tienda` };
  }
  return { ok: true };
}

/* ── Peticiones extra. Seis, y todas toleran el fallo ─────────────── */

async function texto200(url, timeout = 20000) {
  try {
    const res = await fetchRetry(url, { timeout, retries: 1 });
    return { ok: res.ok, status: res.status, cuerpo: res.ok ? await res.text() : '', headers: res.headers };
  } catch (err) {
    return { ok: false, status: null, cuerpo: '', error: String(err.message || err) };
  }
}

export async function leerRobots(origin) {
  const r = await texto200(unirUrl(origin, '/robots.txt'));
  if (!r.ok) return { existe: false, status: r.status, motivo: r.error || `HTTP ${r.status}`, sitemaps: [], disallow: [] };

  const lineas = r.cuerpo.split('\n').map(l => l.replace(/#.*$/, '').trim()).filter(Boolean);
  const sitemaps = lineas.filter(l => /^sitemap:/i.test(l)).map(l => l.replace(/^sitemap:\s*/i, '').trim());

  /* Hay que agrupar por User-agent, y no es un detalle de purista: el
     robots.txt que Shopify sirve por defecto termina con
     `User-agent: Nutch` + `Disallow: /`. Leer las líneas sueltas produce
     "esta tienda se bloquea entera a sí misma" sobre una tienda perfecta.
     Ése es justo el falso positivo que hunde el informe en la primera
     frase, así que sólo se evalúa el grupo de `*`. */
  const grupos = [];
  let actual = null;
  let esperandoAgentes = false;

  for (const linea of lineas) {
    const m = linea.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const directiva = m[1].toLowerCase();
    const valor = m[2].trim();

    if (directiva === 'user-agent') {
      if (!actual || !esperandoAgentes) {
        actual = { agentes: [], disallow: [], allow: [] };
        grupos.push(actual);
        esperandoAgentes = true;
      }
      actual.agentes.push(valor.toLowerCase());
      continue;
    }
    if (!actual) continue;
    esperandoAgentes = false;
    if (directiva === 'disallow') actual.disallow.push(valor);
    if (directiva === 'allow') actual.allow.push(valor);
  }

  const global = grupos.find(g => g.agentes.includes('*'));
  const disallow = global?.disallow ?? [];

  /* De ese grupo, Shopify bloquea por defecto variantes de orden, filtros
     y el checkout: correcto, y no es un hallazgo. Lo que sí lo es: que
     alguien haya editado robots.liquid y tapado el catálogo. */
  const bloqueosGraves = disallow.filter(d =>
    d === '/' || /^\/products(\/\*?)?$/.test(d) || /^\/collections(\/\*?)?$/.test(d) ||
    /^\/pages(\/\*?)?$/.test(d));

  return {
    existe: true,
    bytes: Buffer.byteLength(r.cuerpo),
    sitemaps,
    grupos: grupos.length,
    tiene_grupo_global: Boolean(global),
    disallow,
    bloqueos_graves: bloqueosGraves,
    alcance: 'sólo se evalúa el grupo User-agent: *; los grupos de bots concretos se ignoran a propósito',
    fuente: unirUrl(origin, '/robots.txt'),
  };
}

export async function leerSitemap(origin) {
  const r = await texto200(unirUrl(origin, '/sitemap.xml'));
  if (!r.ok) return { existe: false, status: r.status, motivo: r.error || `HTTP ${r.status}`, secciones: [] };

  const locs = [...r.cuerpo.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => m[1]);
  const esIndice = /<sitemapindex/i.test(r.cuerpo);
  const seccion = re => locs.filter(u => re.test(u)).length;

  return {
    existe: true,
    es_indice: esIndice,
    entradas: locs.length,
    secciones: {
      productos: seccion(/products/i),
      colecciones: seccion(/collections/i),
      paginas: seccion(/pages/i),
      blogs: seccion(/blogs/i),
    },
    /* No se descargan los sub-sitemaps: el de productos de una tienda
       grande pesa megas y esta auditoría tiene que correr en segundos
       sobre listas de cientos de dominios. El número de URLs indexables
       se declara como no medido en vez de estimarse. */
    alcance: 'sólo el índice; los sub-sitemaps no se descargan',
    fuente: unirUrl(origin, '/sitemap.xml'),
  };
}

export async function comprobar404(origin) {
  const url = unirUrl(origin, '/pagina-inexistente-auditoria-seo-0000');
  const r = await texto200(url, 15000);
  return {
    url,
    status: r.status,
    correcto: r.status === 404,
    // Un 200 en una URL inventada es un soft 404: Google indexa basura.
    soft_404: r.status === 200,
  };
}

export async function comprobarLlmsTxt(origin) {
  const r = await texto200(unirUrl(origin, '/llms.txt'), 12000);
  return { existe: Boolean(r.ok && r.cuerpo.trim()), status: r.status, url: unirUrl(origin, '/llms.txt') };
}

/**
 * La trampa clásica de Shopify: la misma ficha de producto vive en
 * /products/x y en /collections/y/products/x. La plataforma pone el
 * canonical correcto por defecto, pero los temas muy tocados lo rompen y
 * entonces cada producto compite consigo mismo en el índice.
 */
export async function comprobarRutaDuplicada(urlProducto, urlColeccion) {
  if (!urlProducto || !urlColeccion) {
    return { medible: false, motivo: 'no se localizaron a la vez una ficha de producto y una colección públicas' };
  }
  /* El producto tiene que pertenecer a la colección. Con uno que no está en
     ella, Shopify redirige o sirve otra cosa y el canonical apunta a la
     home: wildnutrition y beekman1802 «fallaban» así el 28 sep 2026. Se
     pide a la propia colección su primer producto; la muestra general queda
     de reserva. */
  let handle = null;
  try {
    // A mano: new URL('products.json', …/collections/x) sustituiría la «x».
    const r = await texto200(`${urlColeccion.replace(/\/$/, '')}/products.json?limit=1`);
    if (r.ok) handle = JSON.parse(r.cuerpo)?.products?.[0]?.handle || null;
  } catch { /* sin products.json de colección: se usa la muestra */ }
  if (handle) urlProducto = unirUrl(new URL(urlColeccion).origin, `/products/${handle}`);
  handle ||= urlProducto.split('/products/')[1]?.split(/[?#]/)[0];
  if (!handle) return { medible: false, motivo: 'la URL de producto no tiene el formato /products/<handle>' };

  const duplicada = `${urlColeccion.replace(/\/$/, '')}/products/${handle}`;
  const r = await texto200(duplicada);
  if (!r.ok) {
    // Que la ruta no exista es una respuesta válida y buena.
    return { medible: true, url: duplicada, status: r.status, existe: false, canonical: null, correcto: true };
  }

  const canonical = leerMetadatos({ url: duplicada, html: r.cuerpo }).canonical;
  return {
    medible: true,
    url: duplicada,
    status: r.status,
    existe: true,
    canonical,
    esperado: urlProducto,
    correcto: Boolean(canonical && mismaRuta(canonical, urlProducto)),
  };
}

/* Dos normalizaciones, las dos por falsos positivos del lote del 28 sep:

   - Prefijo de mercado. Con Shopify Markets, una IP europea recibe una
     redirección a /en-eu/products/x y su canonical, bien puesto, apunta a
     /en-eu/products/x. Googlebot rastrea desde EE. UU. y nunca ve ese
     prefijo. Auditando desde Berlín, sin esto, la tienda «fallaba» por
     nuestra ubicación. Se compara la ruta sin el segmento de idioma-mercado.
   - Codificación. %e2%84%a2 y %E2%84%A2 son la misma URL (RFC 3986 §6.2.2.1). */
const MERCADO = /^\/[a-z]{2}(?:-[a-z]{2})?(?=\/)/i;
export function rutaNormalizada(url) {
  const p = new URL(url).pathname
    .replace(/%[0-9a-f]{2}/gi, m => m.toUpperCase())
    .replace(MERCADO, '')
    .replace(/\/$/, '');
  return p || '/';
}
const mismaRuta = (a, b) => {
  try { return rutaNormalizada(a) === rutaNormalizada(b); }
  catch { return false; }
};

/* ── Las comprobaciones ───────────────────────────────────────────── */

const nuevo = (id, titulo, estado, extra = {}) => ({
  id, titulo, estado,
  valor: extra.valor ?? null,
  evidencia: extra.evidencia ?? null,
  url: extra.url ?? null,
  fuente: extra.fuente ?? FUENTE_HTML,
  fecha: today(),
  /* Grupo: el informe agrupa por aquí y el score pondera por aquí.
     indexabilidad > duplicados > metadatos > resultados enriquecidos. */
  grupo: extra.grupo || 'metadatos',
});

/**
 * @param {object} entrada
 * @param {string} entrada.origin
 * @param {object[]} entrada.paginas  [{ rol, ...cargarPagina() }]
 * @param {object} entrada.robots
 * @param {object} entrada.sitemap
 * @param {object} entrada.notFound
 * @param {object} entrada.duplicada
 * @param {object} entrada.llms
 * @param {string|null} entrada.xRobotsTag  cabecera X-Robots-Tag de la home
 */
export function comprobar({ origin, paginas, robots, sitemap, notFound, duplicada, llms, xRobotsTag }) {
  const c = [];
  const meta = Object.fromEntries(paginas.map(p => [p.rol, p.meta]));
  const home = meta.home;
  const producto = meta.producto || null;
  const coleccion = meta.coleccion || null;
  /* Una página que hace dos papeles — una tienda cuya home es su única
     colección — es una página, no dos. Contarla dos veces daría un
     `title_unico` en falla contra sí misma. */
  const conMeta = [...new Map(paginas.map(p => [p.meta.url_final, p.meta])).values()];

  /* ── Grupo 1: indexabilidad. Si algo de aquí falla, lo demás da igual ── */

  c.push(robots.existe
    ? nuevo('robots_txt', 'robots.txt accesible', 'pasa',
        { valor: `${robots.bytes} bytes`, fuente: robots.fuente, grupo: 'indexabilidad' })
    : nuevo('robots_txt', 'robots.txt accesible', 'falla',
        { valor: robots.motivo, fuente: unirUrl(origin, '/robots.txt'), grupo: 'indexabilidad' }));

  /* Las dos que dependen de robots.txt se emiten igual cuando no existe,
     como `no_medible`. Si no, el total baja a 20 y la web promete 22: un
     número que se desmonta solo no se publica. */
  if (!robots.existe) {
    c.push(
      nuevo('robots_bloqueos', 'robots.txt no bloquea el catálogo', 'no_medible',
        { valor: 'no hay robots.txt que leer', grupo: 'indexabilidad' }),
      nuevo('sitemap_declarado', 'Sitemap declarado en robots.txt', 'no_medible',
        { valor: 'no hay robots.txt que leer', grupo: 'indexabilidad' }),
    );
  } else {
    c.push(robots.bloqueos_graves?.length
      ? nuevo('robots_bloqueos', 'robots.txt no bloquea el catálogo', 'falla', {
          valor: `${robots.bloqueos_graves.length} regla(s) de bloqueo sobre rutas de catálogo`,
          evidencia: robots.bloqueos_graves.join(' · '),
          fuente: robots.fuente, grupo: 'indexabilidad',
        })
      : nuevo('robots_bloqueos', 'robots.txt no bloquea el catálogo', 'pasa',
          { valor: `${robots.disallow.length} reglas Disallow, ninguna sobre el catálogo`, fuente: robots.fuente, grupo: 'indexabilidad' }));

    c.push(robots.sitemaps?.length
      ? nuevo('sitemap_declarado', 'Sitemap declarado en robots.txt', 'pasa',
          { valor: robots.sitemaps[0], fuente: robots.fuente, grupo: 'indexabilidad' })
      : nuevo('sitemap_declarado', 'Sitemap declarado en robots.txt', 'falla',
          { valor: 'ninguna línea Sitemap:', fuente: robots.fuente, grupo: 'indexabilidad' }));
  }

  c.push(sitemap.existe
    ? nuevo('sitemap_xml', 'sitemap.xml servido y con secciones', 'pasa', {
        valor: `${sitemap.entradas} entradas en el índice`,
        evidencia: Object.entries(sitemap.secciones).filter(([, n]) => n).map(([k, n]) => `${k}: ${n}`).join(' · ') || null,
        fuente: sitemap.fuente, grupo: 'indexabilidad',
      })
    : nuevo('sitemap_xml', 'sitemap.xml servido y con secciones', 'falla',
        { valor: sitemap.motivo, fuente: unirUrl(origin, '/sitemap.xml'), grupo: 'indexabilidad' }));

  const xRobots = xRobotsTag || null;
  const bloqueadas = conMeta.filter(m => /noindex/i.test(m.meta_robots || ''));
  /* Se culpa a la cabecera sólo si ELLA dice noindex. Que exista no basta:
     `X-Robots-Tag: noarchive` es inocuo, y atribuirle el bloqueo manda al
     cliente a arreglar lo que no está roto mientras el meta robots de
     verdad sigue ahí. */
  const cabeceraNoindex = /noindex/i.test(xRobots || '');
  const motivos = [
    cabeceraNoindex && `cabecera X-Robots-Tag: ${xRobots}`,
    bloqueadas.length && `${bloqueadas.length} de ${conMeta.length} páginas con meta robots noindex`,
  ].filter(Boolean);
  c.push(motivos.length
    ? nuevo('noindex', 'Ninguna plantilla clave está en noindex', 'falla', {
        valor: motivos.join(' · '),
        evidencia: bloqueadas.map(m => m.url).join(' · ') || null,
        fuente: [cabeceraNoindex && 'cabeceras HTTP de respuesta', bloqueadas.length && FUENTE_HTML].filter(Boolean).join(' · '),
        grupo: 'indexabilidad',
      })
    : nuevo('noindex', 'Ninguna plantilla clave está en noindex', 'pasa',
        { valor: `${conMeta.length} páginas comprobadas`, grupo: 'indexabilidad' }));

  c.push(notFound.correcto
    ? nuevo('error_404', 'Las URLs inexistentes devuelven 404', 'pasa',
        { valor: `HTTP ${notFound.status}`, url: notFound.url, fuente: 'código de estado HTTP', grupo: 'indexabilidad' })
    : nuevo('error_404', 'Las URLs inexistentes devuelven 404', notFound.soft_404 ? 'falla' : 'aviso', {
        valor: notFound.status ? `HTTP ${notFound.status}` : 'sin respuesta',
        evidencia: notFound.soft_404 ? 'soft 404: una URL inventada devuelve 200 y es indexable' : null,
        url: notFound.url, fuente: 'código de estado HTTP', grupo: 'indexabilidad',
      }));

  /* ── Grupo 2: duplicados. La especialidad de Shopify ──────────────── */

  const sinCanonical = conMeta.filter(m => !m.canonical);
  c.push(sinCanonical.length
    ? nuevo('canonical_presente', 'Todas las plantillas declaran canonical', 'falla', {
        valor: `${sinCanonical.length} de ${conMeta.length} sin canonical`,
        evidencia: sinCanonical.map(m => m.url).join(' · '), grupo: 'duplicados',
      })
    : nuevo('canonical_presente', 'Todas las plantillas declaran canonical', 'pasa',
        { valor: `${conMeta.length} de ${conMeta.length}`, grupo: 'duplicados' }));

  const canonicalRaro = conMeta.filter(m => m.canonical && !mismaRuta(m.canonical, m.url_final));
  c.push(canonicalRaro.length
    ? nuevo('canonical_autoreferente', 'El canonical apunta a la propia página', 'aviso', {
        valor: `${canonicalRaro.length} canonical(s) apuntan a otra ruta`,
        evidencia: canonicalRaro.map(m => `${m.url_final} → ${m.canonical}`).join(' · '),
        grupo: 'duplicados',
      })
    : nuevo('canonical_autoreferente', 'El canonical apunta a la propia página', 'pasa',
        { valor: `${conMeta.filter(m => m.canonical).length} comprobados`, grupo: 'duplicados' }));

  c.push(!duplicada.medible
    ? nuevo('ruta_duplicada', 'La ruta /collections/*/products/* no duplica la ficha', 'no_medible',
        { valor: duplicada.motivo, grupo: 'duplicados' })
    : duplicada.correcto
      ? nuevo('ruta_duplicada', 'La ruta /collections/*/products/* no duplica la ficha', 'pasa', {
          valor: duplicada.existe ? `canonical → ${duplicada.canonical}` : `la ruta devuelve HTTP ${duplicada.status}`,
          url: duplicada.url, grupo: 'duplicados',
        })
      : nuevo('ruta_duplicada', 'La ruta /collections/*/products/* no duplica la ficha', 'falla', {
          valor: duplicada.canonical ? `canonical → ${duplicada.canonical}` : 'sin canonical',
          evidencia: `esperado: ${duplicada.esperado}`,
          url: duplicada.url, grupo: 'duplicados',
        }));

  const idiomas = home?.hreflang || [];
  c.push(!idiomas.length
    ? nuevo('hreflang', 'hreflang coherente con x-default', 'no_aplica',
        { valor: 'la home no declara versiones alternativas', grupo: 'duplicados' })
    : idiomas.some(h => h.hreflang === 'x-default')
      ? nuevo('hreflang', 'hreflang coherente con x-default', 'pasa',
          { valor: `${idiomas.length} versiones, x-default presente`, grupo: 'duplicados' })
      : nuevo('hreflang', 'hreflang coherente con x-default', 'aviso', {
          valor: `${idiomas.length} versiones declaradas, sin x-default`,
          evidencia: idiomas.map(h => h.hreflang).join(', '), grupo: 'duplicados',
        }));

  /* ── Grupo 3: metadatos ───────────────────────────────────────────── */

  const sinTitle = conMeta.filter(m => !m.title);
  const titleLargo = conMeta.filter(m => m.title && (m.title.length < 15 || m.title.length > 65));
  c.push(sinTitle.length
    ? nuevo('title_presente', 'Todas las plantillas tienen title', 'falla',
        { valor: `${sinTitle.length} de ${conMeta.length} sin title`, evidencia: sinTitle.map(m => m.url).join(' · ') })
    : titleLargo.length
      ? nuevo('title_presente', 'Todas las plantillas tienen title', 'aviso', {
          valor: `${titleLargo.length} title fuera del rango 15–65 caracteres`,
          evidencia: titleLargo.map(m => `${m.title.length} car.: ${m.title}`).join(' · '),
        })
      : nuevo('title_presente', 'Todas las plantillas tienen title', 'pasa',
          { valor: `${conMeta.length} de ${conMeta.length}, todos entre 15 y 65 caracteres` }));

  const titles = conMeta.map(m => m.title).filter(Boolean);
  c.push(new Set(titles).size === titles.length
    ? nuevo('title_unico', 'Cada plantilla tiene un title distinto', 'pasa', { valor: `${titles.length} títulos distintos` })
    : nuevo('title_unico', 'Cada plantilla tiene un title distinto', 'falla', {
        valor: `${titles.length - new Set(titles).size} title(s) repetido(s)`,
        evidencia: titles.join(' · '),
      }));

  const sinDesc = conMeta.filter(m => !m.meta_description);
  const descRara = conMeta.filter(m => m.meta_description && (m.meta_description.length < 70 || m.meta_description.length > 160));
  c.push(sinDesc.length
    ? nuevo('meta_description', 'Todas las plantillas tienen meta description', 'falla',
        { valor: `${sinDesc.length} de ${conMeta.length} sin meta description`, evidencia: sinDesc.map(m => m.url).join(' · ') })
    : descRara.length
      ? nuevo('meta_description', 'Todas las plantillas tienen meta description', 'aviso',
          { valor: `${descRara.length} fuera del rango 70–160 caracteres`, evidencia: descRara.map(m => `${m.meta_description.length} car.`).join(' · ') })
      : nuevo('meta_description', 'Todas las plantillas tienen meta description', 'pasa',
          { valor: `${conMeta.length} de ${conMeta.length}` }));

  const h1Mal = conMeta.filter(m => m.h1 !== 1);
  c.push(h1Mal.length
    ? nuevo('h1_unico', 'Un solo h1 por plantilla', 'aviso', {
        valor: `${h1Mal.length} de ${conMeta.length} fuera de norma`,
        evidencia: h1Mal.map(m => `${m.url}: ${m.h1} h1`).join(' · '),
      })
    : nuevo('h1_unico', 'Un solo h1 por plantilla', 'pasa', { valor: `${conMeta.length} de ${conMeta.length}` }));

  const imgTotal = conMeta.reduce((n, m) => n + m.imagenes.total, 0);
  const imgSinAlt = conMeta.reduce((n, m) => n + m.imagenes.sin_alt, 0);
  const imgAltVacio = conMeta.reduce((n, m) => n + m.imagenes.alt_vacio, 0);
  const contexto = `${imgAltVacio} más llevan alt vacío, que es lo correcto en una imagen decorativa`;
  c.push(!imgTotal
    ? nuevo('alt_imagenes', 'Las imágenes declaran texto alternativo', 'no_medible',
        { valor: 'ninguna <img> con src en el HTML inicial; el tema las pinta con JS' })
    : imgSinAlt / imgTotal > 0.2
      ? nuevo('alt_imagenes', 'Las imágenes declaran texto alternativo', 'falla', {
          valor: `${imgSinAlt} de ${imgTotal} imágenes sin atributo alt`,
          evidencia: `${contexto}. Medido sólo sobre el HTML inicial de las tres plantillas`,
        })
      : nuevo('alt_imagenes', 'Las imágenes declaran texto alternativo', imgSinAlt ? 'aviso' : 'pasa',
          { valor: `${imgSinAlt} de ${imgTotal} imágenes sin atributo alt`, evidencia: contexto }));

  /* ── Grupo 4: resultados enriquecidos y buscadores con IA ─────────── */

  c.push(...comprobarSchema(producto, coleccion, home));

  const sinOg = conMeta.filter(m => !m.og_title || !m.og_image);
  c.push(sinOg.length
    ? nuevo('open_graph', 'og:title y og:image en las plantillas clave', 'aviso', {
        valor: `${sinOg.length} de ${conMeta.length} incompletas`,
        evidencia: sinOg.map(m => m.url).join(' · '), grupo: 'enriquecidos',
      })
    : nuevo('open_graph', 'og:title y og:image en las plantillas clave', 'pasa',
        { valor: `${conMeta.length} de ${conMeta.length}`, grupo: 'enriquecidos' }));

  const rotos = conMeta.reduce((n, m) => n + m.json_ld.rotos, 0);
  const tolerables = conMeta.reduce((n, m) => n + (m.json_ld.tolerables || 0), 0);
  c.push(rotos
    ? nuevo('json_ld_valido', 'Ningún bloque JSON-LD roto', 'falla', {
        valor: `${rotos} bloque(s) no parsean`,
        evidencia: 'un JSON-LD que no parsea no lo lee nadie: equivale a no tenerlo',
        grupo: 'enriquecidos',
      })
    : tolerables ? nuevo('json_ld_valido', 'Ningún bloque JSON-LD roto', 'aviso', {
        valor: `${tolerables} bloque(s) con saltos de línea crudos dentro de una cadena`,
        evidencia: 'JSON estricto los rechaza; el parser de Google suele tolerarlos. Escaparlos cuesta una línea de Liquid (| json) y quita la duda',
        grupo: 'enriquecidos',
      })
    : nuevo('json_ld_valido', 'Ningún bloque JSON-LD roto', 'pasa',
        { valor: `${conMeta.reduce((n, m) => n + m.json_ld.bloques.length, 0)} bloques parseados`, grupo: 'enriquecidos' }));

  /* Informativo, no un fallo: llms.txt no es un estándar aprobado por
     nadie. Se mide porque es barato y porque abre conversación, no para
     apuntárselo como carencia. */
  c.push(nuevo('llms_txt', 'llms.txt para buscadores con IA', llms.existe ? 'pasa' : 'no_aplica', {
    valor: llms.existe ? 'presente' : 'ausente — propuesta emergente, todavía no es un estándar',
    url: llms.url, fuente: llms.url, grupo: 'enriquecidos',
  }));

  return c;
}

/** Los tres schemas que deciden si la tienda opta a resultados enriquecidos. */
function comprobarSchema(producto, coleccion, home) {
  const out = [];

  if (!producto) {
    // Las dos se emiten igual, en `no_medible`: el total no baja de 22.
    out.push(
      nuevo('schema_product', 'Schema Product completo en la ficha', 'no_medible',
        { valor: 'no se localizó una ficha de producto pública', grupo: 'enriquecidos' }),
      nuevo('schema_breadcrumb', 'BreadcrumbList en la ficha de producto', 'no_medible',
        { valor: 'no se localizó una ficha de producto pública', grupo: 'enriquecidos' }),
    );
  } else {
    /* ProductGroup es el tipo que Google pide para productos con variantes
       y el que usan los temas modernos. Buscar sólo `Product` daría un
       "no tienes schema" sobre tiendas que lo tienen bien puesto. */
    const p = buscarTipo(producto.json_ld, 'Product') || buscarTipo(producto.json_ld, 'ProductGroup');
    const micro = producto.microdatos || {};
    if (!p && micro.producto) {
      out.push(nuevo('schema_product', 'Schema Product completo en la ficha', micro.precio && micro.disponibilidad ? 'pasa' : 'aviso', {
        valor: micro.precio && micro.disponibilidad
          ? 'Product en microdatos, con price y availability'
          : `Product en microdatos, sin ${[!micro.precio && 'price', !micro.disponibilidad && 'availability'].filter(Boolean).join(' ni ')}`,
        url: producto.url, grupo: 'enriquecidos',
      }));
    } else if (!p) {
      /* Aviso, no fallo: el motor no ejecuta JavaScript y Google sí. En el
         lote del 28 sep, 4 de las 14 fichas «sin Product» lo tenían al
         renderizar, inyectado por una app. Afirmar que falta sin haberlo
         renderizado es el falso positivo que termina la venta. */
      out.push(nuevo('schema_product', 'Schema Product completo en la ficha', 'aviso', {
        valor: 'sin Product ni ProductGroup en el HTML inicial (ni JSON-LD ni microdatos)',
        evidencia: `${producto.json_ld.tipos.length ? `tipos presentes: ${producto.json_ld.tipos.join(', ')}. ` : ''}Si una app lo inyecta con JavaScript, Google puede verlo: confirmarlo en el Rich Results Test antes de afirmar que falta`,
        url: producto.url, grupo: 'enriquecidos',
      }));
    } else {
      /* En un ProductGroup el precio vive en las variantes. Campo a campo:
         el grupo puede traer `offers` sin availability y las variantes, sí. */
      const variante = [].concat(p.hasVariant || [])[0] || {};
      const ofertaP = [].concat(p.offers || [])[0] || {};
      const ofertaV = [].concat(variante.offers || [])[0] || {};
      const de = k => ofertaP[k] ?? ofertaV[k];
      const faltan = [
        ['name', p.name ?? variante.name],
        ['image', p.image ?? variante.image],
        ['offers.price', de('price') ?? de('lowPrice')],
        ['offers.priceCurrency', de('priceCurrency')],
        ['offers.availability', de('availability')],
      ].filter(([, v]) => v == null || v === '').map(([k]) => k);

      out.push(faltan.length
        ? nuevo('schema_product', 'Schema Product completo en la ficha', 'falla', {
            valor: `${tipoDe(p)} presente, faltan ${faltan.length} campos obligatorios: ${faltan.join(', ')}`,
            evidencia: 'sin ellos Google no muestra precio ni disponibilidad en el resultado',
            url: producto.url, grupo: 'enriquecidos',
          })
        : nuevo('schema_product', 'Schema Product completo en la ficha', 'pasa',
            { valor: `${tipoDe(p)} con name, image, price, priceCurrency y availability`, url: producto.url, grupo: 'enriquecidos' }));
    }

    const b = buscarTipo(producto.json_ld, 'BreadcrumbList');
    out.push(b
      ? nuevo('schema_breadcrumb', 'BreadcrumbList en la ficha de producto', 'pasa',
          { valor: `${(b.itemListElement || []).length} niveles`, url: producto.url, grupo: 'enriquecidos' })
      : nuevo('schema_breadcrumb', 'BreadcrumbList en la ficha de producto', 'aviso',
          { valor: 'ausente — el resultado muestra la URL en vez de la ruta de categorías', url: producto.url, grupo: 'enriquecidos' }));
  }

  const org = home ? (buscarTipo(home.json_ld, 'Organization') || buscarTipo(home.json_ld, 'WebSite')) : null;
  out.push(org
    ? nuevo('schema_organization', 'Organization o WebSite en la home', 'pasa',
        { valor: tipoDe(org), url: home.url, grupo: 'enriquecidos' })
    : nuevo('schema_organization', 'Organization o WebSite en la home', 'aviso',
        { valor: 'ausente — sin señal de marca para el panel de conocimiento', url: home?.url || null, grupo: 'enriquecidos' }));

  if (coleccion) {
    const tipos = coleccion.json_ld.tipos;
    out.push(tipos.includes('ItemList') || tipos.includes('CollectionPage')
      ? nuevo('schema_coleccion', 'ItemList o CollectionPage en la colección', 'pasa',
          { valor: tipos.join(', '), url: coleccion.url, grupo: 'enriquecidos' })
      : nuevo('schema_coleccion', 'ItemList o CollectionPage en la colección', 'aviso',
          { valor: tipos.length ? `sólo ${tipos.join(', ')}` : 'ningún JSON-LD', url: coleccion.url, grupo: 'enriquecidos' }));
  } else {
    out.push(nuevo('schema_coleccion', 'ItemList o CollectionPage en la colección', 'no_medible',
      { valor: 'no se localizó una colección pública', grupo: 'enriquecidos' }));
  }

  return out;
}

/** Recuento por estado y por grupo. Es el titular del informe: contable,
    comprobable y sin una sola cifra que no salga de esta misma lista. */
export function resumir(comprobaciones) {
  const porEstado = Object.fromEntries(ESTADOS.map(e => [e, 0]));
  const porGrupo = {};

  for (const c of comprobaciones) {
    porEstado[c.estado] = (porEstado[c.estado] || 0) + 1;
    /* Cada estado por separado, no `total − falla − aviso`: esa resta
       contaba `no_medible` como aprobado, y una tienda sin robots.txt salía
       con un 6/6 verde en indexabilidad. Un hueco pintado como aprobado es
       el aviso tranquilizador y falso que este motor existe para no dar. */
    porGrupo[c.grupo] ??= { total: 0, pasa: 0, falla: 0, aviso: 0, no_aplica: 0, no_medible: 0 };
    porGrupo[c.grupo].total++;
    if (c.estado in porGrupo[c.grupo]) porGrupo[c.grupo][c.estado]++;
  }

  const evaluadas = porEstado.pasa + porEstado.falla + porEstado.aviso;
  return {
    total: comprobaciones.length,
    evaluadas,
    ...porEstado,
    por_grupo: Object.fromEntries(Object.entries(porGrupo).map(([k, v]) => [k, {
      ...v,
      // Lo que de verdad se juzgó: sin lo no medible y sin lo que no aplica.
      evaluadas: v.pasa + v.falla + v.aviso,
    }])),
    /* Porcentaje sobre las evaluadas, no sobre el total: lo que no se pudo
       medir no cuenta ni a favor ni en contra. */
    salud_pct: evaluadas ? Math.round((porEstado.pasa / evaluadas) * 100) : null,
  };
}
