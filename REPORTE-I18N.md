# Capa bilingüe EN/ES en la web — informe de trabajo

**Fecha:** 13 de agosto de 2026
**Alcance:** servir el sitio en inglés o en español según el idioma del visitante,
sin build step, sin dependencias y sin duplicar el markup.
**Repo:** `gabo5612/GaboAuditmyweb`, rama `main`.

---

## 1. Resumen

El sitio se sirve ahora en inglés o en español sin build step, sin dependencias y
sin duplicar `index.html`. El inglés sigue escrito en el markup; el español se
superpone en el cliente desde un diccionario, y el idioma se elige solo.

Cuatro archivos tocados, uno nuevo:

| Archivo | Estado | Líneas | Qué cambió |
|---|---|---:|---|
| `assets/i18n.js` | **nuevo** | 369 | Detección de idioma, diccionario ES (172 claves), motor de sustitución, selector |
| `index.html` | modificado | 485 | 171 atributos `data-i18n*`, selector EN/ES en la cabecera, doble etiqueta en el CTA |
| `assets/main.js` | modificado | 170 | Cadenas y formato numérico vía `i18n`, re-render al cambiar idioma |
| `assets/styles.css` | modificado | 655 | Componente `.lang`, `.btn__full`/`.btn__short`, ajustes responsive |
| `CLAUDE.md` | modificado | 178 | Documentada la capa, sus invariantes y lo que no se traduce |

Sin dependencias nuevas. La única petición externa del sitio sigue siendo la hoja
de Google Fonts.

---

## 2. Decisión de arquitectura

Se consideraron tres caminos:

| Opción | Ventaja | Por qué no / sí |
|---|---|---|
| Dos HTML (`index.html` + `es/index.html`) | Cada idioma indexable, `hreflang` limpio | Duplica 485 líneas de markup sin plantillas; toda edición de copy se hace dos veces y diverge al primer despiste. Contra el grano del repo, que declara "no templating". |
| Build step que genera ambos | Sin duplicación en fuente | Introduce el paso de build que el proyecto evita a propósito |
| **Capa JS sobre el inglés** ✅ | Una sola fuente de copy, cero build, cero dependencias | El coste es SEO: el español no se indexa por separado (§10) |

Se eligió la tercera. El comprador objetivo declarado en `CLAUDE.md` es US/UK/CA/AU,
así que el SEO que importa es el inglés — y ése queda intacto, servido en HTML
estático. El español es cortesía para el visitante hispanohablante, no un canal
de captación separado.

**El inglés es la fuente de verdad.** No hay diccionario `en`: el inglés es
literalmente lo que dice el markup. Esto tiene tres consecuencias buscadas:

1. Con `i18n.js` bloqueado o caído, la página sigue completa y correcta.
2. Una clave que falte en español cae al inglés del markup — la página se degrada
   a inglés, nunca a huecos en blanco.
3. No hay forma de que el inglés y "el diccionario inglés" se desincronicen,
   porque no existe el segundo.

---

## 3. Cómo funciona

### 3.1 Detección

Orden de prioridad, en `detect()`:

1. `?lang=es` / `?lang=en` en la URL
2. La elección previa del visitante, en `localStorage` (`ga-lang`)
3. `navigator.languages`, primer tag cuya base sea `es` o `en`
4. Inglés

`localStorage` va envuelto en `try/catch`: en modo privado de Safari lanza, y ahí
la detección simplemente pasa al siguiente escalón.

### 3.2 Aplicación

El markup se marca con atributos, nunca con clases — misma regla que ya seguía
`main.js` con `data-scrub`, `data-leak` y compañía:

| Atributo | Qué traduce |
|---|---|
| `data-i18n` | `textContent` |
| `data-i18n-aria` | `aria-label` |
| `data-i18n-content` | `content` (metas) |
| `data-i18n-href` | `href` (el `mailto:` del CTA) |

