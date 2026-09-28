/* Qué páginas se toman como muestra. El 28 sep 2026, 7 de 60 tiendas
   salieron con «plantilla en noindex» porque products.json empieza por lo
   último creado — un complemento o una copia oculta a propósito. */

import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { descubrirPaginas } from '../src/page.js';
import { interceptarFetch, respuesta, silenciar } from './helpers.js';

let activo = null;
afterEach(() => { activo?.restaurar(); activo = null; });

const json = [
  ['/products.json', respuesta({ products: [{ handle: 'headboard-add-on-cherry' }] })],
  ['/collections.json', respuesta({ collections: [{ handle: 'tote-bag' }] })],
];

test('se prefiere el producto y la colección que enlaza la home', async () => {
  activo = interceptarFetch(json);
  const html = '<a href="/collections/all">All</a><a href="/collections/sofas/products/x">x</a>'
    + '<a href="/collections/sofas">Sofas</a><a href="/products/linen-sofa">Sofa</a>';
  const callar = silenciar();
  const r = await descubrirPaginas('https://tienda.test', html);
  callar();
  assert.equal(r.producto, 'https://tienda.test/products/x', 'la ruta canónica, no la de colección');
  assert.equal(r.coleccion, 'https://tienda.test/collections/sofas', 'ni /collections/all ni una ruta de producto');
});

test('si la home no enlaza nada, se cae a products.json', async () => {
  activo = interceptarFetch(json);
  const callar = silenciar();
  const r = await descubrirPaginas('https://tienda.test', '<html></html>');
  callar();
  assert.equal(r.producto, 'https://tienda.test/products/headboard-add-on-cherry');
  assert.equal(r.coleccion, 'https://tienda.test/collections/tote-bag');
});

import { rutaNormalizada } from '../src/seo.js';

test('ruta: el prefijo de mercado de Shopify Markets y la caja del %xx no cuentan', () => {
  assert.equal(rutaNormalizada('https://afends.com/en-eu/products/singlet'), '/products/singlet');
  assert.equal(rutaNormalizada('https://x.com/fr/products/a/'), '/products/a');
  assert.equal(rutaNormalizada('https://fablepets.com/products/reggie%e2%84%a2-toy'),
    rutaNormalizada('https://fablepets.com/products/reggie%E2%84%A2-toy'));
  assert.equal(rutaNormalizada('https://x.com/'), '/');
  assert.notEqual(rutaNormalizada('https://x.com/products/a'), rutaNormalizada('https://x.com/products/b'));
});

import { leerJsonLd } from '../src/seo.js';

test('JSON-LD: vacío no cuenta, saltos crudos son tolerables y se leen, lo ilegible es roto', () => {
  const html = '<script type="application/ld+json"></script>'
    + '<script type="application/ld+json">{"@type":"Product","description":"KITCHEN\nDUTY","name":"x"}</script>'
    + '<script type="application/ld+json">{"@type": "Product", </script>';
  const r = leerJsonLd(html);
  assert.equal(r.rotos, 1);
  assert.equal(r.tolerables, 1);
  assert.deepEqual(r.tipos, ['Product'], 'el Product del bloque tolerable se ve');
  assert.equal(r.bloques[0].description, 'KITCHEN\nDUTY');
});
