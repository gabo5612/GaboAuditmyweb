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

import { comprobar, leerMetadatos } from '../src/seo.js';

const checks = htmlProducto => comprobar({
  origin: 'https://t.test/',
  paginas: [
    { rol: 'home', url: 'https://t.test/', html: '<title>T</title><h1>T</h1>' },
    { rol: 'producto', url: 'https://t.test/products/a', html: htmlProducto },
  ].map(p => ({ ...p, meta: leerMetadatos(p) })),
  robots: { existe: false }, sitemap: { existe: false }, notFound: { correcto: true, status: 404 },
  duplicada: { medible: false, motivo: 'x' }, llms: { existe: false }, xRobotsTag: null,
}).find(c => c.id === 'schema_product');

test('schema_product: los microdatos cuentan', () => {
  const c = checks('<div itemscope itemtype="https://schema.org/Product"><span itemprop="price">9</span><link itemprop="availability" href="https://schema.org/InStock"></div>');
  assert.equal(c.estado, 'pasa');
});

test('schema_product: sin nada en el HTML inicial es aviso, no fallo — Google ejecuta JS', () => {
  const c = checks('<title>A</title><h1>A</h1>');
  assert.equal(c.estado, 'aviso');
  assert.match(c.evidencia, /Rich Results Test/);
});

test('schema_product: en un ProductGroup la disponibilidad puede vivir en la variante', () => {
  const ld = { '@type': 'ProductGroup', name: 'x', image: 'i', offers: { price: 1, priceCurrency: 'GBP' },
    hasVariant: [{ '@type': 'Product', offers: { availability: 'https://schema.org/InStock' } }] };
  const c = checks(`<script type="application/ld+json">${JSON.stringify(ld)}</script>`);
  assert.equal(c.estado, 'pasa');
});

import { comprobarRutaDuplicada } from '../src/seo.js';

test('ruta duplicada: se construye con un producto que está en la colección', async () => {
  activo = interceptarFetch([
    ['/collections/sofas/products.json', respuesta({ products: [{ handle: 'linen-sofa' }] })],
    ['/collections/sofas/products/linen-sofa', respuesta('<link rel="canonical" href="https://t.test/products/linen-sofa">', { url: 'https://t.test/collections/sofas/products/linen-sofa' })],
  ]);
  const r = await comprobarRutaDuplicada('https://t.test/products/otro-producto', 'https://t.test/collections/sofas');
  assert.equal(r.url, 'https://t.test/collections/sofas/products/linen-sofa');
  assert.equal(r.correcto, true);
});

test('la tarjeta regalo no se toma como muestra de producto', async () => {
  activo = interceptarFetch(json);
  const callar = silenciar();
  const r = await descubrirPaginas('https://tienda.test', '<a href="/products/gift-card">Gift</a><a href="/products/mug">Mug</a>');
  callar();
  assert.equal(r.producto, 'https://tienda.test/products/mug');
});

import { analizarImagenes } from '../src/page.js';

test('imágenes del CDN de Shopify no cuentan como «sin formato moderno»: las negocia a WebP', () => {
  const r = analizarImagenes(
    '<img src="//www.rumpl.com/cdn/shop/files/hero.jpg?width=800">'
    + '<img src="https://cdn.shopify.com/s/files/1/x.png">'
    + '<img src="/cdn/shop/files/y.jpg">'
    + '<img src="https://otro-cdn.com/z.jpg">');
  assert.equal(r.sin_formato_moderno, 1, 'sólo la de fuera de Shopify');
});