No se usa `innerHTML` en ningún punto. Donde el elemento traía markup interno
—el `<span class="tick">✓</span>` de las listas, el `◆` de la garantía, el `+`
de las FAQ, el `<em>Milliseconds Make Millions</em>` de la fuente Deloitte— el
texto se envolvió en su propio `<span data-i18n>`. Traducir por `textContent`
elimina de raíz cualquier vía de inyección desde el diccionario.

### 3.3 Ida y vuelta

La primera vez que se toca un elemento se guarda su valor original en un `Map`
(`baseline()`). Volver a inglés no consulta ningún diccionario: restaura ese
snapshot. Por eso el inglés después de un ES→EN es idéntico, carácter a carácter,
al inglés de la carga inicial.

### 3.4 Superficie pública

```js
window.i18n = {
  lang,            // 'en' | 'es'
  locale,          // 'en-US' | 'es-ES'
  t(key, fallback) // fallback = el inglés, escrito en main.js
  num(n, decimals) // 4.2 → "4.2" / "4,2"
  money(n)         // 34000 → "$34,000" / "$34.000"
  set(lang)        // aplica, guarda y emite el evento
}
```

Al cambiar de idioma se emite `document` → `i18n:change`. `main.js` lo escucha en
el filmstrip y en la calculadora, así que ambos se repintan en el idioma nuevo sin
recargar y **sin perder lo que el visitante haya escrito** en los campos.

### 3.5 El selector

```html
<div class="lang" role="group" aria-label="Language · Idioma" data-lang-switch>
  <a class="lang__opt" href="?lang=en" hreflang="en" lang="en" data-lang="en" aria-current="true">EN</a>
  <a class="lang__opt" href="?lang=es" hreflang="es" lang="es" data-lang="es">ES</a>
</div>
```

Son enlaces reales con `?lang=`, no botones: si el handler de click no llega a
engancharse, seguirlos aterriza en una página que lee el parámetro y traduce
igual. Con el handler, el clic traduce en caliente, actualiza la URL por
`history.replaceState` (para que el enlace se pueda compartir ya traducido) y
guarda la elección.

El estado activo se marca con `aria-current` **y** con relleno, no sólo con color
— regla 02 del sistema de diseño. El markup estático marca EN como activo, que es
correcto sin JS.

---

## 4. Cambios en `main.js`

Tres cosas, todas mínimas:

**Números por locale.** El reloj del filmstrip y las cifras de la calculadora pasan
por `i18n.num` / `i18n.money`. La misma cantidad se lee `$34,000` en inglés y
`$34.000` en español. Es exactamente lo que ya hace `audit-engine/src/money.js`,
que formatea según el locale del cliente porque "un separador de miles equivocado
delata que el informe es una plantilla".

**El importe no cambia nunca.** `TARGET_LCP = 2.5`, `LOSS_PER_S = 8`,
`MAX_LOSS = 45` siguen intactos y siguen siendo los mismos que en `money.js`. El
invariante de espejo con el audit-engine se mantiene: sólo cambia cómo se imprime
la cifra, no la cifra.

**Cadenas armadas en JS.** La fórmula y el CTA de la calculadora se montan con
plantillas de marcadores, con el inglés como argumento de fallback:

```js
fill(i18n.t('calc.cta', 'Find {leak} in 48 hours →'), { leak: amount })
```

El diccionario reutiliza los mismos `{marcadores}`. La calculadora tiene además
una variante para cuando el tope del 45% entra en juego (`calc.formulaCapped`),
de modo que la ecuación impresa evalúe a la cifra que se muestra encima incluso
en las tiendas más lentas — que son justo las que la página busca.

Si `i18n.js` faltara, `main.js` cae a un objeto local con formato `en-US` y los
fallbacks ingleses. La página no se rompe.

---

## 5. CSS y layout

El español ocupa más que el inglés y la cabecera ya iba justa. Lo que hizo falta:

