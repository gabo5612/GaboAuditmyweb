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

async function crux(lcpUltimoMs) {
  const c = await leer('crux-history.json');
  const s = c.record.metrics.largest_contentful_paint.percentilesTimeseries.p75s;
  s[s.length - 1] = lcpUltimoMs;
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

async function correr(lcpLabMs, lcpCampoMs) {
  activo = interceptarFetch(rutas(await psiConLcp(lcpLabMs), lcpCampoMs == null ? null : await crux(lcpCampoMs)));
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

test('el asunto del correo usa el mismo LCP que la pérdida', async () => {
  const r = await correr(12870, 4800);
  r.rendimiento.movil.score = 40;
  const [uno] = borradores(r, { informe: 'https://gaboauditmyweb.dev/audit/' + 'a'.repeat(32), para: 'a@b.com' });
  assert.match(uno.texto, /takes 4s/, 'el de campo (4,8 s), no el de laboratorio (12,9 s)');
  assert.match(uno.texto, /real visitors/);
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
});
