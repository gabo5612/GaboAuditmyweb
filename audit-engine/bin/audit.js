#!/usr/bin/env node
/* Fase 0 — el motor pelado.
   Le das un dominio, te escupe el JSON. Sin web, sin cola, sin emails.

   Uso:
     node bin/audit.js tienda.com
     node bin/audit.js tienda.com --competidores otra.com,tercera.com
     node bin/audit.js tienda.com --facturacion 250000 --moneda EUR
     node bin/audit.js tienda.com --out auditorias/                */

import '../src/env.js';   // antes de cualquier lectura de process.env
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { auditar } from '../src/collect.js';
import { log } from '../src/util.js';

const args = parseArgs(process.argv.slice(2));

if (!args._[0] || args.help) {
  console.log(`
  node bin/audit.js <dominio> [opciones]

    --competidores a.com,b.com   competidores del mismo nicho a comparar
    --facturacion 250000         facturación mensual, si la conoces
    --moneda EUR                 EUR | USD | GBP | CAD | AUD
    --rango alto                 rango declarado en el formulario
    --corridas 3                 corridas de PSI móvil; se publica la mediana
    --out <carpeta>              guarda el JSON (por defecto: stdout)

  Variables de entorno:
    PAGESPEED_API_KEY   sube la cuota de PSI y habilita CrUX
    CRUX_API_KEY        si es distinta de la anterior
`);
  process.exit(args.help ? 0 : 1);
}

const resultado = await auditar(args._[0], {
  competidores: (args.competidores || '').split(',').map(s => s.trim()).filter(Boolean),
  facturacion: args.facturacion ? Number(args.facturacion) : null,
  moneda: args.moneda || 'EUR',
  facturacionRango: args.rango || null,
  corridas: args.corridas ? Number(args.corridas) : 3,
});

const json = JSON.stringify(resultado, null, 2);

if (args.out) {
  await mkdir(args.out, { recursive: true });
  const archivo = join(args.out, `${resultado.tienda.host}.json`);
  await writeFile(archivo, json);
  log(`\n✓ ${archivo}`);
  resumen(resultado);
} else {
  process.stdout.write(json + '\n');
  resumen(resultado);
}

process.exit(resultado.estado === 'ok' ? 0 : 1);

function resumen(r) {
  if (r.estado !== 'ok') {
    log(`\n  estado: FALLIDA — ${r.motivo}`);
    return;
  }
  const m = r.rendimiento.movil;
  log(`\n  score móvil ...... ${m.score}`);
  log(`  LCP móvil ........ ${m.metricas.lcp_s}s  (objetivo 2,5s)${m.corridas?.length > 1 ? ` · ${m.criterio}, rango ${m.rango.lcp_s?.join('–')}s` : ''}`);
  log(`  URL analizada .... ${m.url_analizada}`);
  log(`  CLS .............. ${m.metricas.cls}`);
  log(`  peso total ....... ${m.recursos.total_kb} KB`);
  log(`  apps detectadas .. ${r.apps.total}`);
  if (r.apps.duplicadas.length) {
    for (const d of r.apps.duplicadas) {
      log(`    ! ${d.cuantas} apps de ${d.categoria}: ${d.nombres.join(', ')}`);
    }
  }
  log(`  pérdida estimada . ${r.dinero.perdida_pct}%${r.dinero.perdida_importe ? ` (${r.dinero.formula})` : ' de la facturación'}`);
  log(`  lead score ....... ${r.lead_score.total} (${r.lead_score.prioridad})`);
  if (r.datos_faltantes.length) {
    log(`  datos faltantes .. ${r.datos_faltantes.length}`);
    for (const f of r.datos_faltantes) log(`    · ${f}`);
  }
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a.startsWith('--')) out[a.slice(2)] = argv[++i];
    else out._.push(a);
  }
  return out;
}
