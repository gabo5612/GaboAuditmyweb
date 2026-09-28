/* Regresiones del bloque 2 de PENDIENTES.md: los siete hallazgos abiertos
   tras las primeras corridas reales. Ninguno rompía un test existente; los
   siete tocaban la credibilidad de una cifra impresa en el informe. */

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { comprobar, resumir, leerRobots, comprobar404, comprobarLlmsTxt } from '../src/seo.js';
import { leerMetadatos } from '../src/seo.js';
import { renderInformeSeo } from '../report/seo-template.js';
import { renderInforme } from '../report/template.js';
import { runPsi, elegirMediana } from '../src/psi.js';
import { auditar } from '../src/collect.js';
import { fetchRetry, unirUrl } from '../src/util.js';
import { interceptarFetch, respuesta, silenciar } from './helpers.js';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, '..');
const leer = p => readFile(p, 'utf8').then(JSON.parse);
const clon = o => JSON.parse(JSON.stringify(o));

let activo = null;
afterEach(() => { activo?.restaurar(); activo = null; });

const metaDe = (html, url = 'https://tienda.test/') =>
  leerMetadatos({ html, url, final_url: url, status: 200 });

function entrada({ robots, xRobotsTag = null, paginas } = {}) {
  return {
    origin: 'https://tienda.test',
    paginas: paginas || [{ rol: 'home', meta: metaDe('<title>Una tienda de prueba</title><h1>a</h1>') }],
    robots: robots || { existe: false, motivo: 'HTTP 404', sitemaps: [], disallow: [] },
    sitemap: { existe: false, motivo: 'HTTP 404', secciones: {} },
    notFound: { correcto: true, status: 404, url: 'https://tienda.test/no-existe' },
    duplicada: { medible: false, motivo: 'sin producto' },
    llms: { existe: false, url: 'https://tienda.test/llms.txt' },
    xRobotsTag,
  };
}

/* ── 1. Lo no medible no se pinta como aprobado ──────────────────── */

describe('hallazgo 1 · casillas de grupo', () => {
  test('una tienda sin robots.txt no enseña indexabilidad en verde completo', () => {
    const c = comprobar(entrada());
    const g = resumir(c).por_grupo.indexabilidad;

    // robots_txt falla y las dos que dependen de él salen no_medible.
    assert.equal(g.no_medible, 2);
    assert.equal(g.pasa + g.falla + g.aviso + g.no_medible + g.no_aplica, g.total);
    assert.equal(g.evaluadas, g.total - g.no_medible - g.no_aplica,
      'las evaluadas no incluyen lo que no se pudo medir');
    assert.ok(g.pasa < g.total - g.falla - g.aviso,
      'la resta vieja contaba los no_medible como aprobados');
  });

  test('el informe imprime aprobadas sobre evaluadas y cuenta lo no medido', () => {
    // Un grupo sin fallos pero con huecos: antes salía «4/4 ●» en verde.
    const comprobaciones = [
      { id: 'a', titulo: 'A', estado: 'pasa', grupo: 'indexabilidad', fuente: 'x', fecha: '2026-09-28' },
      { id: 'b', titulo: 'B', estado: 'pasa', grupo: 'indexabilidad', fuente: 'x', fecha: '2026-09-28' },
      { id: 'c', titulo: 'C', estado: 'no_medible', grupo: 'indexabilidad', fuente: 'x', fecha: '2026-09-28' },
      { id: 'd', titulo: 'D', estado: 'no_medible', grupo: 'indexabilidad', fuente: 'x', fecha: '2026-09-28' },
    ];
    const datos = {
      estado: 'ok', tipo: 'seo', tienda: { host: 'tienda.test' }, fecha_auditoria: '2026-09-28',
      paginas: [{ rol: 'home', url: 'https://tienda.test/' }], comprobaciones, resumen: resumir(comprobaciones),
      datos_faltantes: [],
    };
    const analisis = { idioma: 'es', diagnostico_una_linea: 'x', hallazgos: [], que_no_promete: 'x' };

    const html = renderInformeSeo(datos, analisis, {});
    const casilla = html.slice(html.indexOf('Rastreo e indexación'));
    assert.match(casilla, /2\/2/, 'dos aprobadas de dos evaluadas');
    assert.match(casilla, /2 sin medir/, 'los huecos se cuentan a la vista');
    assert.ok(!/4\/4/.test(html), 'nunca 4/4 con dos sin medir');
    assert.match(html, /class="vital vital--muted"/, 'con huecos no hay verde');
    assert.ok(!/class="vital vital--good"/.test(html));
  });
});

