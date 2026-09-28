#!/usr/bin/env node
/* Fase 2 — el lote. La fase que da clientes.

   Un CSV con 20 URLs entra, 20 JSON salen, más un resumen ordenado por
   lead score. Por la mañana grabas los Looms en ese orden.

   Uso:
     node bin/batch.js queue.csv --out auditorias/                      */

import '../src/env.js';   // antes de cualquier lectura de process.env
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { auditar } from '../src/collect.js';
import { auditarSeo } from '../src/seo-collect.js';
import { log } from '../src/util.js';

const CONCURRENCIA = 3;  // PSI admite 240 consultas/min; 3 en paralelo va sobrado

/* El lote de SEO no llama a PSI: son seis peticiones al propio dominio y
   ninguna cuota que respetar. Ocho en paralelo y la cola de 20 tarda un
   minuto. */
const CONCURRENCIA_SEO = 8;

const args = parseArgs(process.argv.slice(2));
const ruta = args._[0];
const modoSeo = Boolean(args.seo);

if (!ruta || args.help) {
  console.log(`
  node bin/batch.js <cola.csv> [--out auditorias/] [--concurrencia 3] [--corridas 3] [--seo]

  Columnas del CSV (cabecera obligatoria, el orden da igual):
    url            requerida
    competidores   separados por ; — sin esto no hay comparativa
    facturacion    mensual, si la conoces
    moneda         EUR | USD | GBP | CAD | AUD
    rango          rango declarado en el formulario
    nombre, email  sólo se arrastran al resumen

  --corridas 3  corridas de PSI móvil por tienda; se publica la mediana.
                Para una criba rápida de muchas tiendas, --corridas 1.
  --seo   pasa la misma cola por la auditoría de SEO técnico en vez de la
          de velocidad. No necesita API key y sólo usa url, rango, nombre
          y email; el resto de columnas se ignoran.
`);
  process.exit(args.help ? 0 : 1);
}

const filas = parseCsv(await readFile(ruta, 'utf8'));
if (!filas.length) { console.error('✗ La cola está vacía'); process.exit(1); }

const carpeta = args.out || 'auditorias';
await mkdir(carpeta, { recursive: true });

const porDefecto = modoSeo ? CONCURRENCIA_SEO : CONCURRENCIA;
log(`\n▸ ${filas.length} tiendas en cola (${modoSeo ? 'SEO técnico' : 'velocidad'}), ${args.concurrencia || porDefecto} en paralelo\n`);
const inicio = Date.now();
const resultados = await enPool(filas, Number(args.concurrencia) || porDefecto, async fila => {
  try {
    const r = modoSeo
      ? await auditarSeo(fila.url, { facturacionRango: fila.rango || null })
      : await auditar(fila.url, {
        competidores: (fila.competidores || '').split(';').map(s => s.trim()).filter(Boolean),
        facturacion: fila.facturacion ? Number(fila.facturacion) : null,
        moneda: fila.moneda || 'EUR',
        facturacionRango: fila.rango || null,
        corridas: args.corridas ? Number(args.corridas) : 3,
      });
    await writeFile(join(carpeta, `${r.tienda.host}${modoSeo ? '.seo' : ''}.json`), JSON.stringify(r, null, 2));
    return { fila, r };
  } catch (err) {
    log(`  ✗ ${fila.url}: ${err.message}`);
    return { fila, r: { estado: 'fallida', motivo: String(err.message), tienda: { host: fila.url } } };
  }
});

// ── Resumen: el orden en que grabas los Looms ──────────────────────
const ok = resultados.filter(x => x.r.estado === 'ok')
  .sort((a, b) => b.r.lead_score.total - a.r.lead_score.total);
const fallidas = resultados.filter(x => x.r.estado !== 'ok');

const csv = modoSeo
  ? [
    'orden,host,lead_score,prioridad,fallan,avisos,salud_pct,peor_grupo,nombre,email,archivo',
    ...ok.map((x, i) => [
      i + 1,
      x.r.tienda.host,
      x.r.lead_score.total,
      x.r.lead_score.prioridad,
      x.r.resumen.falla,
      x.r.resumen.aviso,
      x.r.resumen.salud_pct,
      peorGrupo(x.r.resumen),
      x.fila.nombre || '',
      x.fila.email || '',
      `${x.r.tienda.host}.seo.json`,
    ].map(campo).join(',')),
  ].join('\n')
  : [
    'orden,host,lead_score,prioridad,psi_movil,lcp_s,apps,duplicadas,perdida_pct,nombre,email,archivo',
    ...ok.map((x, i) => [
      i + 1,
      x.r.tienda.host,
      x.r.lead_score.total,
      x.r.lead_score.prioridad,
      x.r.rendimiento.movil.score,
      x.r.rendimiento.movil.metricas.lcp_s,
      x.r.apps.total,
      x.r.apps.duplicadas.map(d => `${d.cuantas} ${d.categoria}`).join(' / ') || '',
      x.r.dinero.perdida_pct,
      x.fila.nombre || '',
      x.fila.email || '',
      `${x.r.tienda.host}.json`,
    ].map(campo).join(',')),
  ].join('\n');