| Regla | Motivo |
|---|---|
| `.lang`, `.lang__opt` | Componente nuevo. Mono (regla 01: son códigos, son dato), 36px de alto, activo por relleno + `aria-current` |
| `.nav__link { white-space: nowrap }` | "Sobre mí" se partía en dos líneas por el espacio |
| `.btn__full` / `.btn__short` | El CTA de cabecera lleva dos etiquetas y CSS elige una; bajo 520px se muestra la corta |
| `.brand__role { display:none }` bajo 520px | Libera ~137px para que marca, selector y CTA quepan en una fila a 360px |
| `.nav { gap:12px }`, `.lang__opt { padding:0 10px }` bajo 720px | Compactar sin tocar el ritmo del resto |

Además, dos etiquetas de la navegación española se acortaron para que la barra
quepa a 721px, que es el ancho más hostil (justo por encima del breakpoint donde
los enlaces se ocultan): `Work` → **Demo** (no "Antes/después") y el CTA de
cabecera → **Auditoría gratis** (el largo se queda en el hero). El badge de precio
pendiente es "▲ Precio por fijar" para no partirse en dos líneas.

Anchos comprobados por captura: **360, 390, 520, 721, 768, 900 y 1200px**, en los
dos idiomas.

---

## 6. La traducción

172 claves. Criterio de voz: el mismo registro del inglés —directo, sin hype, cada
número con su fuente— y tuteo, igual que la copy del `audit-engine`.

**No se traduce, a propósito:**

- El nombre de marca ("Gabriel Arias").
- Los precios (`€ —`) y los placeholders mono, que siguen siendo huecos declarados.
- `Milliseconds Make Millions`: es el título de un informe, no una frase.
- Las respuestas de FAQ siguen marcadas `Placeholder.` también en español —
  traducirlas no las convierte en definitivas.
- El `mailto:` **sí** se traduce (asunto y cuerpo) mediante `cta.mailto`.

---

## 7. Verificación

Todo lo de abajo está ejecutado, no razonado. Servidor: `python3 -m http.server 8765`.
Navegador: `chrome-headless-shell` (el binario de la caché de Playwright), manejado
por CDP para poder simular clics y escribir en los campos.

### 7.1 Paridad del inglés con el markup estático

Es el invariante que más fácil se rompe con una capa así: el render inicial en
inglés tiene que ser idéntico al HTML estático.

```
EN default  lang="en"  leak "$34,000"
            formula "$250,000 × (4.2s − 2.5s) × 8%/s = $34,000/mo"
            cta "Find $34,000 in 48 hours →"   clock "3.0s"
            title "Gabriel Arias · Shopify performance"
```

Coincide carácter a carácter con lo que trae `index.html`. ✅

### 7.2 Español

```
ES default  lang="es"  leak "$34.000"
            formula "$250.000 × (4,2s − 2,5s) × 8%/s = $34.000/mes"
            cta "Encuentra $34.000 en 48 horas →"   clock "3,0s"
            title "Gabriel Arias · Rendimiento Shopify"
```

Detectado sólo por `--accept-lang=es-ES`, sin parámetro ni elección previa. ✅

### 7.3 Rama del tope (LCP 12s)

```
EN capped   $250,000 × min(45%, (12.0s − 2.5s) × 8%/s) = $112,500/mo
ES capped   $250.000 × mín(45%, (12,0s − 2,5s) × 8%/s) = $112.500/mes
```

La ecuación impresa evalúa a la cifra mostrada en los dos idiomas. ✅

### 7.4 Cambio de idioma con la calculadora sucia

Con LCP en 12s y en español, clic en EN:

```
ES→EN dirty  lang="en"  leak "$112,500"
             formula "$250,000 × min(45%, (12.0s − 2.5s) × 8%/s) = $112,500/mo"
```

Se reformatea sin perder el valor introducido ni recargar. ✅

### 7.5 Prioridad y persistencia

| Escenario | Resultado |
|---|---|
| Navegador `en-US`, sin parámetro | `en`, `aria-current` en EN, `localStorage` vacío |
| Clic en ES | `es`, URL → `?lang=es`, `ga-lang` = `es` |
| Recarga sin parámetro | `es` — manda la elección guardada sobre el navegador |
| Clic en EN | `en`, inglés restaurado desde el snapshot |
| Navegador `es-ES` + `?lang=en` | `en` — manda la URL sobre el navegador |

