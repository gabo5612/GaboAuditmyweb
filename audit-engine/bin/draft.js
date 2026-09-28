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
import { fallasCampo } from '../src/cwv.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const CAL = 'https://cal.com/gabriel-arias-dev/audit';

/* Qué significa cada fallo para quien compra, en una frase. Sin cifras
   nuevas: sólo el valor medido y el umbral de Google. */
const QUE_SIGNIFICA = {
  LCP: f => `the main content takes longer than ${(f.valor / 1000).toFixed(1)}s to appear for 1 in 4 of your mobile visitors (Google's "good" line is 2.5s)`,
  INP: f => `for 1 in 4 of your mobile visitors, a tap takes more than ${Math.round(f.valor)} ms to visibly respond (Google's "good" line is 200 ms), which is when "Add to cart" gets tapped twice or abandoned`,
  CLS: f => `the page jumps around while it loads (layout shift ${f.valor.toFixed(2)}, Google's "good" line is 0.1), so people tap the wrong thing`,
};

export function borradores(datos, { informe, para, nombre = '', loom = null, sinLoom = false }) {
  const host = datos.tienda.host.replace(/^www\./, '');
  const movil = datos.rendimiento.movil;
  const score = movil.score;
  if (!Number.isFinite(score)) throw new Error('la auditoría no tiene score móvil');
  if (score > 75) throw new Error(`score móvil ${score}: por encima de 75 hay poco que vender, y un correo de "tu tienda es lenta" sería falso`);

  const hola = nombre ? `Hi ${nombre},` : 'Hi,';
  const lineaLoom = sinLoom ? null : `Three minutes walking through what's causing it: ${loom || '{loom}'}`;
  const cab = (paso, asunto) =>
    `---\npara: ${para}\nasunto: ${asunto}\nhost: ${host}\npaso: ${paso}\naprobado: no\n---\n`;

  /* Con dato de usuarios reales el gancho es lo que PageSpeed enseña arriba
     del todo: Core Web Vitals aprobado o no. Si aprueba, no hay correo de
     velocidad — el laboratorio sólo, contra un campo en verde, es el correo
     que el prospecto desmiente en un clic (NaturVet, 28 sep 2026). */
  const campo = fallasCampo(datos.campo);
  let asunto1, apertura;
  if (campo) {
    if (!campo.fallas.length) {
      throw new Error('aprueba Core Web Vitals con usuarios reales: no es un prospecto de velocidad');
    }
    asunto1 = `${host} fails Core Web Vitals on mobile`;
    const frases = campo.fallas.map(f => QUE_SIGNIFICA[f.metrica](f));
    apertura = [
      `I looked at ${host} in Google's own field data: the Chrome UX Report, which is real shoppers on phones over the last 28 days. Your store fails Core Web Vitals on mobile: ${frases.join('; and ')}.`,
      '', `You can check it yourself in a minute: open pagespeed.web.dev, paste ${host}, and look at the first box, "Discover what your real users are experiencing" (switch it to Origin).`,
    ];
  } else {
    const lcp = movil.metricas.lcp_s;
    if (!Number.isFinite(lcp)) throw new Error('la auditoría no tiene LCP móvil');
    const n = Math.floor(lcp);
    if (n < 3) throw new Error(`LCP de ${lcp} s: un asunto de "${n}s" no duele`);
    asunto1 = `${host} takes ${n}s to show anything on mobile`;
    apertura = [`I ran PageSpeed against ${host} this week. Mobile score ${score}, and in the mobile test the largest element paints at around ${n} seconds — your customer is looking at a mostly empty screen for most of that. (Google has no real-user data for your store yet, so this is the lab test.)`];
  }

  const uno = [
    hola, '',
    ...apertura,
    ...(lineaLoom ? ['', lineaLoom] : []),
    '', `Full audit here, free, yours to keep whatever you do next: ${informe}`,
    '', 'There is one fix in there you can apply today without a developer. No reply needed for that one — just take it.',
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
