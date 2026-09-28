#!/usr/bin/env node
/* Borradores de outbound: los tres correos de OUTBOUND.md para una tienda.

   Uso:
     node bin/draft.js auditorias/tienda.com.json --informe https://gaboauditmyweb.dev/audit/<token> \
       --para hello@tienda.com [--nombre Ana] [--loom https://loom.com/share/…] [--sin-loom]

   Escribe prospectos/borradores/<host>-{1,2,3}.md, los tres con
   `aprobado: no`. Nada sale de aquí: bin/send.js se niega a enviar un
   borrador que no hayas aprobado tú, a mano, en el propio archivo.

   Sin --loom el borrador conserva el marcador {loom}, y send.js no envía
   con marcadores sin rellenar: el vídeo no se automatiza (README, «Antes
   de enviar nada»). --sin-loom quita esa línea, para cuando decidas
   arrancar sin vídeo.

   La cifra del asunto es la mediana del LCP móvil redondeada HACIA ABAJO.
   Si el asunto dice 21 s y el prospecto mide 15 s, se acabó la
   credibilidad en la primera línea (OUTBOUND.md, «Sobre el número del
   asunto»). */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const CAL = 'https://cal.com/gabriel-arias-dev/audit';

export function borradores(datos, { informe, para, nombre = '', loom = null, sinLoom = false }) {
  const host = datos.tienda.host.replace(/^www\./, '');
  const movil = datos.rendimiento.movil;
  const score = movil.score;
  const lcp = movil.metricas.lcp_s;
  if (!Number.isFinite(lcp) || !Number.isFinite(score)) throw new Error('la auditoría no tiene score o LCP móvil');
  if (score > 75) throw new Error(`score móvil ${score}: por encima de 75 hay poco que vender, y un correo de "tu tienda es lenta" sería falso`);
  const n = Math.floor(lcp);
  if (n < 3) throw new Error(`LCP de ${lcp} s: un asunto de "${n}s" no duele`);

  const hola = nombre ? `Hi ${nombre},` : 'Hi,';
  const lineaLoom = sinLoom ? null : `Three minutes walking through what's causing it: ${loom || '{loom}'}`;
  const cab = (paso, asunto) =>
    `---\npara: ${para}\nasunto: ${asunto}\nhost: ${host}\npaso: ${paso}\naprobado: no\n---\n`;
  const asunto1 = `${host} takes ${n}s to show anything on mobile`;

  const uno = [
    hola, '',
    `I ran PageSpeed against ${host} this week. Mobile score ${score}, and the largest element paints at around ${n} seconds — your customer is looking at a mostly empty screen for most of that.`,
    ...(lineaLoom ? ['', lineaLoom] : []),
    '', `Full audit here, free, yours to keep whatever you do next: ${informe}`,
    '', 'There is one fix in there you can apply today without a developer, in about ten minutes. No reply needed for that one — just take it.',
    '', `If you want the rest of it done, I run 30-day sprints for Shopify stores: PageSpeed 85+ or full refund, fixed scope, fixed price. Twenty minutes if it is useful: ${CAL}`,
    '', '— Gabriel Arias',
  ].join('\n');

  const dos = [
    hola, '',
    `Following up once on the audit I sent: ${informe}`,
    '', 'The quick win in it stands on its own — apply it whether or not we ever talk.',
    '', `If speed is not your problem right now, say so and I will stop. If it is, the calendar is here: ${CAL}`,
    '', '— Gabriel',
  ].join('\n');

  const tres = [
    hola, '',
    `Last one from me. The audit stays up at ${informe} — no expiry, no login.`,
    '', 'If it becomes a priority in a few months, reply to this email and I will pick it up from here.',
    '', '— Gabriel',
  ].join('\n');

  return [
    { paso: 1, texto: cab(1, asunto1) + uno + '\n' },
    // El `Re:` sólo es honesto en el seguimiento: hubo un primer correo de verdad.
    { paso: 2, texto: cab(2, `Re: ${asunto1}`) + dos + '\n' },
    { paso: 3, texto: cab(3, `Closing the loop on ${host}`) + tres + '\n' },
  ].map(b => ({ ...b, host }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = { _: [] };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--sin-loom') a.sinLoom = true;
    else if (argv[i].startsWith('--')) a[argv[i].slice(2)] = argv[++i];
    else a._.push(argv[i]);
  }
  if (!a._[0] || !a.informe || !a.para) {
    console.log('\n  node bin/draft.js <auditoria.json> --informe <url> --para <email> [--nombre X] [--loom url | --sin-loom]\n');
    process.exit(1);
  }
  if (!/^https:\/\/gaboauditmyweb\.dev\/audit\/[0-9a-f]{32}$/.test(a.informe)) {
    console.error('✗ --informe tiene que ser el enlace que devuelve bin/publish.js');
    process.exit(1);
  }
  const datos = JSON.parse(await readFile(a._[0], 'utf8'));
  if (datos.estado !== 'ok') { console.error(`✗ auditoría en estado ${datos.estado}`); process.exit(1); }
  const dir = join(RAIZ, 'prospectos', 'borradores');
  await mkdir(dir, { recursive: true });
  for (const b of borradores(datos, { informe: a.informe, para: a.para, nombre: a.nombre, loom: a.loom, sinLoom: a.sinLoom })) {
    const ruta = join(dir, `${b.host}-${b.paso}.md`);
    await writeFile(ruta, b.texto);
    console.log(`✓ ${ruta}`);
  }
}
