/* Auditoría de SEO técnico.

   La mitad de estos tests existe por un falso positivo concreto que el
   motor produjo contra una tienda real. Cada uno lleva escrito cuál, para
   que nadie los "simplifique" más adelante: son la memoria de los cuatro
   errores que habrían hundido un informe en la primera frase. */

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  leerMetadatos, leerJsonLd, leerRobots, comprobarRutaDuplicada,
  comprobar, resumir, pareceEscaparate,
} from '../src/seo.js';
import { calcularScoreSeo } from '../src/score.js';
import { validarAnalisisSeo } from '../src/validate.js';
import { interceptarFetch, respuesta } from './helpers.js';

let activo = null;
afterEach(() => { activo?.restaurar(); activo = null; });

/* ── Parseo del HTML ──────────────────────────────────────────────── */

describe('leerMetadatos', () => {
  const html = `<!DOCTYPE html><html><head>
    <title data-next-head="">Tienda de prueba · Zapatillas</title>
    <meta name="description" content="Una descripción de la tienda">
    <meta name="robots" content="index, follow">
    <meta property="og:title" content="Tienda">
    <link rel="canonical" href="https://tienda.test/">
    <link rel="alternate" hreflang="es-ES" href="https://tienda.test/es">
    <link rel="alternate" hreflang="x-default" href="https://tienda.test/">
    </head><body><h1>Hola</h1>
    <img src="/a.jpg" alt="Un zapato">
    <img src="/b.jpg" alt="">
    <img src="/c.jpg">
    <template><img src="/plantilla.jpg"></template>
    </body></html>`;

  test('lee title, description, canonical y hreflang', () => {
    const m = leerMetadatos({ url: 'https://tienda.test/', html });
    assert.equal(m.title, 'Tienda de prueba · Zapatillas');
    assert.equal(m.meta_description, 'Una descripción de la tienda');
    assert.equal(m.canonical, 'https://tienda.test/');
    assert.equal(m.h1, 1);
    assert.equal(m.og_title, 'Tienda');
    assert.equal(m.hreflang.length, 2);
    assert.ok(m.hreflang.some(h => h.hreflang === 'x-default'));
  });

  test('alt vacío no es alt ausente', () => {
    // Falso positivo real: contar alt="" como fallo convierte un tema bien
    // hecho —imagen decorativa marcada como tal— en un hallazgo inventado.
    const m = leerMetadatos({ url: 'https://tienda.test/', html });
    assert.equal(m.imagenes.total, 3, 'la <img> dentro de <template> no cuenta');
    assert.equal(m.imagenes.sin_alt, 1, 'sólo la que no declara el atributo');
    assert.equal(m.imagenes.alt_vacio, 1);
  });
});

describe('leerJsonLd', () => {
  test('aplana @graph y cuenta los bloques rotos', () => {
    const html = `
      <script type="application/ld+json">{"@graph":[{"@type":"Organization","name":"X"},{"@type":"WebSite"}]}</script>
      <script type="application/ld+json">{ esto no es json }</script>`;
    const j = leerJsonLd(html);
    assert.deepEqual(j.tipos.sort(), ['Organization', 'WebSite']);
    assert.equal(j.rotos, 1, 'un JSON-LD que no parsea no lo lee nadie');
  });
});

/* ── robots.txt ───────────────────────────────────────────────────── */

describe('leerRobots', () => {
  test('sólo evalúa el grupo User-agent: *', async () => {
    /* Falso positivo real, contra allbirds.com: el robots.txt que Shopify
       sirve de serie termina con `User-agent: Nutch` + `Disallow: /`.
       Leyendo las líneas sueltas, el motor anunciaba que la tienda se
       bloqueaba entera a sí misma. */
    const cuerpo = [
      'User-agent: *',
      'Disallow: /admin',
      'Disallow: /checkout',
      'Sitemap: https://tienda.test/sitemap.xml',
      '',
      'User-agent: Nutch',
      'Disallow: /',
    ].join('\n');

    activo = interceptarFetch([['robots.txt', respuesta(cuerpo)]]);
    const r = await leerRobots('https://tienda.test');

    assert.equal(r.existe, true);
    assert.deepEqual(r.bloqueos_graves, [], 'el Disallow de Nutch no es de la tienda');
    assert.deepEqual(r.disallow, ['/admin', '/checkout']);
    assert.equal(r.sitemaps.length, 1);
  });

  test('sí detecta un bloqueo real del catálogo', async () => {
    activo = interceptarFetch([['robots.txt', respuesta('User-agent: *\nDisallow: /collections\n')]]);
    const r = await leerRobots('https://tienda.test');
    assert.deepEqual(r.bloqueos_graves, ['/collections']);
  });

  test('ignora los comentarios', async () => {
    activo = interceptarFetch([['robots.txt', respuesta('User-agent: *\n# Disallow: /\nDisallow: /admin\n')]]);
    const r = await leerRobots('https://tienda.test');
    assert.deepEqual(r.bloqueos_graves, []);
  });
});

