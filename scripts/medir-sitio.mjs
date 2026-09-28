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
 * lo es. Aquí se llama a las mismas funciones saltándose sólo esa puerta,
 * y se le dan las plantillas que este sitio sí tiene, cada una en el papel
 * que cumple de verdad:
 *
 *   producto   speed.html — una oferta con precio y schema Product (y
 *              seo.html, que se comprueba igual en una segunda pasada)
 *   coleccion  la home — el hub que lista las dos ofertas, con ItemList
 *
 * La ruta duplicada no puede ser /collections/x/products/y: aquí no existe.
 * Se mide la que sí existe — /index.html sirve la misma página que / — con
 * la misma regla: o no responde, o su canonical apunta a la buena. Cada
 * adaptación queda escrita en `nota` dentro de seo.json.
 *
 *   node scripts/medir-sitio.mjs [url] [--solo-seo]
 */

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { cargarPagina } from '../audit-engine/src/page.js';
import { analizarInfra } from '../audit-engine/src/infra.js';
import * as seo from '../audit-engine/src/seo.js';

const ARGS = process.argv.slice(2);
const URL_SITIO = ARGS.find(a => !a.startsWith('--')) || 'https://gaboauditmyweb.dev/';
const SOLO_SEO = ARGS.includes('--solo-seo');
const SALIDA = 'medicion';
const CORRIDAS = 3;
const ESPERA_MS = 65_000;

if (existsSync('audit-engine/.env')) process.loadEnvFile('audit-engine/.env');
const CLAVE = process.env.PAGESPEED_API_KEY;
if (!CLAVE && !SOLO_SEO) {
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

for (const estrategia of SOLO_SEO ? [] : ['mobile', 'desktop']) {
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
const unir = ruta => new URL(ruta, URL_SITIO).href;
const pagina = async (rol, url) => {
  const p = await cargarPagina(url);
  if (p.error) throw new Error(`no se pudo descargar ${url}: ${p.error}`);
  const con = { rol, ...p };
  return { ...con, meta: seo.leerMetadatos(con) };
};

/* La ruta duplicada de este sitio, con la misma forma que devuelve
   comprobarRutaDuplicada para que comprobar() la juzgue igual. */
async function rutaDuplicada() {
  const url = unir('index.html');
  const esperado = unir('./');
  const p = await cargarPagina(url);
  // Que la ruta no responda también es correcto: no hay duplicado que indexar.
  if (p.error) return { medible: true, url, status: p.error, existe: false, canonical: null, correcto: true };
  const canonical = seo.leerMetadatos({ url, ...p }).canonical;
  const ruta = u => new URL(u).pathname.replace(/\/$/, '');
  return {
    medible: true, url, status: 200, existe: true, canonical, esperado,
    correcto: Boolean(canonical && ruta(canonical) === ruta(esperado)),
  };
}

const infra = await analizarInfra(URL_SITIO);
const home = await pagina('home', URL_SITIO);
const fichas = [await pagina('producto', unir('speed.html')), await pagina('producto', unir('seo.html'))];
const [robots, sitemap, notFound, llms, duplicada] = await Promise.all([
  seo.leerRobots(URL_SITIO), seo.leerSitemap(URL_SITIO), seo.comprobar404(URL_SITIO),
  seo.comprobarLlmsTxt(URL_SITIO), rutaDuplicada(),
]);
const pasada = ficha => seo.comprobar({
  origin: URL_SITIO, paginas: [home, ficha, { ...home, rol: 'coleccion' }],
  robots, sitemap, notFound, duplicada, llms, xRobotsTag: infra.x_robots_tag,
});
const comprobaciones = pasada(fichas[0]);

/* seo.html tiene que aguantar las mismas comprobaciones que speed.html.
   Si una sale distinta, el 22/22 sólo sería cierto para la mitad de las
   ofertas, y no se publica. */
const segunda = pasada(fichas[1]);
const distintas = segunda.filter((c, i) => c.estado !== comprobaciones[i].estado);
if (distintas.length) {
  console.error(`✗ seo.html no da lo mismo que speed.html: ${distintas.map(c => `${c.id}=${c.estado}`).join(', ')}`);
  process.exitCode = 1;
}

const NOTAS = {
  ruta_duplicada: 'Este sitio no tiene /collections/*/products/*. Se mide la ruta duplicada que sí tiene: /index.html frente a /, con la misma regla.',
  schema_product: 'La ficha es speed.html (Product con su Offer). seo.html se comprobó en una segunda pasada con el mismo resultado.',
  schema_breadcrumb: 'Medido en speed.html; seo.html da el mismo resultado.',
  schema_coleccion: 'La colección es la home: el hub que lista las dos ofertas, con ItemList.',
};
for (const c of comprobaciones) if (NOTAS[c.id]) c.nota = NOTAS[c.id];

const fechaSeo = new Date().toISOString();
await writeFile(`${SALIDA}/seo.json`, JSON.stringify({
  url: URL_SITIO, fecha: fechaSeo,
  plantillas: { home: home.meta.url_final, producto: fichas.map(f => f.meta.url_final), coleccion: home.meta.url_final },
  comprobaciones,
}, null, 2));
resumen.seo = { fecha: fechaSeo, fuente: 'audit-engine/src/seo.js', archivo: 'seo.json', ...seo.resumir(comprobaciones) };

if (SOLO_SEO) {
  const previo = existsSync(`${SALIDA}/resumen.json`) ? JSON.parse(await readFile(`${SALIDA}/resumen.json`, 'utf8')) : {};
  resumen.psi = previo.psi || {};
}
await writeFile(`${SALIDA}/resumen.json`, JSON.stringify(resumen, null, 2));
const s = resumen.seo;
console.log(`\n✓ ${SALIDA}/resumen.json`);
if (resumen.psi.mobile) console.log(`  PageSpeed móvil ${resumen.psi.mobile.score_mediana} (${resumen.psi.mobile.scores.join(' · ')}) · escritorio ${resumen.psi.desktop.score_mediana}`);
for (const c of comprobaciones.filter(c => c.estado !== 'pasa')) console.log(`  · ${c.id}: ${c.estado} — ${c.valor}`);
console.log(`  SEO ${s.pasa}/${s.total} pasan · ${s.falla} fallan · ${s.aviso} avisos · ${s.no_aplica + s.no_medible} no aplican o no se pueden medir`);
