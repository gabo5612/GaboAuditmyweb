#!/usr/bin/env node
/* Envía UN correo de outbound ya revisado, por Resend.

   Uso:
     node bin/send.js prospectos/borradores/tienda.com-1.md
     node bin/send.js --estado          cupo de hoy, enviados y bajas

   Esto no es la fase 3. No hay cola, ni lote, ni envío programado: un
   archivo, una persona, una ejecución. Resend no tiene dónde redactar a
   mano, así que este es el «a mano» del plan.

   El borrador es texto plano con cabecera:

     ---
     para: hello@tienda.com
     asunto: tienda.com takes 9s to show anything on mobile
     host: tienda.com
     paso: 1
     aprobado: no
     ---
     Cuerpo del correo…

   Cinco reglas que el script hace cumplir en vez de confiar en la memoria:

   1. `aprobado: si` o no sale. El paso ⑤ es humano y se firma en el archivo.
   2. La lista de bajas gana siempre (prospectos/bajas.csv, un email por línea).
   3. El calentamiento de OUTBOUND.md: 10/día la semana 1, 15 la 2, 20 después,
      contando desde el primer envío registrado. Un dominio nuevo que manda 50
      el primer día es la definición de spam para cualquier filtro.
   4. CAN-SPAM: dirección postal física en el pie (OUTBOUND_DIRECCION en .env)
      y forma de darse de baja — línea en el pie y cabecera List-Unsubscribe.
      Sin dirección no se envía.
   5. reply-to al Gmail: la raíz del dominio no tiene MX, y una respuesta que
      rebota es la única que de verdad importa perderse.

   Texto plano, sin seguimiento de aperturas ni de clics: un píxel y unos
   enlaces reescritos son dos señales de correo masivo en un correo que
   pretende no serlo. */

import './../src/env.js';
import { readFile, writeFile, appendFile, access, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const P = join(RAIZ, 'prospectos');
const ENVIADOS = join(P, 'enviados.csv');
const BAJAS = join(P, 'bajas.csv');

const REMITENTE = 'Gabriel Arias <gabriel@gaboauditmyweb.dev>';
const RESPUESTAS = 'gabrielariasdev@gmail.com';
const BAJA_MAILTO = `mailto:${RESPUESTAS}?subject=unsubscribe`;

export function cupoDelDia(fechas, hoy = new Date()) {
  if (!fechas.length) return 10;
  const primero = new Date(fechas[0] + 'T00:00:00Z');
  const dias = Math.floor((Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()) - primero) / 864e5);
  return dias < 7 ? 10 : dias < 14 ? 15 : 20;
}

export function leerBorrador(txt) {
  const m = txt.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error('falta la cabecera --- … ---');
  const cab = Object.fromEntries(m[1].split('\n').filter(Boolean).map(l => {
    const i = l.indexOf(':');
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  }));
  return { cab, cuerpo: m[2].trim() };
}

export function pie(direccion, telefono = '') {
  const linea = ['Gabriel Arias · Shopify performance & technical SEO · https://gaboauditmyweb.dev', telefono].filter(Boolean).join(' · ');
  return `\n\n--\n${linea}\n${direccion}\nNot interested? Reply "unsubscribe" and you will not hear from me again.`;
}

const leerCsv = async ruta => {
  try { return (await readFile(ruta, 'utf8')).split('\n').filter(l => l && !l.startsWith('fecha,')); }
  catch { return []; }
};

async function estado() {
  const filas = await leerCsv(ENVIADOS);
  const fechas = filas.map(l => l.split(',')[0]);
  const hoy = new Date().toISOString().slice(0, 10);
  const deHoy = fechas.filter(f => f === hoy).length;
  return { filas, fechas, deHoy, cupo: cupoDelDia(fechas), bajas: (await leerCsv(BAJAS)).map(s => s.trim().toLowerCase()) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const e = await estado();

  if (args.includes('--estado') || !args.length) {
    console.log(`  hoy: ${e.deHoy}/${e.cupo} · enviados en total: ${e.filas.length} · bajas: ${e.bajas.length}`);
    process.exit(args.length ? 0 : 1);
  }

  const ruta = args[0];
  const { cab, cuerpo } = leerBorrador(await readFile(ruta, 'utf8'));
  const para = (cab.para || '').toLowerCase();
  const falla = msg => { console.error(`✗ ${msg}. No se envía.`); process.exit(1); };

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(para)) falla(`"para" no es un email: ${cab.para}`);
  if (!cab.asunto) falla('falta el asunto');
  if (!/^s[ií]$/i.test(cab.aprobado || '')) falla('el borrador no está aprobado (aprobado: si)');
  if (e.bajas.includes(para)) falla(`${para} está en la lista de bajas`);
  if (e.filas.some(l => l.split(',')[2] === para && l.split(',')[3] === cab.paso)) falla(`ya se envió el paso ${cab.paso} a ${para}`);
  if (e.deHoy >= e.cupo) falla(`cupo de calentamiento agotado: ${e.deHoy}/${e.cupo} hoy`);
  if (/\{[a-z]+\}/.test(cuerpo + cab.asunto)) falla('quedan marcadores sin rellenar ({…})');
  const direccion = process.env.OUTBOUND_DIRECCION;
  if (!direccion) falla('falta OUTBOUND_DIRECCION en .env — CAN-SPAM exige dirección postal física');
  if (!process.env.RESEND_API_KEY) falla('falta RESEND_API_KEY en .env');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: REMITENTE,
      to: [para],
      reply_to: RESPUESTAS,
      subject: cab.asunto,
      text: cuerpo + pie(direccion, process.env.OUTBOUND_TELEFONO),
      headers: { 'List-Unsubscribe': `<${BAJA_MAILTO}>` },
    }),
  });
  const json = await res.json();
  if (!res.ok) falla(`Resend respondió ${res.status}: ${json.message || JSON.stringify(json)}`);

  await mkdir(P, { recursive: true });
  const cabecera = await access(ENVIADOS).then(() => '', () => 'fecha,host,para,paso,resend_id,asunto\n');
  const asunto = `"${cab.asunto.replace(/"/g, '""')}"`;
  await appendFile(ENVIADOS, `${cabecera}${new Date().toISOString().slice(0, 10)},${cab.host || ''},${para},${cab.paso || ''},${json.id},${asunto}\n`);
  await writeFile(ruta, (await readFile(ruta, 'utf8')).replace(/^aprobado:.*$/m, `aprobado: enviado ${new Date().toISOString()}`));
  console.log(`✓ enviado a ${para} (${json.id}) · hoy ${e.deHoy + 1}/${e.cupo}`);
}
