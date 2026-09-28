/* bin/send.js: las reglas que deciden si un correo sale. La red no se toca —
   se prueban las funciones puras, que es donde vive cada regla. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cupoDelDia, leerBorrador, pie } from '../bin/send.js';

const dia = s => new Date(s + 'T12:00:00Z');

test('calentamiento: 10/día la primera semana, 15 la segunda, 20 después', () => {
  assert.equal(cupoDelDia([], dia('2026-10-01')), 10);
  assert.equal(cupoDelDia(['2026-10-01'], dia('2026-10-07')), 10);
  assert.equal(cupoDelDia(['2026-10-01'], dia('2026-10-08')), 15);
  assert.equal(cupoDelDia(['2026-10-01'], dia('2026-10-14')), 15);
  assert.equal(cupoDelDia(['2026-10-01'], dia('2026-10-15')), 20);
  assert.equal(cupoDelDia(['2026-10-01'], dia('2027-01-01')), 20);
});

test('el calentamiento cuenta desde el PRIMER envío, no desde el último', () => {
  assert.equal(cupoDelDia(['2026-10-01', '2026-10-20'], dia('2026-10-21')), 20);
});

test('leerBorrador separa cabecera y cuerpo, y el asunto conserva sus dos puntos', () => {
  const { cab, cuerpo } = leerBorrador('---\npara: a@b.com\nasunto: Re: x: y\naprobado: si\n---\nHola\n\nAdiós\n');
  assert.equal(cab.para, 'a@b.com');
  assert.equal(cab.asunto, 'Re: x: y');
  assert.equal(cab.aprobado, 'si');
  assert.equal(cuerpo, 'Hola\n\nAdiós');
});

test('un borrador sin cabecera no se interpreta a medias', () => {
  assert.throws(() => leerBorrador('para: a@b.com\nHola'), /cabecera/);
});

test('el pie lleva la dirección postal y la forma de darse de baja (CAN-SPAM)', () => {
  const p = pie('Calle 1, 28001 Madrid, Spain');
  assert.match(p, /Calle 1, 28001 Madrid, Spain/);
  assert.match(p, /unsubscribe/i);
  assert.match(p, /gaboauditmyweb\.dev/);
});

test('el teléfono va en el pie si está configurado, y no deja un separador colgando si no', () => {
  assert.match(pie('X', '+49 151 26044084'), /gaboauditmyweb\.dev · \+49 151 26044084/);
  assert.doesNotMatch(pie('X'), /· \n/);
});

/* bin/draft.js: el asunto no puede prometer peor de lo que se midió, y una
   tienda rápida no recibe un correo de «tu tienda es lenta». */
import { borradores } from '../bin/draft.js';

const auditoria = (score, lcp) => ({
  tienda: { host: 'www.tienda.com' },
  rendimiento: { movil: { score, metricas: { lcp_s: lcp } } },
});
const opts = { informe: 'https://gaboauditmyweb.dev/audit/' + 'a'.repeat(32), para: 'hello@tienda.com' };

test('borrador: el asunto redondea el LCP mediano hacia abajo y quita el www', () => {
  const [uno, dos, tres] = borradores(auditoria(38, 9.87), opts);
  assert.match(uno.texto, /asunto: tienda\.com takes 9s to show anything on mobile/);
  assert.match(dos.texto, /asunto: Re: tienda\.com takes 9s/);
  assert.match(tres.texto, /asunto: Closing the loop on tienda\.com/);
  for (const b of [uno, dos, tres]) assert.match(b.texto, /aprobado: no/);
});

test('borrador: sin --loom queda el marcador, y send.js no enviará', () => {
  assert.match(borradores(auditoria(38, 6.2), opts)[0].texto, /\{loom\}/);
  assert.doesNotMatch(borradores(auditoria(38, 6.2), { ...opts, sinLoom: true })[0].texto, /loom/i);
});

test('borrador: una tienda con score > 75 o LCP < 3 s no recibe este correo', () => {
  assert.throws(() => borradores(auditoria(82, 6), opts), /75/);
  assert.throws(() => borradores(auditoria(60, 2.9), opts), /no duele/);
});