/* ── La trampa de las dos URLs por producto ───────────────────────── */

describe('comprobarRutaDuplicada', () => {
  const producto = 'https://tienda.test/products/zapato';
  const coleccion = 'https://tienda.test/collections/verano';

  test('pasa cuando el canonical apunta a la ficha real', async () => {
    activo = interceptarFetch([[
      '/collections/verano/products/zapato',
      respuesta('<link rel="canonical" href="https://tienda.test/products/zapato">'),
    ]]);
    const r = await comprobarRutaDuplicada(producto, coleccion);
    assert.equal(r.correcto, true);
  });

  test('falla cuando la ruta larga se declara canónica de sí misma', async () => {
    activo = interceptarFetch([[
      '/collections/verano/products/zapato',
      respuesta('<link rel="canonical" href="https://tienda.test/collections/verano/products/zapato">'),
    ]]);
    const r = await comprobarRutaDuplicada(producto, coleccion);
    assert.equal(r.correcto, false, 'cada producto compitiendo consigo mismo');
  });

  test('sin producto o sin colección no se inventa un veredicto', async () => {
    const r = await comprobarRutaDuplicada(producto, null);
    assert.equal(r.medible, false);
    assert.match(r.motivo, /colecci/i);
  });
});

/* ── El conjunto de comprobaciones ────────────────────────────────── */

const metaDe = (html, url = 'https://tienda.test/') => leerMetadatos({ url, html });

function entrada({ producto = null, coleccion = null, robots, sitemap, xRobotsTag = null } = {}) {
  const paginas = [{ rol: 'home', meta: metaDe('<title>Una tienda de prueba</title><h1>a</h1>') }];
  if (producto) paginas.push({ rol: 'producto', meta: producto });
  if (coleccion) paginas.push({ rol: 'coleccion', meta: coleccion });

  return {
    origin: 'https://tienda.test',
    paginas,
    robots: robots || { existe: false, motivo: 'HTTP 404', sitemaps: [], disallow: [] },
    sitemap: sitemap || { existe: false, motivo: 'HTTP 404', secciones: {} },
    notFound: { correcto: true, status: 404, url: 'https://tienda.test/no-existe' },
    duplicada: { medible: false, motivo: 'sin producto' },
    llms: { existe: false, url: 'https://tienda.test/llms.txt' },
    xRobotsTag,
  };
}

