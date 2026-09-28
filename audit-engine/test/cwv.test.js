import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fallasCampo } from '../src/cwv.js';

const campo = (lcp, inp, cls) => ({
  disponible: true, fecha: '2026-09-26', fuente: 'CrUX',
  series: {
    largest_contentful_paint: { ultimo: lcp },
    interaction_to_next_paint: { ultimo: inp },
    cumulative_layout_shift: { ultimo: cls },
  },
});

test('sin dato de campo devuelve null, no «aprueba»', () => {
  assert.equal(fallasCampo({ disponible: false }), null);
  assert.equal(fallasCampo(undefined), null);
});

test('los umbrales son los de Google, y el propio umbral aprueba', () => {
  assert.deepEqual(fallasCampo(campo(2500, 200, 0.1)).fallas, []);
  assert.deepEqual(fallasCampo(campo(2501, 201, 0.11)).fallas.map(f => f.metrica), ['LCP', 'INP', 'CLS']);
});

test('una métrica sin dato no cuenta como fallo', () => {
  assert.deepEqual(fallasCampo(campo(null, 322, null)).fallas.map(f => f.texto), ['INP 322 ms']);
});