await writeFile(join(carpeta, modoSeo ? 'resumen-seo.csv' : 'resumen.csv'), csv + '\n');

const minutos = ((Date.now() - inicio) / 60000).toFixed(1);
log(`\n${'─'.repeat(60)}`);
log(`✓ ${ok.length} auditorías en ${minutos} min → ${join(carpeta, modoSeo ? 'resumen-seo.csv' : 'resumen.csv')}`);
if (fallidas.length) {
  log(`✗ ${fallidas.length} fallidas (no se envía informe con huecos):`);
  for (const f of fallidas) log(`    ${f.r.tienda.host}: ${f.r.motivo}`);
}
log('\n  Orden para grabar los Looms:');
for (const [i, x] of ok.slice(0, 10).entries()) {
  const cola = modoSeo
    ? `${String(x.r.resumen.falla).padStart(2)} fallan · ${peorGrupo(x.r.resumen)}`
    : `PSI ${String(x.r.rendimiento.movil.score).padStart(3)}${x.r.apps.duplicadas[0] ? ` · ${x.r.apps.duplicadas[0].cuantas} apps de ${x.r.apps.duplicadas[0].categoria}` : ''}`;
  log(`   ${String(i + 1).padStart(2)}. ${x.r.tienda.host.padEnd(32)} score ${String(x.r.lead_score.total).padStart(3)} · ${cola}`);
}

/** El grupo con más fallos: es el titular del correo de outbound. */
function peorGrupo(resumen) {
  const entradas = Object.entries(resumen.por_grupo || {});
  const peor = entradas.sort((a, b) => (b[1].falla * 2 + b[1].aviso) - (a[1].falla * 2 + a[1].aviso))[0];
  return peor && (peor[1].falla || peor[1].aviso) ? peor[0] : '';
}

/* ── Utilidades ─────────────────────────────────────────────────── */

async function enPool(items, limite, tarea) {
  const salida = new Array(items.length);
  let siguiente = 0;
  const obreros = Array.from({ length: Math.min(limite, items.length) }, async () => {
    while (siguiente < items.length) {
      const i = siguiente++;
      salida[i] = await tarea(items[i], i);
    }
  });
  await Promise.all(obreros);
  return salida;
}

/** CSV mínimo: comillas dobles, comas dentro de comillas, saltos \r\n. */
function parseCsv(texto) {
  const lineas = texto.split(/\r?\n/).filter(l => l.trim() && !l.trimStart().startsWith('#'));
  if (!lineas.length) return [];
  const cabecera = partirLinea(lineas[0]).map(h => h.trim().toLowerCase());
  return lineas.slice(1).map(linea => {
    const celdas = partirLinea(linea);
    return Object.fromEntries(cabecera.map((h, i) => [h, (celdas[i] || '').trim()]));
  }).filter(f => f.url);
}

function partirLinea(linea) {
  const celdas = [];
  let actual = '', entreComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') {
      if (entreComillas && linea[i + 1] === '"') { actual += '"'; i++; }
      else entreComillas = !entreComillas;
    } else if (c === ',' && !entreComillas) {
      celdas.push(actual); actual = '';
    } else actual += c;
  }
  celdas.push(actual);
  return celdas;
}

const campo = v => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/* Las banderas sin valor van declaradas: si no, `--seo` se come el argumento
   siguiente. `--out auditorias/ --seo` dejaba seo sin definir y corría la
   auditoría de velocidad sobre toda la cola —quemando cuota de PSI—, y
   `--seo --out x` se tragaba el `--out` y escribía en la carpeta por defecto. */
const BANDERAS = new Set(['seo', 'help']);

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a.startsWith('--')) {
      const nombre = a.slice(2);
      out[nombre] = BANDERAS.has(nombre) ? true : argv[++i];
    } else out._.push(a);
  }
  return out;
}