describe('comprobar', () => {
  test('siempre emite 22 comprobaciones con id único', () => {
    /* La web publica el número 22. Si una comprobación desapareciera
       cuando no se puede medir, el total bajaría y la cifra publicada
       sería mentira. Lo no medible se declara, no se borra. */
    const c = comprobar(entrada());
    assert.equal(c.length, 22);
    assert.equal(new Set(c.map(x => x.id)).size, 22);

    const r = resumir(c);
    assert.deepEqual(
      Object.fromEntries(Object.entries(r.por_grupo).map(([k, v]) => [k, v.total])),
      { indexabilidad: 6, duplicados: 4, metadatos: 5, enriquecidos: 7 },
    );
  });

  test('cada comprobación arrastra fuente y fecha', () => {
    for (const c of comprobar(entrada())) {
      assert.ok(c.fuente, `${c.id} sin fuente`);
      assert.match(c.fecha, /^\d{4}-\d{2}-\d{2}$/, `${c.id} sin fecha`);
    }
  });

  test('ProductGroup cuenta como schema de producto', () => {
    /* Falso positivo real: buscar sólo `Product` daba "no tienes schema"
       sobre tiendas con variantes que lo tienen bien puesto — que es el
       tipo que Google pide para ellas. */
    const jsonLd = JSON.stringify({
      '@type': 'ProductGroup',
      name: 'Zapato',
      image: 'https://tienda.test/a.jpg',
      hasVariant: [{ '@type': 'Product', offers: { price: '90', priceCurrency: 'EUR', availability: 'InStock' } }],
    });
    const producto = metaDe(`<title>Zapato en la tienda</title><h1>Z</h1>
      <script type="application/ld+json">${jsonLd}</script>`, 'https://tienda.test/products/zapato');

    const c = comprobar(entrada({ producto }));
    const schema = c.find(x => x.id === 'schema_product');
    assert.equal(schema.estado, 'pasa');
    assert.match(schema.valor, /ProductGroup/);
  });

  test('un Product sin precio se marca con los campos que faltan', () => {
    const jsonLd = JSON.stringify({ '@type': 'Product', name: 'Zapato', image: 'x.jpg' });
    const producto = metaDe(`<title>Zapato en la tienda</title><h1>Z</h1>
      <script type="application/ld+json">${jsonLd}</script>`, 'https://tienda.test/products/zapato');

    const schema = comprobar(entrada({ producto })).find(x => x.id === 'schema_product');
    assert.equal(schema.estado, 'falla');
    assert.match(schema.valor, /offers\.price/);
  });

  test('una página con dos papeles cuenta una vez en las comprobaciones por página', () => {
    const home = metaDe('<title>Una tienda de prueba</title><h1>a</h1><script type="application/ld+json">{"@type":"ItemList"}</script>');
    const e = entrada();
    e.paginas = [{ rol: 'home', meta: home }, { rol: 'coleccion', meta: home }];
    const c = comprobar(e);
    assert.equal(c.find(x => x.id === 'title_unico').estado, 'pasa');
    assert.equal(c.find(x => x.id === 'schema_coleccion').estado, 'pasa');
  });

  test('un noindex por cabecera se detecta aunque el HTML esté limpio', () => {
    const c = comprobar(entrada({ xRobotsTag: 'noindex, nofollow' }));
    const noindex = c.find(x => x.id === 'noindex');
    assert.equal(noindex.estado, 'falla');
    assert.match(noindex.fuente, /cabecera/i);
  });

  test('sin hreflang la comprobación no aplica, no falla', () => {
    const h = comprobar(entrada()).find(x => x.id === 'hreflang');
    assert.equal(h.estado, 'no_aplica', 'una tienda de un solo mercado no tiene una carencia');
  });

  test('llms.txt ausente no es un fallo', () => {
    const l = comprobar(entrada()).find(x => x.id === 'llms_txt');
    assert.equal(l.estado, 'no_aplica', 'todavía no es un estándar aprobado por nadie');
  });
});

describe('resumir', () => {
  test('la salud se calcula sobre las evaluadas, no sobre el total', () => {
    const r = resumir([
      { id: 'a', estado: 'pasa', grupo: 'metadatos' },
      { id: 'b', estado: 'falla', grupo: 'metadatos' },
      { id: 'c', estado: 'no_medible', grupo: 'metadatos' },
    ]);
    assert.equal(r.evaluadas, 2);
    assert.equal(r.salud_pct, 50, 'lo que no se pudo medir no cuenta ni a favor ni en contra');
  });
});

/* ── ¿Es esto el escaparate? ──────────────────────────────────────── */

describe('pareceEscaparate', () => {
  test('rechaza el dominio de checkout de Shopify', () => {
    /* Falso positivo real, contra gymshark.com: la cadena de
       redirecciones acababa en us.checkout.gymshark.com y el informe
       anunciaba cuatro fallos catastróficos sobre una tienda impecable. */
    const meta = metaDe('<title>x</title><h1>y</h1>');
    const r = pareceEscaparate(meta, 'https://us.checkout.gymshark.com/');
    assert.equal(r.ok, false);
    assert.match(r.motivo, /checkout/);
  });

  test('rechaza una página sin title y sin ningún h1', () => {
    const r = pareceEscaparate(metaDe('<div>nada</div>'), 'https://tienda.test/');
    assert.equal(r.ok, false);
  });

  test('acepta una plantilla de tienda normal', () => {
    const r = pareceEscaparate(metaDe('<title>Tienda</title><h1>Hola</h1>'), 'https://tienda.test/');
    assert.equal(r.ok, true);
  });
});

/* ── Lead score ───────────────────────────────────────────────────── */

describe('calcularScoreSeo', () => {
  const base = { tema: null, moneda: null, host: 'tienda.test', facturacionRango: null };

  test('una tienda con la base técnica en orden baja al final de la cola', () => {
    const s = calcularScoreSeo({
      ...base,
      resumen: { falla: 0, evaluadas: 22, por_grupo: {} },
      comprobaciones: [],
    });
    assert.equal(s.prioridad, 'baja');
    assert.ok(s.señales.some(x => x.puntos === -40), 'la regla honesta tiene que dispararse');
  });

  test('indexabilidad rota y sin schema de producto sube la prioridad', () => {
    const s = calcularScoreSeo({
      ...base,
      moneda: 'USD',
      resumen: { falla: 4, evaluadas: 22, por_grupo: { indexabilidad: { falla: 2, aviso: 0 } } },
      comprobaciones: [{ id: 'schema_product', estado: 'falla' }],
    });
    assert.equal(s.prioridad, 'alta');
    assert.equal(s.geo.pais, 'US');
  });
});

