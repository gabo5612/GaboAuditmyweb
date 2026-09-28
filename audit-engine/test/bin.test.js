/* Cada comando de bin/ tiene que ARRANCAR. batch.js dejó de hacerlo por una
   const declarada debajo de su primer uso (zona muerta temporal), y ningún
   test lo vio porque todos importan src/, no ejecutan bin/. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const bin = fileURLToPath(new URL('../bin/', import.meta.url));

for (const f of readdirSync(bin).filter(f => f.endsWith('.js'))) {
  test(`bin/${f} arranca`, () => {
    const r = spawnSync(process.execPath, [bin + f, '--help'], { encoding: 'utf8', timeout: 20000, env: { ...process.env, PAGESPEED_API_KEY: '', RESEND_API_KEY: '' } });
    const salida = r.stdout + r.stderr;
    assert.doesNotMatch(salida, /ReferenceError|SyntaxError|TypeError|Cannot find module/, salida);
  });
}

/* --help sale antes del resumen, así que no ve lo que hay debajo. Una cola
   con un dominio que no resuelve recorre el lote entero hasta resumen.csv
   sin gastar cuota: el modo SEO no llama a PSI. */
test('bin/batch.js llega hasta el resumen', async () => {
  const { mkdtempSync, writeFileSync, existsSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const dir = mkdtempSync(tmpdir() + '/lote-');
  writeFileSync(dir + '/cola.csv', 'url,email\nno-existe.invalid,a@b.com\n');
  const r = spawnSync(process.execPath, [bin + 'batch.js', dir + '/cola.csv', '--seo', '--out', dir + '/out'], { encoding: 'utf8', timeout: 60000 });
  assert.doesNotMatch(r.stdout + r.stderr, /ReferenceError|TypeError/, r.stderr);
  assert.ok(existsSync(dir + '/out/resumen-seo.csv'), 'escribió resumen-seo.csv');
});

import { sinClave } from '../src/util.js';

test('la API key nunca aparece en un mensaje de error (repo y logs públicos)', () => {
  assert.equal(sinClave('https://x/runPagespeed?url=a&key=AIzaSECRET&strategy=mobile'),
    'https://x/runPagespeed?url=a&key=***&strategy=mobile');
});
