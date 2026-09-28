#!/usr/bin/env node
/* Etapa ④½ — Publica un informe en https://gaboauditmyweb.dev/audit/<token>.

   Uso:
     node bin/publish.js informes/tienda.com-<token>.html [otro.html …]
     node bin/publish.js --lista            qué hay publicado y para quién

   Por qué un proyecto de Vercel aparte (`gaboauditmyweb-informes`):
   el sitio se despliega solo con cada push a main, y el repositorio es
   público. Los informes llevan datos de tiendas de terceros, así que no
   pueden entrar en git — y lo que no está en git desaparece en el
   siguiente despliegue desde git. Este proyecto se despliega sólo desde
   aquí, con `publicados/` (gitignored) como raíz, y el sitio principal
   reescribe /audit/* hacia él: el prospecto ve una URL del dominio, que
   es lo que promete la web.

   La URL no lleva el host de la tienda, sólo el token: quien la vea en
   una captura no sabe de quién es el informe. La correspondencia
   tienda → token se guarda en prospectos/publicados.csv, fuera de git.

   Nada de esto envía un correo. Devuelve el enlace; enviarlo sigue siendo
   una decisión humana, después de la checklist del paso ⑤. */

import { copyFile, mkdir, readFile, appendFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { basename, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLICADOS = join(RAIZ, 'publicados');
const REGISTRO = join(RAIZ, 'prospectos', 'publicados.csv');
const DOMINIO = 'https://gaboauditmyweb.dev';

const args = process.argv.slice(2);

if (args.includes('--lista')) {
  try {
    process.stdout.write(await readFile(REGISTRO, 'utf8'));
  } catch {
    console.log('Nada publicado todavía.');
  }
  process.exit(0);
}

if (!args.length || args.includes('--help')) {
  console.log('\n  node bin/publish.js <informe.html> [más.html …]\n  node bin/publish.js --lista\n');
  process.exit(args.length ? 0 : 1);
}

await access(join(PUBLICADOS, '.vercel', 'project.json')).catch(() => {
  console.error('✗ publicados/ no está enlazado a Vercel. Una vez:\n' +
    '  cd publicados && vercel link --yes --project gaboauditmyweb-informes');
  process.exit(1);
});

const nuevos = [];
for (const ruta of args) {
  /* El nombre lo pone bin/report.js: <host>[-seo]-<32 hex>.html */
  const m = basename(ruta).match(/^(.+?)(-seo)?-([0-9a-f]{32})\.html$/);
  if (!m) {
    console.error(`✗ ${ruta}: no parece un informe de bin/report.js (<host>-<token>.html)`);
    process.exit(1);
  }
  const [, host, seo, token] = m;
  const html = await readFile(ruta, 'utf8');
  /* Última red antes de publicar: un informe sin noindex acabaría en
     Google con el nombre de la tienda en el título. */
  if (!/<meta name="robots" content="noindex/.test(html)) {
    console.error(`✗ ${ruta}: el informe no lleva meta robots noindex. No se publica.`);
    process.exit(1);
  }
  await mkdir(join(PUBLICADOS, 'audit'), { recursive: true });
  await copyFile(ruta, join(PUBLICADOS, 'audit', `${token}.html`));
  nuevos.push({ host, tipo: seo ? 'seo' : 'velocidad', token, url: `${DOMINIO}/audit/${token}` });
}

console.error('▸ Desplegando gaboauditmyweb-informes…');
execFileSync('vercel', ['deploy', '--prod', '--yes'], { cwd: PUBLICADOS, stdio: ['ignore', 'ignore', 'inherit'] });

/* Se comprueba desde fuera, por el dominio real: la reescritura del sitio
   principal es parte del camino, y un enlace que da 404 en el primer
   correo no se recupera. */
for (const n of nuevos) {
  let estado = 0;
  for (let i = 0; i < 6 && estado !== 200; i++) {
    if (i) await new Promise(r => setTimeout(r, 5000));
    estado = (await fetch(n.url, { method: 'HEAD' }).catch(() => ({ status: 0 }))).status;
  }
  if (estado !== 200) {
    console.error(`✗ ${n.url} responde ${estado}. Revisa la reescritura /audit/* en vercel.json del sitio.`);
    process.exit(1);
  }
  await mkdir(dirname(REGISTRO), { recursive: true });
  const cabecera = await access(REGISTRO).then(() => '', () => 'fecha,host,tipo,url\n');
  await appendFile(REGISTRO, `${cabecera}${new Date().toISOString().slice(0, 10)},${n.host},${n.tipo},${n.url}\n`);
  console.log(`✓ ${n.host} (${n.tipo}) → ${n.url}`);
}