/* ── 2. X-Robots-Tag sólo se culpa cuando dice noindex ────────────── */

describe('hallazgo 2 · noindex y X-Robots-Tag', () => {
  test('una cabecera noarchive no se señala como causa de un meta noindex', () => {
    const home = metaDe('<title>Una tienda de prueba</title><meta name="robots" content="noindex"><h1>a</h1>');
    const c = comprobar(entrada({ xRobotsTag: 'noarchive', paginas: [{ rol: 'home', meta: home }] }));
    const n = c.find(x => x.id === 'noindex');

    assert.equal(n.estado, 'falla', 'el meta robots noindex sigue siendo un fallo');
    assert.ok(!/X-Robots-Tag/.test(n.valor), `culpaba a la cabecera: ${n.valor}`);
    assert.match(n.valor, /meta robots/);
    assert.ok(!/cabecera/i.test(n.fuente));
  });

  test('una cabecera noarchive sola no es un fallo', () => {
    const n = comprobar(entrada({ xRobotsTag: 'noarchive' })).find(x => x.id === 'noindex');
    assert.equal(n.estado, 'pasa');
  });

  test('con las dos causas a la vez se nombran las dos', () => {
    const home = metaDe('<title>Una tienda de prueba</title><meta name="robots" content="noindex"><h1>a</h1>');
    const n = comprobar(entrada({ xRobotsTag: 'noindex', paginas: [{ rol: 'home', meta: home }] }))
      .find(x => x.id === 'noindex');
    assert.match(n.valor, /X-Robots-Tag/);
    assert.match(n.valor, /meta robots/);
  });
});

/* ── 3. Sin dobles barras en las fuentes ──────────────────────────── */