Todos ✅.

### 7.6 Auditoría de claves

Comprobación de que markup y diccionario están completos en las dos direcciones:

```bash
node -e "
const fs=require('fs');
const html=fs.readFileSync('index.html','utf8');
const js=fs.readFileSync('assets/i18n.js','utf8');
const main=fs.readFileSync('assets/main.js','utf8');
const used=new Set();
for(const m of html.matchAll(/data-i18n(?:-(?:aria|content|href))?=\"([^\"]+)\"/g)) used.add(m[1]);
for(const m of main.matchAll(/'(calc\.[\w]+)'/g)) used.add(m[1]);
const body=js.slice(js.indexOf('var ES = {'), js.indexOf('var DICTS'));
const dict=new Set();
for(const m of body.matchAll(/^\s*'([\w.]+)':/gm)) dict.add(m[1]);
console.log('missing:',[...used].filter(k=>!dict.has(k)));
console.log('orphan:',[...dict].filter(k=>!used.has(k)));
"
# markup+js keys: 172   dict: 172   missing: []   orphan: []
```

Conviene volver a pasarla cada vez que se toque copy. ✅

### 7.7 Revisión visual

Capturas de página completa en español a 1200px (hero, franja de datos,
filmstrip, calculadora, anatomía del informe, planes, casos, proceso, sobre mí,
FAQ, CTA y footer) más la cabecera en los siete anchos citados. Nada se desborda,
nada se parte mal, ningún hueco vacío.

---

## 8. Invariantes del proyecto, y cómo quedan

| Invariante | Estado |
|---|---|
| El JS sólo refina; la página es legible con el JS bloqueado | ✅ El inglés completo está en el HTML |
| Markup estático y render inicial coinciden | ✅ Comprobado carácter a carácter (§7.1) |
| El JS lee el DOM por `data-*`, nunca por clases | ✅ La capa i18n usa `data-i18n*` y `data-lang` |
| `money.js` ↔ `main.js`: mismo objetivo, coeficiente y tope | ✅ Sin tocar; sólo cambia el formato de impresión, como ya hacía `money.js` por locale |
| Dato en mono, con `tabular-nums` | ✅ El selector EN/ES es mono; las cifras no cambiaron de familia |
| El estado nunca es sólo color | ✅ El idioma activo lleva `aria-current` + relleno |
| Sin `prefers-color-scheme`, dark only | ✅ Sin ramas nuevas de tema |
| Nada de valores inventados en los huecos | ✅ Los placeholders siguen vacíos, ahora también en español |

---

## 9. Limitaciones conocidas

Dichas explícitamente, ninguna es un bug:

1. **El español no se indexa por separado.** Una sola URL, sin `hreflang`. Si algún
   día importa, hace falta el dominio real y páginas servidas por separado.
   Anotado en `CLAUDE.md`.
2. **Parpadeo de idioma.** El visitante hispanohablante puede ver un instante de
   inglés antes de que corra `i18n.js` (script `defer`). Es inherente a traducir en
   cliente sin servidor ni build; en una página de este tamaño son milisegundos.
3. **Con JavaScript totalmente desactivado el sitio es inglés** y el selector es
   inerte. El markup sigue siendo correcto —no queda a medio traducir—, pero no hay
   forma de ofrecer español sin ejecutar nada.
4. **`?lang=` sólo acepta `en` y `es`.** Cualquier otro valor se ignora y se sigue
   con la detección normal.
5. Las FAQ y los precios siguen pendientes de decisión, en los dos idiomas.

---

## 10. Para mantenerlo

Añadir copy nueva son dos pasos:

1. Poner `data-i18n="seccion.clave"` en el elemento (o `-aria` / `-content` /
   `-href` si es un atributo).
2. Añadir esa misma clave a `ES` en `assets/i18n.js`.

Y pasar la auditoría de §7.6 antes de dar por cerrado. Si la copy se arma en JS,
el inglés va como segundo argumento de `i18n.t()` y el español como clave con los
mismos `{marcadores}`.

Nada de esto se ha commiteado — los cambios están en el working tree.
