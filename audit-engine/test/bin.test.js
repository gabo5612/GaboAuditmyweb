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