describe('hallazgo 3 · URLs de fuente', () => {
  test('unirUrl no duplica la barra aunque la base termine en /', () => {
    assert.equal(unirUrl('https://x.com/', '/robots.txt'), 'https://x.com/robots.txt');
    assert.equal(unirUrl('https://x.com', '/robots.txt'), 'https://x.com/robots.txt');
  });

  test('con url_final acabada en / las fuentes salen limpias', async () => {
    activo = interceptarFetch([
      ['robots.txt', respuesta('User-agent: *\nDisallow: /cart\n', { url: 'https://x.com/robots.txt' })],
      ['llms.txt', respuesta('', { status: 404 })],
      [/.*/, respuesta('', { status: 404 })],
    ]);
    const robots = await leerRobots('https://x.com/');
    const nf = await comprobar404('https://x.com/');
    const llms = await comprobarLlmsTxt('https://x.com/');

    for (const u of [robots.fuente, nf.url, llms.url, ...activo.llamadas]) {
      assert.ok(!/[^:]\/\//.test(u), `doble barra: ${u}`);
    }
    const c = comprobar({ ...entrada(), origin: 'https://x.com/' });
    for (const x of c) {
      if (x.fuente) assert.ok(!/[^:]\/\//.test(x.fuente), `${x.id}: ${x.fuente}`);
    }
  });
});

/* ── 4. La ayuda del CLI dice 22 ──────────────────────────────────── */

describe('hallazgo 4 · el número publicado', () => {
  test('bin/seo.js no promete 21 comprobaciones', async () => {
    const fuente = await readFile(join(raiz, 'bin', 'seo.js'), 'utf8');
    assert.ok(!/\b21 comprobaciones/.test(fuente));
    assert.match(fuente, /22 comprobaciones/);
  });
});

/* ── 5. La URL impresa es la que se midió ─────────────────────────── */

describe('hallazgo 5 · www frente a ápex', () => {
  test('url_analizada sale de finalDisplayedUrl (Lighthouse 10+), no de la pedida', async () => {
    const psi = clon(await leer(join(aqui, 'fixtures', 'psi-mobile.json')));
    delete psi.lighthouseResult.finalUrl;
    psi.lighthouseResult.finalDisplayedUrl = 'https://naturvet.test/';
    activo = interceptarFetch([['pagespeedonline', respuesta(psi)]]);
    const callar = silenciar();
    const r = await runPsi('https://www.naturvet.test/', 'mobile');
    callar();
    assert.equal(r.url_analizada, 'https://naturvet.test/');
  });

  test('el JSON y el informe llevan la URL analizada', async () => {
    const { datos, analisis } = {
      datos: await leer(join(raiz, 'fixtures', 'ejemplo.audit.json')),
      analisis: await leer(join(raiz, 'fixtures', 'ejemplo.analysis.json')),
    };
    datos.rendimiento.movil.url_analizada = 'https://apex-medido.test/';
    const html = renderInforme(datos, analisis, {});
    assert.match(html, /apex-medido\.test/, 'el informe dice qué URL midió PSI');
  });
});

/* ── 6. Reintento tardío para cortes de red ───────────────────────── */

describe('hallazgo 6 · PSI de escritorio intermitente', () => {
  test('tras agotar los reintentos rápidos, un corte de red se reintenta una vez más', async () => {
    let n = 0;
    activo = interceptarFetch([['api.test', () => {
      n++;
      if (n <= 4) throw new TypeError('fetch failed');
      return respuesta({ ok: true });
    }]]);
    const res = await fetchRetry('https://api.test/x', { esperaBaseMs: 1, reintentoTardioMs: 5 });
    assert.equal(res.status, 200);
    assert.equal(n, 5, '1 + 3 reintentos rápidos + 1 tardío');
  });

  test('un 429 no gana reintento tardío: es el servidor diciendo que no', async () => {
    let n = 0;
    activo = interceptarFetch([['api.test', () => { n++; return respuesta({}, { status: 429 }); }]]);
    await assert.rejects(
      () => fetchRetry('https://api.test/x', { esperaBaseMs: 1, reintentoTardioMs: 5 }), /HTTP 429/);
    assert.equal(n, 4);
  });

  test('si escritorio sigue caído, la auditoría sale igual con el hueco declarado', async () => {
    const psi = await leer(join(aqui, 'fixtures', 'psi-mobile.json'));
    const html = '<html><head><script>Shopify.theme={"name":"D"}</script></head><body></body></html>';
    activo = interceptarFetch([
      [/pagespeedonline.*strategy=desktop/, () => { throw new TypeError('fetch failed'); }],
      ['pagespeedonline', respuesta(psi)],
      ['chromeuxreport', respuesta({}, { status: 404 })],
      ['/products.json', respuesta({ products: [] })],
      ['/collections.json', respuesta({ collections: [] })],
      ['tienda.test', respuesta(html, { url: 'https://tienda.test/', headers: { 'x-shopid': '9' } })],
    ]);
    const callar = silenciar();
    const r = await auditar('tienda.test', { psiOpciones: { esperaBaseMs: 1, reintentoTardioMs: 5 } });
    callar();

    assert.equal(r.estado, 'ok');
    assert.equal(r.rendimiento.escritorio, null);
    assert.ok(r.datos_faltantes.some(f => /escritorio/.test(f)));
    assert.equal(activo.llamadas.filter(u => u.includes('strategy=desktop')).length, 5,
      'probó el reintento tardío antes de rendirse');
  });
});

/* ── 7. Mediana de varias corridas móviles ────────────────────────── */

describe('hallazgo 7 · varianza del LCP móvil', () => {
  const corrida = (lcp, score, t) => ({
    score, metricas: { lcp_s: lcp }, fetch_time: t, url_analizada: 'https://t/', oportunidades: [],
  });

  test('elegirMediana publica la corrida del medio y el rango', () => {
    // Las tres de NaturVet, el mismo día.
    const m = elegirMediana([corrida(20.72, 48, 'b'), corrida(15.29, 55, 'a'), corrida(21.45, 46, 'c')]);
    assert.equal(m.metricas.lcp_s, 20.72);
    assert.equal(m.score, 48, 'score y LCP vienen de la misma corrida');
    assert.deepEqual(m.rango.lcp_s, [15.29, 21.45]);
    assert.deepEqual(m.rango.score, [46, 55]);
    assert.equal(m.corridas.length, 3);
    assert.match(m.criterio, /mediana de 3/);
  });

  test('con dos corridas gana la más rápida de las centrales', () => {
    const m = elegirMediana([corrida(21, 40, 'x'), corrida(15, 50, 'y')]);
    assert.equal(m.metricas.lcp_s, 15);
  });

  const psiConLcp = async (lcpMs, fetchTime) => {
    const p = clon(await leer(join(aqui, 'fixtures', 'psi-mobile.json')));
    p.lighthouseResult.audits['largest-contentful-paint'].numericValue = lcpMs;
    p.lighthouseResult.fetchTime = fetchTime;
    return p;
  };
  const rutasTienda = () => {
    const html = '<html><head><script>Shopify.theme={"name":"D"}</script></head><body></body></html>';
    return [
      ['chromeuxreport', respuesta({}, { status: 404 })],
      ['/products.json', respuesta({ products: [] })],
      ['/collections.json', respuesta({ collections: [] })],
      ['tienda.test', respuesta(html, { url: 'https://tienda.test/', headers: { 'x-shopid': '9' } })],
    ];
  };

  test('auditar mide N veces, publica la mediana y el dinero sale de ella', async () => {
    const moviles = [
      await psiConLcp(4000, '2026-09-28T10:00:00.000Z'),
      await psiConLcp(6000, '2026-09-28T10:01:10.000Z'),
      await psiConLcp(5000, '2026-09-28T10:02:20.000Z'),
    ];
    let i = 0;
    activo = interceptarFetch([
      [/pagespeedonline.*strategy=desktop/, respuesta(moviles[0])],
      ['pagespeedonline', () => respuesta(moviles[i++])],
      ...rutasTienda(),
    ]);
    const callar = silenciar();
    const r = await auditar('tienda.test', { corridas: 3, esperaCacheMs: 0, facturacion: 100000, moneda: 'USD' });
    callar();

    assert.equal(r.estado, 'ok');
    const m = r.rendimiento.movil;
    assert.equal(m.metricas.lcp_s, 5, 'la mediana, no la primera ni la peor');
    assert.equal(r.dinero.lcp_s, 5, 'money.js recibe la mediana');
    assert.equal(m.corridas.length, 3);
    assert.deepEqual(m.rango.lcp_s, [4, 6]);
  });

  test('una respuesta cacheada de PSI no cuenta como corrida', async () => {
    const a = await psiConLcp(4000, '2026-09-28T10:00:00.000Z');
    const b = await psiConLcp(6000, '2026-09-28T10:01:10.000Z');
    const secuencia = [a, a, b];   // la segunda es la misma respuesta cacheada
    let i = 0;
    activo = interceptarFetch([
      [/pagespeedonline.*strategy=desktop/, respuesta(a)],
      ['pagespeedonline', () => respuesta(secuencia[i++])],
      ...rutasTienda(),
    ]);
    const callar = silenciar();
    const r = await auditar('tienda.test', { corridas: 2, esperaCacheMs: 0 });
    callar();

    const m = r.rendimiento.movil;
    assert.equal(m.corridas.length, 2);
    assert.deepEqual(m.corridas.map(c => c.fetch_time),
      ['2026-09-28T10:00:00.000Z', '2026-09-28T10:01:10.000Z']);
    assert.equal(i, 3, 'repitió la petición en vez de dar la cacheada por buena');
  });

  test('si no se consiguen las N corridas se declara en datos_faltantes', async () => {
    const a = await psiConLcp(4000, '2026-09-28T10:00:00.000Z');
    activo = interceptarFetch([['pagespeedonline', respuesta(a)], ...rutasTienda()]);
    const callar = silenciar();
    const r = await auditar('tienda.test', { corridas: 3, esperaCacheMs: 0 });
    callar();

    assert.equal(r.estado, 'ok');
    assert.equal(r.rendimiento.movil.corridas.length, 1);
    assert.ok(r.datos_faltantes.some(f => /1 de 3 corridas/.test(f)));
  });

  test('el informe dice «mediana de N corridas» con el rango', async () => {
    const datos = await leer(join(raiz, 'fixtures', 'ejemplo.audit.json'));
    const analisis = await leer(join(raiz, 'fixtures', 'ejemplo.analysis.json'));
    Object.assign(datos.rendimiento.movil, elegirMediana([
      { ...datos.rendimiento.movil, metricas: { ...datos.rendimiento.movil.metricas, lcp_s: 4.1 }, score: 40, fetch_time: 'a' },
      { ...datos.rendimiento.movil, fetch_time: 'b' },
      { ...datos.rendimiento.movil, metricas: { ...datos.rendimiento.movil.metricas, lcp_s: 99 }, score: 10, fetch_time: 'c' },
    ]));
    const html = renderInforme(datos, analisis, {});
    assert.match(html, /(median of|mediana de) 3/);
    assert.match(html, /LCP 4\.1–99 s/);
  });
});
