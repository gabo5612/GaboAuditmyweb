/* La pérdida se calcula sobre el LCP de usuarios reales cuando existe.

   NaturVet, 28 sep 2026: 12,87 s de LCP en laboratorio y 1,93 s en el p75
   de CrUX. Con el de laboratorio el motor le decía a una tienda que aprueba
   Core Web Vitals que perdía el 45 % de su facturación. */

import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { auditar } from '../src/collect.js';
import { borradores } from '../bin/draft.js';
import { renderInforme } from '../report/template.js';
import { interceptarFetch, respuesta, silenciar } from './helpers.js';

const aqui = dirname(fileURLToPath(import.meta.url));
const leer = p => readFile(join(aqui, 'fixtures', p), 'utf8').then(JSON.parse);

process.env.CRUX_API_KEY ||= 'test';
process.env.PAGESPEED_API_KEY ||= 'test';

let activo = null;
afterEach(() => { activo?.restaurar(); activo = null; });

async function psiConLcp(lcpMs) {
  const p = await leer('psi-mobile.json');
  p.lighthouseResult.audits['largest-contentful-paint'].numericValue = lcpMs;
  return p;
}

async function crux(lcpUltimoMs, { inp, cls } = {}) {
  const c = await leer('crux-history.json');
  const fijar = (k, v) => {
    const s = c.record.metrics[k].percentilesTimeseries.p75s;
    s[s.length - 1] = v;
  };
  fijar('largest_contentful_paint', lcpUltimoMs);
  if (inp != null) fijar('interaction_to_next_paint', inp);
  if (cls != null) fijar('cumulative_layout_shift', cls);
  return c;
}

function rutas(psi, cuerpoCrux) {
  const html = '<html><head><script>Shopify.theme={"name":"D"}</script>'
    + '<script>Shopify.currency={"active":"USD","rate":"1.0"}</script></head><body></body></html>';
  return [
    ['pagespeedonline', respuesta(psi)],
    ['chromeuxreport', cuerpoCrux ? respuesta(cuerpoCrux) : respuesta({}, { status: 404 })],
    ['/products.json', respuesta({ products: [] })],
    ['/collections.json', respuesta({ collections: [] })],
    ['tienda.test', respuesta(html, { url: 'https://tienda.test/', headers: { 'x-shopid': '9' } })],
  ];
}

async function correr(lcpLabMs, lcpCampoMs, otras) {
  activo = interceptarFetch(rutas(await psiConLcp(lcpLabMs), lcpCampoMs == null ? null : await crux(lcpCampoMs, otras)));
  const callar = silenciar();
  try { return await auditar('tienda.test'); } finally { callar(); }
}

test('con CrUX, la pérdida sale del p75 de usuarios reales, no del laboratorio', async () => {
  const r = await correr(12870, 1933);
  assert.equal(r.estado, 'ok');
  assert.equal(r.dinero.base, 'campo');
  assert.equal(r.dinero.lcp_s, 1.93);
  assert.equal(r.dinero.lcp_laboratorio_s, 12.87);
  assert.equal(r.dinero.perdida_pct, 0, 'por debajo de 2,5 s no hay pérdida que publicar');
});

test('usuarios reales en «good» empujan el lead al final de la cola', async () => {
  const r = await correr(12870, 1933);
  assert.ok(r.lead_score.señales.some(s => /usuarios reales/i.test(s.señal) && s.puntos < 0));
});

test('sin CrUX se usa el laboratorio, y se declara', async () => {
  const r = await correr(6000, null);
  assert.equal(r.dinero.base, 'laboratorio');
  assert.equal(r.dinero.lcp_s, 6);
  assert.ok(r.datos_faltantes.some(f => /usuarios reales/.test(f)));
});

test('la moneda de la pérdida es la de la tienda, no EUR por defecto', async () => {
  const r = await correr(6000, 4800);
  assert.equal(r.tienda.moneda_activa, 'USD');
  assert.equal(r.dinero.moneda, 'USD');
});

const INF = { informe: 'https://gaboauditmyweb.dev/audit/' + 'a'.repeat(32), para: 'a@b.com' };

