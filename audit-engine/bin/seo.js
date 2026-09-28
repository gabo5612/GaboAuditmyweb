#!/usr/bin/env node
/* Auditoría SEO técnica — el motor pelado, hermano de bin/audit.js.
   Le das un dominio, te escupe el JSON. Sin API keys, sin cola, sin emails.

   Uso:
     node bin/seo.js tienda.com
     node bin/seo.js tienda.com --rango alto
     node bin/seo.js tienda.com --out auditorias-seo/                */

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { auditarSeo } from '../src/seo-collect.js';
import { log } from '../src/util.js';

const args = parseArgs(process.argv.slice(2));

if (!args._[0] || args.help) {
  console.log(`
  node bin/seo.js <dominio> [opciones]

    --rango alto                 rango de facturación declarado en el formulario
    --out <carpeta>              guarda el JSON (por defecto: stdout)

  No necesita ninguna variable de entorno: las 22 comprobaciones se hacen
  contra el HTML público de la tienda, robots.txt y sitemap.xml.
`);
  process.exit(args.help ? 0 : 1);
}

const resultado = await auditarSeo(args._[0], { facturacionRango: args.rango || null });
const json = JSON.stringify(resultado, null, 2);

if (args.out) {
  await mkdir(args.out, { recursive: true });
  const archivo = join(args.out, `${resultado.tienda.host}.seo.json`);
  await writeFile(archivo, json);
  log(`\n✓ ${archivo}`);
} else {
  process.stdout.write(json + '\n');
}
resumen(resultado);

process.exit(resultado.estado === 'ok' ? 0 : 1);

function resumen(r) {
  if (r.estado !== 'ok') {
    log(`\n  estado: FALLIDA — ${r.motivo}`);
    return;
  }
  const s = r.resumen;
  log(`\n  comprobaciones ... ${s.evaluadas} evaluadas de ${s.total}`);
  log(`  fallan ........... ${s.falla}`);
  log(`  avisos ........... ${s.aviso}`);
  log(`  salud ............ ${s.salud_pct}%`);

  for (const c of r.comprobaciones.filter(x => x.estado === 'falla')) {
    log(`    ■ ${c.titulo}: ${c.valor}`);
  }
  for (const c of r.comprobaciones.filter(x => x.estado === 'aviso')) {
    log(`    ▲ ${c.titulo}: ${c.valor}`);
  }
  const noMedibles = r.comprobaciones.filter(x => x.estado === 'no_medible');
  if (noMedibles.length) log(`  no medibles ...... ${noMedibles.length}`);
  log(`  lead score ....... ${r.lead_score.total} (${r.lead_score.prioridad})`);
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
