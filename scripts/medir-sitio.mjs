#!/usr/bin/env node
/* Mide este sitio con sus propias herramientas y guarda la salida en bruto
 * en medicion/. Es la fuente de las dos cifras del hero: el PageSpeed
 * móvil y las comprobaciones SEO.
 *
 *   node scripts/medir-sitio.mjs            mide https://gaboauditmyweb.dev/
 *
 * Se corre contra el sitio DESPLEGADO, no durante el build: el build no
 * puede medir la versión que todavía no existe. Después se copian las cifras
 * de medicion/resumen.json a las tres páginas, a mano, y se vuelve a
 * desplegar — así el build sigue siendo determinista.
 *
 * Tres corridas por estrategia y se publica la mediana con el rango. Una
 * corrida suelta no es un dato: en NaturVet el LCP varió un 40 % el mismo
 * día. Entre corridas se espera 65 s porque PSI devuelve la misma respuesta
 * cacheada si se le pregunta dos veces seguidas por la misma URL — se
 * detecta por el fetchTime y, si se repite, la corrida no cuenta.
 *
 * El motor SEO se niega a auditar algo que no sea Shopify, y este sitio no
 * lo es. Aquí se llama a las mismas funciones saltándose sólo esa puerta:
 * las comprobaciones de ficha de producto y colección salen `no_medible`,
 * que es lo cierto, y el total sigue siendo 22. */

import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { cargarPagina } from '../audit-engine/src/page.js';
import { analizarInfra } from '../audit-engine/src/infra.js';
import * as seo from '../audit-engine/src/seo.js';

const URL_SITIO = process.argv[2] || 'https://gaboauditmyweb.dev/';
const SALIDA = 'medicion';
const CORRIDAS = 3;
const ESPERA_MS = 65_000;

if (existsSync('audit-engine/.env')) process.loadEnvFile('audit-engine/.env');
const CLAVE = process.env.PAGESPEED_API_KEY;
if (!CLAVE) {
  console.error('✗ Falta PAGESPEED_API_KEY (audit-engine/.env). Sin ella PSI devuelve 429.');
  process.exit(1);
}

const dormir = ms => new Promise(r => setTimeout(r, ms));
const mediana = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

/* Las capturas son ~80 % del JSON y no sostienen ninguna cifra. Se quitan
   y se dice que se quitaron; todo lo demás se publica tal cual. */
const CAPTURAS = ['final-screenshot', 'full-page-screenshot', 'screenshot-thumbnails'];

async function psi(estrategia) {
  const q = new URLSearchParams({ url: URL_SITIO, strategy: estrategia, category: 'performance', key: CLAVE });
  const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`);
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(`PSI ${estrategia}: ${json.error?.message || res.status}`);
  const lh = json.lighthouseResult;
  for (const id of CAPTURAS) delete lh.audits[id];
  delete lh.fullPageScreenshot;
  lh._nota = `Capturas eliminadas (${CAPTURAS.join(', ')}, fullPageScreenshot). El resto es la respuesta de PSI sin tocar.`;
  return lh;
}

await mkdir(SALIDA, { recursive: true });
const resumen = { url: URL_SITIO, fuente: 'PageSpeed Insights API v5 (Lighthouse)', psi: {} };

for (const estrategia of ['mobile', 'desktop']) {
  const vistas = new Set();
  const corridas = [];
  while (corridas.length < CORRIDAS) {
    const lh = await psi(estrategia);
    if (vistas.has(lh.fetchTime)) {
      console.log(`  · ${estrategia}: respuesta cacheada (${lh.fetchTime}), no cuenta`);
    } else {
      vistas.add(lh.fetchTime);
      corridas.push(lh);
      const n = corridas.length;
      await writeFile(`${SALIDA}/psi-${estrategia}-${n}.json`, JSON.stringify(lh));
      console.log(`  · ${estrategia} ${n}/${CORRIDAS}: ${Math.round(lh.categories.performance.score * 100)}  (${lh.fetchTime})`);
    }
    if (corridas.length < CORRIDAS) await dormir(ESPERA_MS);
  }
  const scores = corridas.map(lh => Math.round(lh.categories.performance.score * 100));
  const lcp = corridas.map(lh => lh.audits['largest-contentful-paint'].numericValue);
  resumen.psi[estrategia] = {
    score_mediana: mediana(scores),
    scores,
    lcp_ms_mediana: Math.round(mediana(lcp)),
    fechas: corridas.map(lh => lh.fetchTime),
    lighthouse: corridas[0].lighthouseVersion,
    archivos: corridas.map((_, i) => `psi-${estrategia}-${i + 1}.json`),
  };
}

// ── SEO: las mismas funciones que bin/seo.js, sin la puerta de Shopify ──
const infra = await analizarInfra(URL_SITIO);
const home = await cargarPagina(URL_SITIO);
if (home.error) throw new Error(`no se pudo descargar la home: ${home.error}`);
const paginas = [{ rol: 'home', ...home }].map(p => ({ ...p, meta: seo.leerMetadatos(p) }));
const [robots, sitemap, notFound, llms, duplicada] = await Promise.all([
  seo.leerRobots(URL_SITIO), seo.leerSitemap(URL_SITIO), seo.comprobar404(URL_SITIO),
  seo.comprobarLlmsTxt(URL_SITIO), seo.comprobarRutaDuplicada(null, null),
]);
const comprobaciones = seo.comprobar({
  origin: URL_SITIO, paginas, robots, sitemap, notFound, duplicada, llms,
  xRobotsTag: infra.x_robots_tag,
});
const fechaSeo = new Date().toISOString();
await writeFile(`${SALIDA}/seo.json`, JSON.stringify({ url: URL_SITIO, fecha: fechaSeo, comprobaciones }, null, 2));
resumen.seo = { fecha: fechaSeo, fuente: 'audit-engine/src/seo.js', archivo: 'seo.json', ...seo.resumir(comprobaciones) };

await writeFile(`${SALIDA}/resumen.json`, JSON.stringify(resumen, null, 2));
const s = resumen.seo;
console.log(`\n✓ ${SALIDA}/resumen.json`);
console.log(`  PageSpeed móvil ${resumen.psi.mobile.score_mediana} (${resumen.psi.mobile.scores.join(' · ')}) · escritorio ${resumen.psi.desktop.score_mediana}`);
console.log(`  SEO ${s.pasa}/${s.total} pasan · ${s.falla} fallan · ${s.aviso} avisos · ${s.no_aplica + s.no_medible} no aplican o no se pueden medir`);
