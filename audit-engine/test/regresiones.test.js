/* Regresiones encontradas en la revisión de código.

   Cada test fija un fallo concreto que llegó a estar en el motor. Todos
   compartían la misma forma: no rompían nada, producían un número o un
   color tranquilizador y falso. */

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { calcularPerdida, PERDIDA_MAXIMA, OBJETIVO_LCP_S, PERDIDA_POR_S } from '../src/money.js';
import { renderInforme } from '../report/template.js';
import { auditar } from '../src/collect.js';
import { cargarPagina } from '../src/page.js';
import { detectarApps } from '../src/apps.js';
import { interceptarFetch, respuesta, silenciar } from './helpers.js';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, '..');
const clon = o => JSON.parse(JSON.stringify(o));
const cargar = async () => ({
  datos: JSON.parse(await readFile(join(raiz, 'fixtures', 'ejemplo.audit.json'), 'utf8')),
  analisis: JSON.parse(await readFile(join(raiz, 'fixtures', 'ejemplo.analysis.json'), 'utf8')),
});

let activo = null;
afterEach(() => { activo?.restaurar(); activo = null; });

describe('la fórmula impresa evalúa al número impreso', () => {
  /* El tope del 45% se aplicaba al resultado pero no aparecía en la fórmula,
     así que en tiendas con LCP por encima de 8,1 s el informe enseñaba una
     ecuación que daba otra cosa. Y son justo las tiendas que este motor
     busca. */
  const umbral = OBJETIVO_LCP_S + PERDIDA_MAXIMA / PERDIDA_POR_S;  // 8,125 s

  /* La fórmula imprime el LCP redondeado a un decimal, así que rehacer la
     cuenta a mano puede desviarse un poco. Lo que no puede es desviarse un
     20%, que es lo que pasaba cuando el tope se aplicaba en silencio. */
  const cuadra = (r, etiqueta) => {
    const desvio = Math.abs(evaluar(r.formula) - r.perdida_importe);
    assert.ok(desvio <= r.perdida_importe * 0.01 + 1,
      `${etiqueta}: la fórmula "${r.formula}" da ${evaluar(r.formula)}, se muestra ${r.perdida_importe}`);
  };

  test('sin tope, la ecuación se lee tal cual', () => {
    const r = calcularPerdida(4.2, 250000, 'EUR', 'es-ES');
    assert.equal(r.tope_aplicado, false);
    assert.ok(!/mín|min/.test(r.formula));
    cuadra(r, 'lcp 4,2');
  });

  test('con tope, la fórmula lo dice y sigue cuadrando', () => {
    const r = calcularPerdida(9.2, 250000, 'EUR', 'es-ES');
    assert.equal(r.tope_aplicado, true);
    assert.equal(r.perdida_pct, PERDIDA_MAXIMA);
    assert.ok(r.formula.includes(`mín(${PERDIDA_MAXIMA}%`), `fórmula: ${r.formula}`);
    cuadra(r, 'lcp 9,2');

    // Sin el arreglo, la ecuación impresa daba 134.000 y se mostraba 112.500.
    const sinTope = `${'€250.000'} × (9,2s − 2,5s) × 8%/s`;
    assert.ok(Math.abs(evaluarIzquierda(sinTope) - r.perdida_importe) > r.perdida_importe * 0.15,
      'el test tiene que distinguir la fórmula arreglada de la rota');
  });

  test('cuadra a los dos lados del umbral, con y sin facturación', () => {
    for (const lcp of [umbral - 0.1, umbral, umbral + 0.1, 15, 30]) {
      cuadra(calcularPerdida(lcp, 250000, 'EUR', 'es-ES'), `lcp ${lcp}`);

      const sinFact = calcularPerdida(lcp, null, 'EUR', 'es-ES');
      const pct = Number(sinFact.formula.split('=')[1].replace('%', '').trim().replace(',', '.'));
      assert.ok(Math.abs(pct - sinFact.perdida_pct) <= 0.5, `lcp ${lcp}: ${sinFact.formula}`);
    }
  });

  test('el supuesto explica el tope sólo cuando se ha aplicado', () => {
    const capado = calcularPerdida(12, 100000).supuestos.join(' ');
    assert.match(capado, /sin él la estimación sería/);
    const normal = calcularPerdida(4, 100000).supuestos.join(' ');
    assert.match(normal, /no ha hecho falta aplicarlo/);
  });

  /** Resuelve la fórmula impresa tal y como la leería el desarrollador del
      cliente, que es exactamente para lo que está puesta en el informe.
      Sólo entiende el formato es-ES, que es el que usan estos tests. */
  const evaluar = formula => evaluarIzquierda(formula.split('=')[0]);

  function evaluarIzquierda(izquierda) {
    const n = s => Number(String(s).replace(/[€$£\s]/g, '').replace(/\./g, '').replace(',', '.'));
    const facturacion = n(izquierda.split('×')[0]);
    const [, lcp, objetivo] = izquierda.match(/\(([\d,.]+)s − ([\d,.]+)s\)/);
    const tasa = (n(lcp) - n(objetivo)) * PERDIDA_POR_S;
    const tope = izquierda.match(/mín\((\d+)%/);
    const pct = tope ? Math.min(Number(tope[1]), tasa) : tasa;
    return Math.round(facturacion * pct / 100);
  }
});

describe('un hueco nunca se pinta como un aprobado', () => {
  test('sin LCP no hay estimación, ni siquiera 0', () => {
    for (const vacio of [null, undefined, NaN, 0]) {
      const r = calcularPerdida(vacio, 250000);
      assert.equal(r.medible, false, `entrada ${vacio}`);
      assert.equal(r.perdida_pct, null, 'un 0% tranquiliza y miente');
      assert.equal(r.perdida_importe, null);
      assert.equal(r.formula, null);
    }
  });

  test('el titular muestra una raya, no un cero', async () => {
    const { datos, analisis } = await cargar();
    const d = clon(datos), a = clon(analisis);
    d.dinero = calcularPerdida(null, null, 'USD', 'en-US');
    a.coste_estimado_mensual.valor = null;
    a.coste_estimado_mensual.porcentaje = null;

    const html = renderInforme(d, a, {});
    assert.match(html.match(/class="bignum">([\s\S]*?)<\/div>/)[1], /^—/);
    assert.ok(html.includes('not measured'));
    assert.ok(!html.includes('class="formula mono"'), 'sin fórmula que enseñar, no se enseña');
  });

  test('CLS y TBT ausentes no salen en verde', async () => {
    const { datos, analisis } = await cargar();
    const d = clon(datos);
    d.rendimiento.movil.metricas.cls = null;
    d.rendimiento.movil.metricas.tbt_ms = null;

    // `null <= 0.1` es true en JavaScript: sin guarda, el punto verde de
    // "bien" acaba junto a una raya.
    const html = renderInforme(d, analisis, {});
    assert.ok(!/vital--good/.test(html.match(/<div class="vitals">[\s\S]*?<\/div>\s*<\/div>/)[0]),
      'ninguna métrica ausente puede quedar en estado "good"');
  });

  test('collect.js declara el hueco cuando PSI no trae LCP', async () => {
    const psi = JSON.parse(await readFile(join(aqui, 'fixtures', 'psi-mobile.json'), 'utf8'));
    delete psi.lighthouseResult.audits['largest-contentful-paint'].numericValue;

    activo = interceptarFetch([
      ['/products.json', respuesta({ products: [] })],
      ['/collections.json', respuesta({ collections: [] })],
      ['pagespeedonline', respuesta(psi)],
      ['chromeuxreport', respuesta({}, { status: 404 })],
      ['tienda.test', respuesta('<html><head><script>Shopify.theme={"name":"D"}</script></head><body></body></html>',
        { url: 'https://tienda.test/', headers: { 'x-shopid': '9' } })],
    ]);
    const callar = silenciar();
    const r = await auditar('tienda.test');
    callar();

    assert.equal(r.estado, 'ok');
    assert.equal(r.dinero.medible, false);
    assert.ok(r.datos_faltantes.some(f => /Largest Contentful Paint/.test(f)));
  });
});

describe('los fallos de red producen un resultado, no una traza', () => {
  test('un dominio inalcanzable devuelve estado fallida', async () => {
    activo = interceptarFetch([[/.*/, () => { throw new Error('getaddrinfo ENOTFOUND'); }]]);
    const callar = silenciar();
    const r = await auditar('dominio-muerto.test', {});
    callar();

    assert.equal(r.estado, 'fallida');
    assert.equal(r.codigo, 'inalcanzable');
    assert.match(r.motivo, /ENOTFOUND/);
    assert.ok(Array.isArray(r.datos_faltantes));
  }, { timeout: 90000 });

  test('un fallo de CrUX no tumba una auditoría por lo demás completa', async () => {
    process.env.CRUX_API_KEY = 'k';
    const psi = JSON.parse(await readFile(join(aqui, 'fixtures', 'psi-mobile.json'), 'utf8'));
    activo = interceptarFetch([
      ['chromeuxreport', () => { throw new Error('socket hang up'); }],
      ['/products.json', respuesta({ products: [] })],
      ['/collections.json', respuesta({ collections: [] })],
      ['pagespeedonline', respuesta(psi)],
      ['tienda.test', respuesta('<html><head><script>Shopify.theme={"name":"D"}</script></head><body></body></html>',
        { url: 'https://tienda.test/', headers: { 'x-shopid': '9' } })],
    ]);
    const callar = silenciar();
    const r = await auditar('tienda.test');
    callar();
    delete process.env.CRUX_API_KEY;

    // CrUX es una fuente opcional: su fallo se declara, no se propaga.
    assert.equal(r.estado, 'ok');
    assert.equal(r.campo.disponible, false);
    assert.ok(r.datos_faltantes.some(f => /usuarios reales/.test(f)));
  }, { timeout: 90000 });

  test('CrUX se consulta con el origen posterior a la redirección', async () => {
    process.env.CRUX_API_KEY = 'k';
    const psi = JSON.parse(await readFile(join(aqui, 'fixtures', 'psi-mobile.json'), 'utf8'));
    const html = '<html><head><script>Shopify.theme={"name":"D"}</script></head><body></body></html>';

    // El origen viaja en el cuerpo del POST, no en la URL: hay que leerlo ahí.
    let consultado = null;
    activo = interceptarFetch([
      ['chromeuxreport', (url, o) => {
        consultado = JSON.parse(o.body).origin;
        return respuesta({}, { status: 404 });
      }],
      ['/products.json', respuesta({ products: [] })],
      ['/collections.json', respuesta({ collections: [] })],
      ['pagespeedonline', respuesta(psi)],
      ['https://www.tienda.test', respuesta(html, { url: 'https://www.tienda.test/', headers: { 'x-shopid': '9' } })],
      ['https://tienda.test', (url, o) => o.redirect === 'manual'
        ? respuesta('', { status: 301, headers: { location: 'https://www.tienda.test/' } })
        : respuesta(html, { url: 'https://tienda.test/' })],
    ]);
    const callar = silenciar();
    await auditar('tienda.test');
    callar();
    delete process.env.CRUX_API_KEY;

    /* CrUX indexa por origen exacto. Preguntando por el ápex cuando la
       tienda vive en www se recibe un 404 y el dato de campo se descarta
       como "tráfico bajo" en tiendas que sí lo tienen. */
    assert.equal(consultado, 'https://www.tienda.test');
  }, { timeout: 90000 });
});

describe('parseo de atributos con apóstrofo', () => {
  test('un alt con apóstrofo no se corta', async () => {
    const html = `<html><body>
      <img src="/1.jpg"><img src="/2.jpg">
      <img src="/australia's-best.jpg" alt="Australia's leading store">
      <img src="/b.jpg" loading="lazy">
      </body></html>`;
    activo = interceptarFetch([['t.test', respuesta(html, { url: 'https://t.test/' })]]);
    const p = await cargarPagina('https://t.test/');

    // La comilla de cierre tiene que ser la de apertura: sin retroceso,
    // el valor se corta en el primer apóstrofo.
    assert.ok(p.imagenes.ejemplos_sin_lazy.some(s => s.includes("australia's-best")),
      `ejemplos: ${JSON.stringify(p.imagenes.ejemplos_sin_lazy)}`);
    assert.equal(p.imagenes.renderizadas_por_js, 0, 'ninguna se pierde por el apóstrofo');
  });

  test('un href con apóstrofo se absolutiza entero', async () => {
    const html = `<html><head>
      <link rel="stylesheet" href="https://cdn.test/it's-a-theme.css">
      </head><body></body></html>`;
    activo = interceptarFetch([['t.test', respuesta(html, { url: 'https://t.test/' })]]);
    const p = await cargarPagina('https://t.test/');
    assert.ok(p.recursos.links[0].includes("it's-a-theme.css"), p.recursos.links[0]);
  });
});

describe('detección de apps', () => {
  test('subir de confianza no borra las páginas ya vistas', () => {
    const pagina = (url, html, scripts = []) => ({
      url, html, recursos: { scripts, links: [], meta: [] },
    });
    // En la home sólo aparece el nombre en el HTML (confianza media); en la
    // ficha de producto ya carga el recurso (confianza alta).
    const r = detectarApps([
      pagina('https://t.test/', 'contiene loox.io en el marcado'),
      pagina('https://t.test/products/x', '<html>ficha</html>', ['https://loox.io/widget/loox.js']),
    ], 't.test');

    const loox = r.apps.find(a => a.id === 'loox');
    assert.equal(loox.confianza, 'alta');
    assert.equal(loox.paginas.length, 2, `páginas: ${JSON.stringify(loox.paginas)}`);
  });
});

describe('bin/batch.js', () => {
  test('--seo es una bandera y no se come el argumento siguiente', async () => {
    const fuente = await readFile(join(raiz, 'bin', 'batch.js'), 'utf8');
    // Desde la función, no desde BANDERAS: BANDERAS vive dentro de ella para
    // no caer en la zona muerta temporal (ver bin.test.js).
    const cuerpo = fuente.slice(fuente.indexOf('function parseArgs'));
    const parseArgs = new Function(`${cuerpo}\n      return parseArgs;`)();

    const a = parseArgs(['queue.csv', '--out', 'auditorias/', '--seo']);
    assert.equal(a.seo, true, '--seo al final se ignoraba por completo');
    assert.equal(a.out, 'auditorias/');
    assert.deepEqual(a._, ['queue.csv']);

    const b = parseArgs(['queue.csv', '--seo', '--out', 'auditorias/']);
    assert.equal(b.seo, true);
    assert.equal(b.out, 'auditorias/', '--out se perdía porque --seo lo absorbía');
  });
});