test('con usuarios reales fallando, el correo dice qué falla y cómo comprobarlo', async () => {
  const r = await correr(12870, 4800);
  r.rendimiento.movil.score = 40;
  const [uno] = borradores(r, INF);
  assert.match(uno.texto, /asunto: tienda\.test fails Core Web Vitals on mobile/);
  assert.match(uno.texto, /longer than 4\.80s/, 'la cifra de campo, no los 12,9 s de laboratorio');
  assert.doesNotMatch(uno.texto, /12\.9|12s/);
  assert.match(uno.texto, /pagespeed\.web\.dev/);
});

test('una tienda que aprueba con usuarios reales no recibe correo de velocidad', async () => {
  const r = await correr(12870, 1933, { inp: 168, cls: '0.01' });   // NaturVet, 28 sep
  r.rendimiento.movil.score = 37;
  assert.throws(() => borradores(r, INF), /aprueba Core Web Vitals/);
});

test('el informe dice sobre qué LCP se calculó, y enseña los dos', async () => {
  const r = await correr(12870, 4800);
  const html = renderInforme(r, {
    idioma: 'en', diagnostico_una_linea: 'x',
    coste_estimado_mensual: { supuestos: [], fuente: 'x' },
    hallazgos: [], plan_3_semanas: [], quick_win_regalado: { titulo: 'x', pasos: [], mejora_estimada: 'x', requiere_dev: false },
    confianza: 'media', datos_faltantes: [],
  }, {});
  assert.match(html, /LCP your real visitors get/);
  assert.match(html, /LCP · real users/);
  assert.match(html, /LCP · lab/);
  assert.doesNotMatch(html, /usuarios reales|laboratorio/, 'la fuente del motor está en español');
});

test('LCP real en «good» con INP fallando: el titular enseña el INP, no un 0 %', async () => {
  const r = await correr(9000, 1800, { inp: 322, cls: '0.01' });
  const html = renderInforme(r, {
    idioma: 'en', diagnostico_una_linea: 'x',
    coste_estimado_mensual: { supuestos: [], fuente: 'x' },
    hallazgos: [], plan_3_semanas: [], quick_win_regalado: { titulo: 'x', pasos: [], mejora_estimada: 'x', requiere_dev: false },
    confianza: 'media', datos_faltantes: [],
  }, {});
  assert.match(html, /INP 322 ms/);
  assert.match(html, /Core Web Vitals, real users on phones: failed/);
  assert.doesNotMatch(html, /0%<span class="unit">of monthly revenue/);
});

test('una tienda cerrada con contraseña no se audita (westernrise.com, 28 sep)', async () => {
  const html = '<html><head><script>Shopify.theme={"name":"Wind down: Store closed"}</script></head><body></body></html>';
  activo = interceptarFetch([
    ['pagespeedonline', respuesta(await psiConLcp(9300))],
    ['tienda.test', respuesta(html, { url: 'https://tienda.test/password', headers: { 'x-shopid': '9' } })],
  ]);
  const callar = silenciar();
  const r = await auditar('tienda.test');
  callar();
  assert.equal(r.estado, 'fallida');
  assert.match(r.motivo, /password/);
});

test('cada competidor trae también su dato de usuarios reales', async () => {
  activo = interceptarFetch(rutas(await psiConLcp(7000), await crux(2860, { inp: 138, cls: '0.03' })));
  const callar = silenciar();
  const r = await auditar('tienda.test', { competidores: ['rival.test'] });
  callar();
  assert.equal(r.competencia.length, 1);
  assert.equal(r.competencia[0].campo.lcp_s, 2.86);
  assert.equal(r.competencia[0].campo.aprueba_cwv, false);
});

test('la comparativa es campo contra campo cuando todos lo tienen', async () => {
  activo = interceptarFetch(rutas(await psiConLcp(7000), await crux(2860, { inp: 138, cls: '0.03' })));
  const callar = silenciar();
  const r = await auditar('tienda.test', { competidores: ['rival.test'] });
  callar();
  r.competencia[0].campo.lcp_s = 2.0;
  const html = renderInforme(r, {
    idioma: 'en', diagnostico_una_linea: 'x', coste_estimado_mensual: { supuestos: [], fuente: 'x' },
    hallazgos: [], plan_3_semanas: [], quick_win_regalado: { titulo: 'x', pasos: [], mejora_estimada: 'x', requiere_dev: false },
    confianza: 'media', datos_faltantes: [],
  }, {});
  assert.match(html, /Real shoppers on phones, last 28 days/);
  assert.match(html, />2\.86s</);
  assert.match(html, />2s</);
});