/* ── Validación del análisis ──────────────────────────────────────── */

describe('validarAnalisisSeo', () => {
  const datos = {
    comprobaciones: [
      { id: 'meta_description', estado: 'falla', valor: '1 de 3 sin meta description' },
      { id: 'sitemap_xml', estado: 'pasa', valor: '6 entradas' },
    ],
    resumen: { falla: 3 },
  };

  const hallazgo = (extra = {}) => ({
    titulo: 'Falta la meta description de la colección',
    que_pasa: 'La plantilla no imprime la etiqueta.',
    por_que_importa: 'Google escribe el fragmento por su cuenta.',
    evidencia: { comprobacion: 'meta_description', valor: '1 de 3 sin meta description', fuente: 'HTML', fecha: '2026-08-12' },
    que_haria: 'Añadir el campo en la plantilla de colección.',
    verificable_como: 'Ver el código fuente y buscar meta name="description".',
    impacto: 'medio',
    esfuerzo_horas: 1,
    ...extra,
  });

  const analisis = (extra = {}) => ({
    diagnostico_una_linea: 'Tres de 22 comprobaciones fallan.',
    hallazgos: [hallazgo()],
    plan_4_semanas: [1, 2, 3, 4].map(n => ({
      semana: n, objetivo: 'o', tareas: ['t'], resultado_esperado: 'r',
      verificable_como: n === 4 ? 'la misma auditoría, repetida' : null,
    })),
    quick_win_regalado: { titulo: 'q', pasos: ['p'], mejora_estimada: 'm', requiere_dev: false },
    que_no_promete: 'No promete posiciones ni una fecha para ellas.',
    confianza: 'media',
    datos_faltantes: [],
    ...extra,
  });

  test('acepta un análisis bien formado', () => {
    const r = validarAnalisisSeo(analisis(), datos);
    assert.equal(r.ok, true, r.errores.join(' · '));
  });

  test('rechaza un hallazgo sobre una comprobación que no existe', () => {
    const r = validarAnalisisSeo(analisis({
      hallazgos: [hallazgo({ evidencia: { comprobacion: 'inventada', valor: 'x', fuente: 'y', fecha: '2026-08-12' } })],
    }), datos);
    assert.equal(r.ok, false);
    assert.ok(r.errores.some(e => /inventado/.test(e)));
  });

  test('rechaza un hallazgo colgado de una comprobación que pasa', () => {
    const r = validarAnalisisSeo(analisis({
      hallazgos: [hallazgo({ evidencia: { comprobacion: 'sitemap_xml', valor: 'x', fuente: 'y', fecha: '2026-08-12' } })],
    }), datos);
    assert.equal(r.ok, false);
    assert.ok(r.errores.some(e => /no es un problema/.test(e)));
  });

  test('rechaza los euros: sin volumen de búsqueda cualquier importe es inventado', () => {
    const r = validarAnalisisSeo(analisis({
      hallazgos: [hallazgo({ por_que_importa: 'Te cuesta unos 3.000 € al mes de facturación.' })],
    }), datos);
    assert.equal(r.ok, false);
    assert.ok(r.errores.some(e => /dinero/.test(e)));
  });

  test('rechaza las promesas de posición', () => {
    const r = validarAnalisisSeo(analisis({
      hallazgos: [hallazgo({ que_haria: 'Arreglarlo y te subo a la primera página.' })],
    }), datos);
    assert.equal(r.ok, false);
    assert.ok(r.errores.some(e => /posiciones|tr[áa]fico/.test(e)));
  });

  test('exige que_no_promete', () => {
    const r = validarAnalisisSeo(analisis({ que_no_promete: '' }), datos);
    assert.equal(r.ok, false);
  });

  test('con un solo fallo obliga a confianza baja', () => {
    const r = validarAnalisisSeo(analisis({ confianza: 'alta' }), { ...datos, resumen: { falla: 1 } });
    assert.equal(r.ok, false);
    assert.ok(r.errores.some(e => /confianza/.test(e)));
  });

  test('el plan tiene cuatro semanas, no tres', () => {
    const r = validarAnalisisSeo(analisis({
      plan_4_semanas: [1, 2, 3].map(n => ({ semana: n, objetivo: 'o', tareas: ['t'], resultado_esperado: 'r' })),
    }), datos);
    assert.equal(r.ok, false);
  });
});
