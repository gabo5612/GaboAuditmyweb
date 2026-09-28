/* Etapa ④ — el informe, y el camino completo de collect.js. */

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { renderInforme } from '../report/template.js';
import { auditar } from '../src/collect.js';
import { reportToken } from '../src/util.js';
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

describe('report/template.js', () => {
  test('no emite una sola petición externa', async () => {
    const { datos, analisis } = await cargar();
    const html = renderInforme(datos, analisis, { calUrl: 'https://cal.com/g/20min' });

    // El informe ES la demostración del producto. Una fuente remota, un
    // script o una imagen externa lo contradicen.
    assert.equal(html.match(/<script\b(?![^>]*type="application)/gi), null, 'sin <script>');
    assert.ok(!/<link[^>]+href=["']https?:/i.test(html), 'sin <link> remoto');
    assert.ok(!/@import/i.test(html), 'sin @import');
    assert.ok(!/<img[^>]+src=["']https?:/i.test(html), 'sin imágenes remotas');
    assert.ok(!/fonts\.googleapis|fonts\.gstatic/i.test(html), 'sin Google Fonts');
  });

  test('se sirve con noindex y pesa poco', async () => {
    const { datos, analisis } = await cargar();
    const html = renderInforme(datos, analisis, {});
    assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
    assert.ok(Buffer.byteLength(html) < 60 * 1024, 'un informe de velocidad no puede pesar');
  });

  test('escapa el contenido: un título hostil no inyecta marcado', async () => {
    const { datos, analisis } = await cargar();
    const a = clon(analisis);
    a.hallazgos[0].titulo = '<img src=x onerror="alert(1)">';
    a.diagnostico_una_linea = 'Roto & "peligroso" <script>alert(1)</script>';
    const d = clon(datos);
    d.tienda.host = '"><script>alert(2)</script>';

    const html = renderInforme(d, a, {});
    assert.ok(!html.includes('<script>alert('), 'nada de script inyectado');
    assert.ok(!html.includes('onerror="alert'), 'nada de handlers inyectados');
    assert.ok(html.includes('&lt;script&gt;'), 'se escapa, no se borra');
  });

  test('sin facturación muestra el porcentaje, nunca un importe', async () => {
    const { datos, analisis } = await cargar();
    const html = renderInforme(datos, analisis, {});
    const bignum = html.match(/class="bignum">([^<]*)/)[1];
    assert.equal(bignum, '21.6%');
    assert.ok(!/\$\d/.test(bignum));
  });

  test('formatea las cifras en el idioma del cliente', async () => {
    const { datos, analisis } = await cargar();
    const d = clon(datos), a = clon(analisis);
    d.dinero.facturacion_mensual = 250000; d.dinero.moneda = 'EUR';
    a.coste_estimado_mensual.valor = 54000; a.coste_estimado_mensual.moneda = 'EUR';

    const en = renderInforme(d, a, {});
    assert.ok(en.includes('€54,000'), 'inglés: separador de millares con coma');

    a.idioma = 'es';
    const es = renderInforme(d, a, {});
    assert.ok(es.includes('€54.000'), 'español: separador con punto');
    assert.ok(es.includes('Lo que te está costando'), 'y las etiquetas traducidas');
    assert.match(es, /<html lang="es">/);
  });

  test('ordena los hallazgos por impacto, no por el orden recibido', async () => {
    const { datos, analisis } = await cargar();
    const a = clon(analisis);
    a.hallazgos[0].impacto = 'bajo';
    const html = renderInforme(datos, a, {});
    const titulos = [...html.matchAll(/<h4>([^<]+)<\/h4>/g)].map(m => m[1]);
    assert.ok(!titulos[0].includes('Three review apps'), 'el de impacto bajo baja');
  });

  test('cada hallazgo imprime su fuente y su fecha', async () => {
    const { datos, analisis } = await cargar();
    const html = renderInforme(datos, analisis, {});
    for (const h of analisis.hallazgos) {
      assert.ok(html.includes(h.evidencia.fuente), `falta la fuente de "${h.titulo}"`);
      assert.ok(html.includes(h.evidencia.fecha), `falta la fecha de "${h.titulo}"`);
    }
  });

  test('publica lo que no se pudo medir en vez de esconderlo', async () => {
    const { datos, analisis } = await cargar();
    const html = renderInforme(datos, analisis, {});
    assert.ok(html.includes('could not measure'));
    assert.ok(html.includes(analisis.datos_faltantes[0]));
  });

  test('en inglés no se cuela la lista del motor, que está en español', async () => {
    const { datos, analisis } = await cargar();
    const html = renderInforme(datos, analisis, {});
    for (const f of datos.datos_faltantes) assert.ok(!html.includes(f), `se coló: ${f}`);
    const es = renderInforme(datos, { ...analisis, idioma: 'es' }, {});
    assert.ok(es.includes(datos.datos_faltantes[0]), 'en español sí se imprime');
  });

  test('omite las secciones sin datos en lugar de dejarlas vacías', async () => {
    const { datos, analisis } = await cargar();
    const d = clon(datos);
    d.competencia = [];
    const html = renderInforme(d, analisis, {});
    assert.ok(!html.includes('You against your competitors'));
    assert.ok(!html.includes('Book 20 minutes'), 'sin calUrl no hay CTA fantasma');
    assert.ok(!html.includes('<iframe'), 'sin Loom no hay hueco de vídeo');
  });

  test('el Loom sólo se incrusta si la URL trae un id reconocible', async () => {
    const { datos, analisis } = await cargar();
    const bueno = renderInforme(datos, analisis, { loomUrl: 'https://www.loom.com/share/a1b2c3d4e5f67890a1b2c3d4e5f67890' });
    assert.ok(bueno.includes('loom.com/embed/a1b2c3d4e5f67890a1b2c3d4e5f67890'));
    const malo = renderInforme(datos, analisis, { loomUrl: 'https://ejemplo.com/video' });
    assert.ok(!malo.includes('<iframe'));
  });
});

describe('util.js', () => {
  test('el token del informe no es adivinable ni se repite', () => {
    const t = reportToken();
    assert.match(t, /^[0-9a-f]{32}$/);
    const muchos = new Set(Array.from({ length: 500 }, () => reportToken()));
    assert.equal(muchos.size, 500);
  });
});

/* ── El camino completo, con la red simulada ──────────────────────── */

describe('collect.js de punta a punta', () => {
  const HTML = `<html><head>
    <script src="https://cdn.shopify.com/s/x.js"></script>
    <script src="https://loox.io/widget/loox.js"></script>
    <script src="https://cdn1.judge.me/w.js"></script>
    <script>Shopify.theme={"name":"Dawn","id":1,"theme_store_id":null,"role":"main"};
    Shopify.currency={"active":"USD"};</script>
    </head><body><img src="/a.jpg"></body></html>`;

  const rutasBase = async () => {
    const psi = JSON.parse(await readFile(join(aqui, 'fixtures', 'psi-mobile.json'), 'utf8'));
    return [
      ['/products.json', respuesta({ products: [{ handle: 'p' }] })],
      ['/collections.json', respuesta({ collections: [{ handle: 'c' }] })],
      ['pagespeedonline', respuesta(psi)],
      ['chromeuxreport', respuesta({}, { status: 404 })],
      ['tienda.test', respuesta(HTML, { url: 'https://tienda.test/', headers: { 'x-shopid': '99' } })],
    ];
  };

  test('produce una auditoría completa y coherente', async () => {
    activo = interceptarFetch(await rutasBase());
    const callar = silenciar();
    const r = await auditar('tienda.test');
    callar();

    assert.equal(r.estado, 'ok');
    assert.equal(r.tienda.host, 'tienda.test');
    assert.equal(r.tienda.moneda_activa, 'USD');
    assert.equal(r.rendimiento.movil.score, 31);
    assert.equal(r.dinero.lcp_s, 5.23, 'el dinero se calcula sobre el LCP medido');
    assert.equal(r.dinero.perdida_importe, null, 'sin facturación no hay importe');
    assert.equal(r.apps.duplicadas[0].categoria, 'reseñas');
    assert.equal(r.tema.a_medida, true);
    assert.ok(r.lead_score.total > 0);
    assert.ok(Array.isArray(r.datos_faltantes));
  });

  test('declara cada hueco en datos_faltantes', async () => {
    activo = interceptarFetch(await rutasBase());
    const callar = silenciar();
    const r = await auditar('tienda.test');
    callar();

    const texto = r.datos_faltantes.join(' | ');
    assert.match(texto, /usuarios reales/, 'CrUX no disponible se declara');
    assert.match(texto, /competidores/, 'sin comparativa se declara');
    assert.match(texto, /[Ff]acturación/, 'sin facturación se declara');
  });

  test('rechaza lo que no es Shopify en vez de auditarlo', async () => {
    activo = interceptarFetch([
      ['tienda.test', respuesta('<html><body>WooCommerce</body></html>', { url: 'https://tienda.test/' })],
    ]);
    const callar = silenciar();
    const r = await auditar('tienda.test');
    callar();

    assert.equal(r.estado, 'fallida');
    assert.equal(r.codigo, 'no_shopify');
    assert.ok(!activo.llamadas.some(u => u.includes('pagespeedonline')),
      'ni siquiera gasta cuota de PSI: se descarta antes');
  });

  test('si PSI móvil falla, la auditoría se marca fallida y no se rellena', async () => {
    const rutas = await rutasBase();
    activo = interceptarFetch([
      ['pagespeedonline', respuesta({ error: 'quota' }, { status: 429 })],
      ...rutas,
    ]);
    const callar = silenciar();
    const r = await auditar('tienda.test');
    callar();

    // Riesgo §5: nunca envíes un informe con huecos.
    assert.equal(r.estado, 'fallida');
    assert.match(r.motivo, /PageSpeed móvil/);
    assert.equal(r.rendimiento, undefined, 'no hay métricas a medias');
  }, { timeout: 60000 });

  test('incorpora los competidores que se le indican', async () => {
    const rutas = await rutasBase();
    // 'pagespeedonline' va primero: la URL de PSI lleva el dominio del
    // competidor dentro del parámetro `url`, así que una ruta por dominio
    // colocada antes se tragaría también la llamada a la API.
    activo = interceptarFetch([
      ...rutas,
      ['rival.test', respuesta(HTML, { url: 'https://rival.test/' })],
    ]);
    const callar = silenciar();
    const r = await auditar('tienda.test', { competidores: ['rival.test'] });
    callar();

    assert.equal(r.competencia.length, 1);
    assert.equal(r.competencia[0].host, 'rival.test');
    assert.equal(r.competencia[0].lcp_s, 5.23);
    assert.ok(r.competencia[0].fuente && r.competencia[0].fecha, 'con su procedencia');
    assert.ok(!r.datos_faltantes.some(f => /competidores/.test(f)));
  });

  test('con facturación conocida sí calcula el importe', async () => {
    activo = interceptarFetch(await rutasBase());
    const callar = silenciar();
    const r = await auditar('tienda.test', { facturacion: 250000, moneda: 'USD' });
    callar();

    assert.equal(r.dinero.facturacion_mensual, 250000);
    assert.ok(r.dinero.perdida_importe > 0);
  });
});
