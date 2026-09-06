# Informe de trabajo

**Proyecto:** `gabo5612/GaboAuditmyweb` · sitio de Gabriel Arias (rendimiento Shopify) y su motor de auditoría
**Fecha:** 13 de agosto de 2026
**Punto de partida:** repositorio con un solo commit y un `README.md` de una línea

---

## Índice

1. [Resumen](#1-resumen)
2. [Alcance: qué es mío y qué no](#2-alcance-qué-es-mío-y-qué-no)
3. [Fase A: el sitio](#3-fase-a-el-sitio)
4. [Fase B: el motor de auditoría](#4-fase-b-el-motor-de-auditoría)
5. [Fase C: verificación](#5-fase-c-verificación)
6. [Fase D: revisión y correcciones](#6-fase-d-revisión-y-correcciones)
7. [Fase E: el rediseño a dos vías](#7-fase-e-el-rediseño-a-dos-vías)
8. [Fase F: build, despliegue y fuentes](#8-fase-f-build-despliegue-y-fuentes)
9. [Catálogo de fallos encontrados](#9-catálogo-de-fallos-encontrados)
10. [Decisiones que conviene no revertir](#10-decisiones-que-conviene-no-revertir)
11. [Estado actual e inventario](#11-estado-actual-e-inventario)
12. [Lo que falta](#12-lo-que-falta)

---

## 1. Resumen

Cinco bloques de trabajo, en este orden:

| Bloque | Qué salió |
|---|---|
| **Sitio** | Estático desde el diseño de Claude Design. Sin framework. |
| **Motor** | Fases 0 a 2 de `workflow-auditoria-automatizada.md`: recogida, informe y lote. Cero dependencias. |
| **Verificación** | 129 tests y una revisión de código que destapó 12 hallazgos, 8 de ellos corregidos aquí. |
| **Rediseño** | El diseño pasó a un hub de dos vías vendidas por separado: tres páginas, bilingüe. |
| **Producción** | Minificador propio, despliegue en Vercel y fuentes servidas desde el propio origen. |

**Estado:** todo verde (`129/129`), desplegado y verificado en producción. Hay **un bloqueante externo**: sin una clave de PageSpeed Insights el motor no puede recoger datos, y esa clave no la puedo sacar yo.

El hallazgo más caro de todo el trabajo fue una fórmula que no cuadraba con el número impreso encima, en el propio documento que se le manda al cliente. Está en la [sección 9](#9-catálogo-de-fallos-encontrados).

Y el patrón que más se repite en ese catálogo, hasta el final: **casi ningún fallo daba error.** El build terminaba bien, la página se veía bien, el despliegue decía «listo». Lo que cambiaba era un número, un color, una tipografía o una regla de CSS que ya no estaba. Por eso las comprobaciones que se añadieron comparan salidas, no procesos.

---

## 2. Alcance: qué es mío y qué no

Durante el trabajo hubo **otra sesión escribiendo en paralelo** sobre los mismos archivos. Para que este informe sirva de algo, la separación:

**Escrito en esta sesión**

- `index.html`, `assets/styles.css`, `assets/main.js`
- `audit-engine/`: `util.js`, `psi.js`, `crux.js`, `page.js`, `infra.js`, `apps.js`, `signatures.js`, `money.js`, `score.js` (velocidad), `collect.js`, `validate.js` (`validarAnalisis`), `report/template.js`
- `bin/audit.js`, `bin/batch.js`, `bin/report.js`
- `analysis/prompt.md`, `analysis/schema.json`, `fixtures/`, `queue.example.csv`
- `.github/workflows/audit-batch.yml`, `.gitignore`, `CLAUDE.md`, `audit-engine/README.md`
- Toda la suite: `test/helpers.js`, `test/fixtures/`, `recogida.test.js`, `analisis.test.js`, `informe.test.js`, `regresiones.test.js`

**Aparecido desde la sesión paralela** (no lo he escrito ni revisado a fondo)

- Pista de SEO completa: `src/seo.js`, `src/seo-collect.js`, `report/seo-template.js`, `bin/seo.js`, `analysis/seo-prompt.md`, `analysis/seo-schema.json`, `test/seo.test.js`
- Añadidos a archivos míos: `validarAnalisisSeo` en `validate.js`, `calcularScoreSeo` en `score.js`, `x_robots_tag` en `infra.js`, la bandera `--seo` en `batch.js` y `report.js`
- `assets/i18n.js` y el marcado `data-i18n` del sitio

Cuando digo «arreglado» me refiero a lo mío. Los cuatro hallazgos de la revisión que caen en la pista de SEO están listados sin tocar, en la [sección 12](#12-lo-que-falta).

---

## 3. Fase A: el sitio

### Origen

Importado del proyecto de Claude Design `5cae3bfa-7493-4859-82c8-ca64d6e9d52d`, archivos `Home · Gabriel Arias.dc.html` y `Design System · Gabriel Arias.dc.html`. Son componentes `.dc.html` —plantilla `<x-dc>` con enlaces `{{ }}` y una clase `DCLogic`—, no páginas ejecutables: hay que portarlos, no copiar el runtime.

### Decisión de stack

**Sin framework, a propósito.** El argumento de venta de la página es la velocidad y su héroe es un medidor de PageSpeed: servir un bundle contradiría el producto. Toda la interactividad del diseño —cabecera pegajosa, scrubber de la tira de carga, calculadora de pérdida— cabe en ~130 líneas de JavaScript sin dependencias.

### Cómo quedó

| Archivo | Contenido |
|---|---|
| `index.html` | La página entera, marcado semántico |
| `assets/styles.css` | Tokens del sistema en `:root`, luego componentes |
| `assets/main.js` | Tres IIFE: cabecera, tira de carga, calculadora |

> Esta fue la primera versión. El diseño cambió después a un hub de dos vías con tres páginas; ver la [sección 7](#7-fase-e-el-rediseño-a-dos-vías).

**El JS sólo refina.** Cada sección es legible y usable con `main.js` bloqueado: la tira renderiza un estado intermedio válido desde atributos `opacity` en línea, la calculadora trae su resultado correcto ya en el HTML, y el FAQ son `<details>` nativos. El marcado estático y el primer render del JS tienen que coincidir: con el scrubber en `30` (3,0 s), eso significa cabecera «antes» visible, héroe y rejilla ocultos, y todos los marcos «después» visibles.

El JS lee el DOM por ganchos `data-*` (`data-scrub`, `data-leak`, `data-frame="bHero"`), nunca por clases. Las clases son para estilo; renombrar una no puede romper comportamiento.

### La sección del servicio de auditoría

Añadida después, al integrar el documento de workflow. Observación que cambió el encaje: **la auditoría ya era un servicio en la web** —la tarjeta «Audit / Free / 48 hours»—, así que el documento no describía un servicio nuevo sino la maquinaria de entrega del que ya se vendía.

En vez de una cuarta tarjeta, quedó:

- La tarjeta «Audit» enumera lo que se entrega de verdad (5 hallazgos, comparativa con 2 competidores, plan de 3 semanas, quick win, vídeo de 3 min)
- Sección `#report` con las **siete partes del informe** en su orden real, con la nº 04 —el quick win regalado— destacada en verde por ser la pieza de reciprocidad
- Tira de procedencia: con qué se mide, qué acompaña a cada cifra, qué pasa antes de que llegue al cliente

### Verificación del sitio

Renderizado en Chromium headless a 1280 px y 390 px. Comprobado: cruce de clases usadas contra clases definidas, balance de etiquetas, anclas sin destino. La tira de carga a 3,0 s enseña el marco «antes» todavía en blanco y el «después» pintado, que es exactamente la demostración pretendida.

---

## 4. Fase B: el motor de auditoría

Implementa las fases 0 a 2 de `workflow-auditoria-automatizada.md`. Node 18+, ESM, **cero dependencias** (así el workflow de GitHub Actions arranca sin `npm install`).

### La tubería

```
bin/audit.js  ─────────►  JSON crudo
   (etapa 2)                  │
                              ▼
              tú lo pegas en Claude con analysis/prompt.md
                   (etapa 3 — cero API keys)
                              │
                              ▼
                        JSON de análisis
                              │
                              ▼
bin/report.js ─────────►  informe HTML autocontenido
   (etapa 4)

bin/batch.js  ─────────►  lo mismo sobre un CSV, + resumen ordenado por lead score
   (fase 2)                    (workflow nocturno en Actions)
```

### Etapa 2: recogida

`bin/audit.js dominio.com --competidores a.com,b.com`

Recoge, cada dato con su fuente y su fecha:

- **PSI móvil y escritorio**: score, LCP, CLS, TBT, speed index, FCP, TTI; oportunidades de Lighthouse ordenadas por ahorro en ms con URLs concretas como evidencia; desglose de peso por tipo de recurso; terceros con su bloqueo del hilo principal
- **CrUX History API**: percentil 75 de usuarios reales y su **tendencia** (`empeora` / `mejora` / `estable`), que persuade mucho más que una foto fija
- **Estructura**: home + una ficha de producto + una colección, descubiertas por los endpoints públicos de Shopify o, si están capados, por los enlaces de la home
- **Apps instaladas** por tabla de firmas (~60 apps en 14 categorías), cada detección con la URL exacta que la disparó y su nivel de confianza
- **Apps duplicadas** por categoría — el hallazgo más fácil de vender: «tienes 4 apps de reseñas cargando a la vez»
- **Infraestructura**: cadena de redirecciones, compresión, CDN, `cache-control`, HSTS
- **Tema y moneda** del objeto `Shopify.theme` / `Shopify.currency`
- **Competencia**: el mismo test a los competidores que **tú** indicas
- **Dinero** y **lead score** 0–100

### Etapa 3: análisis

`analysis/prompt.md` + `analysis/schema.json`. Sin API: se pega en Claude, coste marginal cero, tal como propone el documento. El prompt lleva las seis reglas duras literales y una sección de límites de la entrada que el redactor debe respetar (que las apps inyectadas por Tag Manager no se ven, que `campo.disponible:false` no se sustituye por dato de laboratorio, etc.).

### Etapa 4: el informe

HTML de ~19 KB, **sin una sola petición externa**: ni fuentes, ni scripts, ni imágenes remotas. IBM Plex se pide pero no se descarga —si el cliente la tiene, la usa; si no, cae a la del sistema—. El informe es en sí mismo la demostración del producto.

Sirve con `noindex`, nombre de archivo con token de 32 caracteres (la URL *es* la contraseña), CSS de impresión que pasa a tinta negra sobre blanco, y las siete secciones del documento en orden. Bilingüe: el idioma sale del análisis y las cifras se formatean con el locale del cliente.

### La validación, que es el freno

`src/validate.js` convierte las reglas duras en código. **Si el análisis se las salta, el informe no se genera.** Es intencionado: el paso 5 de la checklist no puede corregir lo que nunca llega a existir.

Bloquea: hallazgo sin evidencia · más de cinco hallazgos · evidencia sin métrica, valor, fuente o fecha · fecha mal formada · plan que no dura tres semanas · importe en euros cuando la facturación del cliente es desconocida · score móvil > 75 sin confianza `baja`.

Avisa sin bloquear: jerga de agencia · cifras escritas en la prosa que no salen de los datos recogidos.

### Fase 2: el lote

`bin/batch.js queue.csv` procesa un CSV (3 en paralelo, que PSI aguanta de sobra) y produce un JSON por tienda más un `resumen.csv` ordenado por lead score: **ése es el orden en que grabas los Looms**. El workflow de Actions lo corre a las 03:00 UTC de lunes a viernes y deja el resumen en la pantalla del propio job, para poder mirarlo desde el móvil sin descargar nada.

`queue.csv`, `auditorias/`, `informes/` y `analisis/` están en `.gitignore`: llevan emails de prospectos y datos de tiendas de terceros.

### Lo que el motor NO hace, a propósito

- **No envía nada.** No hay Resend, ni cola, ni formulario. Eso es la fase 3, y la regla de parada del documento dice que no se construya hasta que ésta haya dado al menos una llamada agendada.
- **No renderiza páginas.** Sin navegador. Lo que depende de renderizar —si una imagen se sirve más grande de lo que se muestra— se toma de las oportunidades de Lighthouse en vez de estimarse.
- **No adivina competidores.** Los pones tú. Adivinarlos produciría comparaciones falsas, y una comparación falsa hunde el informe en la primera frase.
- **No inventa la facturación.** En outbound no la conoces: la pérdida sale en porcentaje y el importe queda vacío.

Cada límite viaja declarado en el propio JSON, en campos `alcance`, para que no se olvide al redactar.

---

## 5. Fase C: verificación

`npm test` · **129 tests, 27 suites, ~20 s**, `node:test`, sin instalar nada.

**La red se intercepta en `fetch`.** Eso permite que `psi.js` y `crux.js` ejecuten su camino real —construcción de la URL, clave de API, reintentos, parseo— contra respuestas grabadas con la forma exacta que devuelven las APIs. Por eso la suite corre sin clave y sin gastar cuota.

Además del parseo, la suite fija los invariantes que sostienen el producto:

- **La fórmula del dinero es idéntica a la de la web.** El test lee las tres constantes de `assets/main.js` con una expresión regular y las compara con `money.js`. Si alguien cambia una sola, el test cae.
- El informe no emite ni una petición externa
- El contenido hostil se escapa (un título con `<script>` no inyecta nada)
- Una tienda que no es Shopify se descarta **antes** de gastar cuota de PSI
- Un fallo de PSI marca la auditoría como fallida en vez de emitir un informe con huecos
- Cada hueco acaba declarado en `datos_faltantes`

### Lo que sigue sin verificar

`psi.js` y `crux.js` **nunca han tocado las APIs reales**. La cuota anónima de PSI está agotada de forma global y devuelve `429` siempre; sin `PAGESPEED_API_KEY` no hay manera. Las fixtures reproducen la forma documentada, pero si Google cambia el esquema la suite no se enteraría.

---

## 6. Fase D: revisión y correcciones

Revisión con `/code-review` en alto esfuerzo sobre las ~5.400 líneas del motor. **12 hallazgos.** Verifiqué uno a uno los que tocan mi código antes de cambiar nada, y corregí 8, cada uno con su test de regresión en `test/regresiones.test.js`.

Nota sobre `/fullstack-guardian`, que fue lo que se pidió: es un skill **constructor** (levanta aplicaciones full-stack con seguridad por capas), no un verificador. Para «¿esto funciona?» las herramientas correctas eran la suite de tests y `/code-review`.

---

## 7. Fase E: el rediseño a dos vías

### Qué cambió en el origen

Al reimportar el proyecto de Claude Design, el diseño ya no era el de una página con un servicio. Era un **hub de dos vías vendidas por separado** —velocidad y SEO técnico— con dos páginas nuevas. El propio `github.md` del proyecto lo marcaba: *«NOW AHEAD of the shipped page»*.

### Cómo quedó

| Página | Qué lleva |
|---|---|
| `index.html` | El hub: panel doble (medidor + `—/22`), las dos vías en paralelo cada una con su demo, la anatomía del informe, proceso, FAQ, CTA doble |
| `speed.html` | Tira de carga completa, la calculadora de ingresos, fila de Core Web Vitals, plan de 3 semanas, precios |
| `seo.html` | Demo de «lo que lee un crawler», los 5 defectos de Shopify, las 22 comprobaciones en cuatro grupos, plan de 4 semanas |

**Las dos vías no se mezclan ni se agrupan en un paquete.** El copy dice explícitamente que correr las dos en un mes obligaría a recortar una, y entonces ninguna de las dos garantías es defendible.

### Tres decisiones del port

**El selector de plantillas del demo SEO es CSS, no JavaScript.** Radios ocultos más selectores de hermano. El diseño original lo resolvía con estado de React; portarlo como IIFE habría metido una cuarta pieza que puede fallar. Verificado con el JS completamente bloqueado: las pestañas Producto/Colección/Inicio siguen funcionando, igual que el FAQ con `<details>` nativo.

**La calculadora se muda a `speed.html`**, como manda el diseño. `main.js` protege cada gancho, así que el mismo archivo sirve a las tres páginas y no hace nada donde falta un control.

**441 claves en español**, cuadradas en los dos sentidos: ninguna clave del marcado sin traducir, ninguna del diccionario inalcanzable. No se traducen los nombres de schema (`Product`, `ProductGroup`, `BreadcrumbList`…) ni los ids de comprobación: son literales que el cliente verá en su propio HTML.

### Tres ajustes que el diseño no cubría

- **El titular del hub nombra los dos problemas**, así que es la mitad más largo que el de las páginas de sprint. Al máximo compartido del `clamp` salía a ocho líneas y empujaba el panel fuera de pantalla; un escalón menos lo deja en cinco.
- **El filmstrip compacto** dentro de la tarjeta colapsaba a una columna por el `auto-fit` con suelo de 300 px — y ahí el sentido es justo la comparación. Columnas fijas.
- **La línea de rol del header** se comprimía contra el CTA en móvil; se oculta por debajo de 720 px, junto con la reflow de las tablas del demo y de los checks.

Verificado en Chromium a 1280 px y 390 px, en inglés y español, con y sin JS. Sin clases sin estilo, sin anclas rotas, sin etiquetas desbalanceadas.

---

## 8. Fase F: build, despliegue y fuentes

### El punto de partida: producción servía el fuente

Un Lighthouse móvil daba **0,91**. El diagnóstico no era el que parecía. Los bytes que servía el dominio coincidían exactamente con los archivos sin tocar —`styles.css` a 35.029 B—, así que **el minificado nunca llegaba a producción**: no había `vercel.json`, Vercel servía la raíz del repositorio, y `dist/` está en `.gitignore`.

### El minificador

`build.js`, sin dependencias como el resto del proyecto. No es un bundler y no reescribe código: quita comentarios y colapsa espacio, un 17 % en bruto. `node build.js --check` compara fuente contra `dist/` —texto, hueco a hueco entre etiquetas, claves `data-i18n`, ganchos `data-*`, ids y hrefs— y falla si algo se movió. Las tres páginas renderizan **idénticas píxel a píxel** en 1280 px y 390 px.

Escribirlo destapó tres fallos, todos silenciosos, y están en la [sección 9.7](#97-el-minificador-se-rompió-tres-veces-y-ninguna-daba-error).

### Lo que de verdad hundía el móvil

El propio informe de Lighthouse lo decía: `unminified-css` puntuaba **1 (pasa)**. El que costaba era `render-blocking`, con **1.820 ms** estimados, de los cuales 816 ms eran la cadena de Google Fonts: dos orígenes en serie, cada uno con su DNS, TCP y TLS, y el segundo sin poder arrancar hasta que el primero llegara y se parseara.

Las fuentes pasan a `assets/fonts/`, recortadas al juego de caracteres que estas tres páginas usan de verdad:

| | Antes | Ahora |
|---|---|---|
| Orígenes externos | 2, en serie | **0** |
| Fuentes | 60.629 B en 3 archivos | 56.404 B en 3 |
| Primera carga completa | 95.208 B | **70.860 B** |

Tres archivos y no seis: IBM Plex Sans es variable (uno cubre 400–600) y la mono sólo se usa a 400 y 600 — la única regla de peso 500 es `.btn--secondary`, que es sans.

### Lo que se verificó antes de dar el recorte por bueno

**`tnum` sobrevive.** La regla 01 del sistema de diseño pone cada cifra en mono con dígitos tabulares; si esa feature se cae, los números dejan de alinearse al cambiar de valor. Medido en el navegador: `111` y `000` miden exactamente lo mismo.

**Los símbolos `▲ ● ■ ◆` y las flechas no están en las fuentes, pero tampoco lo estaban antes.** Se descargó la fuente original que servía Google y se leyeron sus tablas `cmap`: IBM Plex no trae esos glifos en ningún subset, así que siempre se han pintado con la del sistema. No es una regresión del recorte. Queda registrado en `assets/fonts/cobertura.json`, y `build.js` avisa si el copy estrena un carácter fuera del recorte — un fallo que no rompe nada, sólo cambia de tipografía en esa letra, y que por eso no vería nadie.

**Un test propio daba falsos positivos y se descartó.** Medía si faltaba un glifo comparando anchos, inútil en una monoespaciada donde todos miden lo mismo, incluido el `notdef`. Sustituido por la lectura directa del `cmap`.

---

## 9. Catálogo de fallos encontrados

Todos comparten una forma, y es la que los hace peligrosos: **ninguno rompía nada. Todos producían un número, un color o un aviso tranquilizador y falso.**

### 9.1 El grave: la fórmula no daba el número impreso encima

El tope del 45% se aplicaba al resultado pero **no aparecía escrito en la ecuación**. En una tienda con LCP de 9,2 s el informe imprimía:

```
€250.000 × (9,2s − 2,5s) × 8%/s = €112.500
```

Esa ecuación da **€134.000**. A partir de 8,1 s de LCP —exactamente el perfil de tienda que este motor busca— el cliente recibía un documento cuya propia aritmética no cuadra, justo en la sección que presume de que *«tu desarrollador puede comprobarlo en treinta segundos»*.

**Corregido** escribiendo el tope dentro de la ecuación:

```
€250.000 × mín(45%, (9,2s − 2,5s) × 8%/s) = €112.500
```

Y el supuesto ahora explica que sin tope la estimación sería del 53,6%, que no es creíble. **El mismo defecto estaba en la calculadora de la web**, así que se corrigió en los dos sitios; comprobado en el navegador con LCP = 12.

### 9.2 El guardián de cifras estaba roto de cuatro formas, todas silenciosas

Es la pieza que impide mandar un número inventado a un prospecto de 2.000 €. Aceptaba prácticamente cualquier cosa:

| # | Mecanismo |
|---|---|
| 1 | Comparaba **subcadenas** sobre el JSON serializado entero: `"10"` casaba dentro de `"11044168"`. Cualquier cifra que redondease a un entero corto pasaba. |
| 2 | El `\b` final **nunca casa detrás de `%`** (ambos son no-palabra): **ningún porcentaje llegó a comprobarse jamás**. Justo la unidad donde se cuela un «subimos la conversión un 25%». |
| 3 | Al arreglar lo anterior, una tolerancia de `±0,5 × 1000` cubría ±500 ms alrededor de cada millar: **toda la recta numérica**. |
| 4 | La conversión s↔ms se aplicaba **sin mirar la unidad escrita**: un LCP de escritorio de 2,4 s validaba un «2400 kb». |

**Regla final**, comprobable de un vistazo: *un número escrito es legítimo si es el redondeo fiel de algo medido, a la precisión con la que se escribió*. Conversión s↔ms sólo si la unidad escrita es `s` o `ms`. Y el pajar son los **valores numéricos** del JSON, nunca dígitos dentro de cadenas, de modo que fechas, versiones e ids quedan fuera.

Discrimina los 29 casos que se le pusieron: acepta `5.2s`, `21.6%`, `7 s` (redondeo fiel de 7,1); avisa de `9.7s`, `25%`, `1570 ms` (derivado de sumar tres bloqueos), `2400 kb`, `2026 ms`. Los casos quedan fijados como tests: **un aviso que nunca salta es peor que no tenerlo, porque da una falsa sensación de red de seguridad**.

### 9.3 Fallos de parseo, encontrados al correr contra una tienda real

Corriendo el motor contra `allbirds.com`:

- **`<img :src="producto.imagen">` contaba como imagen.** El `\b` de la expresión regular casa entre `:` y `src`, así que los atributos enlazados de Vue/Alpine entraban. En los ejemplos del informe aparecían cosas como `cardRefs[`.
- **Los `hreflang` contaban como dominios de terceros.** Allbirds salía con 21 «terceros» que eran sus propios dominios de país. Un `<link rel="alternate">` apunta fuera pero no descarga nada.
- **Las fuentes con URL relativa al protocolo no se detectaban.** Shopify sirve `//cdn.shopify.com/…woff2` y la expresión exigía `https:`.

### 9.4 Un `clamp()` sin espacios

`clamp(2.5rem,1.8rem+3vw,4rem)` es CSS inválido: los operadores `+` y `−` en funciones matemáticas exigen espacios alrededor. La declaración entera se descartaba y la cifra grande del informe caía al tamaño por defecto: **16 px en vez de 64 px**.

### 9.5 El resto de la revisión

| Hallazgo | Qué pasaba |
|---|---|
| `--seo` se comía el argumento siguiente | `--out auditorias/ --seo` corría la auditoría de **velocidad** sobre toda la cola quemando cuota de PSI; en el otro orden, se tragaba el `--out` y escribía en la carpeta por defecto |
| LCP nulo → «0 %» | PSI podía responder sin LCP y el titular salía con un `0 %` tranquilizador y falso. Ahora es no medible: raya, sin fórmula, y el hueco declarado |
| Dominio muerto reventaba el CLI | Un DNS que no resuelve daba traza de pila sin JSON, en vez del `estado: "fallida"` que existe justo para eso |
| CrUX con el origen equivocado | Se preguntaba por el ápex cuando la tienda vive en `www` → 404 → el dato de usuarios reales se descartaba como «tráfico bajo» en tiendas que sí lo tienen. Y no estaba envuelto: un fallo de red tumbaba la auditoría entera por una fuente opcional |
| `null <= 0.1` es `true` | Una métrica ausente salía con el punto verde de «bien» al lado de una raya |
| Apóstrofo truncaba atributos | `alt="Australia's leading store"` se leía como `"Australia"`. La comilla de cierre no estaba atada a la de apertura |
| Apps perdían páginas | Al subir de confianza se reconstruía la entrada y se descartaban las páginas ya vistas |

### 9.6 Fallos en mis propios tests

Por honestidad: de los primeros fallos de la suite, varios eran **de los tests, no del código**. Un mock demasiado laxo que capturaba la llamada a PSI porque la URL del competidor viaja dentro del parámetro `url`; una aserción mal escrita; un evaluador de fórmulas que rompía con separadores de millar en inglés; una tolerancia que no contemplaba que la fórmula imprime el LCP redondeado; y una página de prueba con HTML vacío, que `detectarApps` salta por diseño.

---

### 9.7 El minificador se rompió tres veces, y ninguna daba error

Los tres fallos comparten forma: el build terminaba con éxito y el sitio parecía correcto.

**Quitar los comentarios CSS después de apartar los strings.** Un apóstrofo dentro de un comentario en prosa (`the container's background`) abría un string que no cerraba hasta el siguiente apóstrofo, varias reglas más abajo, y se llevaba por delante todo lo que hubiera en medio. Desaparecían reglas enteras. Apareció al buscar `#tpl-` en el CSS minificado —el selector del demo SEO— y no encontrar nada: nueve apariciones en el fuente, cero en `dist/`. La comprobación que quedó es más ancha y no depende de ninguna cifra fija: el número de reglas del fuente y el de `dist/` tienen que coincidir, sean las que sean.

**El comentario de bloque en JavaScript sólo se vaciaba en su primera línea.** El resto quedaba en el archivo como si fuera código. `node --check` sobre la salida lo cazó: `SyntaxError: Unexpected identifier`.

**Eliminar el espacio entre etiquetas.** Entre dos elementos en línea ese hueco se pinta, y borrarlo pega las palabras: «Deloitte,» contra «Milliseconds». Éste es el interesante, porque **mi propia verificación lo daba por bueno**: comparaba el texto con los espacios ya normalizados. Sólo apareció comparando píxeles, y aun así costó descartar antes que la diferencia fuera ruido de captura o carga de fuentes. Ahora el `--check` compara hueco a hueco, que es justo lo que el test anterior escondía.

### 9.8 Dos fallos de despliegue, cada uno con su deploy perdido

**`vercel.json` se valida contra un esquema estricto.** Puse claves `_comment` para explicar las decisiones dentro del archivo. Vercel no las ignora: invalida el despliegue. Dos commits se quedaron sin publicar y el sitio siguió sirviendo la versión anterior **sin ninguna señal de error** — sólo apareció al comprobar los bytes en producción y ver que el hash de las fuentes daba 404. Las explicaciones están ahora en `CLAUDE.md`.

**`immutable` escrito antes de ser cierto.** Los nombres de las fuentes eran fijos (`sans.woff2`), así que una caché de un año habría dejado a quien ya visitó la página con los glifos viejos si se volvía a recortar. La cabecera decía una cosa y el archivo permitía la contraria. Corregido con hash de contenido en el nombre (`sans.<hash>.woff2`) y reescritura del `url()` del CSS y de los `preload`. Como `--check` compara el marcado *antes* del renombrado, esa reescritura quedaba sin red: se añadió una comprobación de que toda fuente que `dist` pide existe en `dist`.

**Y un tercero, de orden.** Vercel aplica todas las reglas de cabecera que casan y la última gana, así que `/assets/(.*)` pisaba la caché inmutable de las fuentes. La regla genérica va primero.

---

## 10. Decisiones que conviene no revertir

1. **Sin framework en el sitio.** La página vende velocidad y su héroe es un medidor de PageSpeed.
2. **`money.js` es espejo de `assets/main.js`.** El número del informe de un cliente y el de la calculadora de la web tienen que coincidir o todo el conjunto se lee como improvisado. Hay un test que lo vigila; si cambias una constante, cambia las dos.
3. **Sin fuente, no hay número.** La recogida guarda `fuente` y `fecha` junto a cada cifra; la validación rechaza el hallazgo sin evidencia.
4. **Un hueco falla la auditoría, no se rellena.** Si PSI móvil falla, `collect.js` devuelve `fallida` y `report.js` se niega a generar. Todo lo no medible acaba en `datos_faltantes`, que el informe imprime.
5. **Nada llega a un prospecto sin revisión humana.** No existe código de envío, deliberadamente.
6. **Dark only.** `color-scheme: dark` y sin paleta clara; no añadir ramas `prefers-color-scheme`.
7. **Las dos vías se venden por separado.** Nunca un paquete: el copy explica que correr las dos en un mes obligaría a recortar una, y entonces ninguna garantía es defendible.
8. **El fuente es lo que se edita; `dist/` es lo que se despliega.** Y `dist/` no se versiona: lo genera el build de Vercel.
9. **Cero peticiones externas, fuentes incluidas.** La página vende velocidad; una cadena de dos orígenes en serie antes del primer pintado contradice el producto.
10. **Los marcadores de posición son intencionados.** Precios `€ —`, el medidor sin score, las tarjetas de estadística, los casos de estudio: cada uno con su distintivo ámbar. No son bugs y no se rellenan con valores inventados.

---

## 11. Estado actual e inventario

```
GaboAuditmyweb/
├── index.html                    447   el hub: las dos vías en paralelo
├── speed.html                    410   sprint de velocidad + calculadora
├── seo.html                      483   sprint de SEO + las 22 comprobaciones
├── build.js                      317   minificador y verificador, sin dependencias
├── vercel.json                    19   build command, salida y caché
├── assets/
│   ├── styles.css                983   @font-face, tokens, componentes
│   ├── main.js                   170   cabecera, tira de carga, calculadora
│   ├── i18n.js                   651   441 claves en español
│   └── fonts/                          sans + mono 400/600, recortadas · 56 KB
│       └── cobertura.json              qué glifos están y cuáles caen al sistema
├── audit-engine/
│   ├── bin/         audit · batch · report · seo
│   ├── src/         util · psi · crux · page · infra · apps · signatures
│   │                money · score · collect · validate  (+ seo, seo-collect)
│   ├── report/      template.js  (+ seo-template.js)
│   ├── analysis/    prompt.md · schema.json  (+ seo-*)
│   ├── fixtures/    datos sintéticos para probar sin gastar cuota
│   ├── test/        129 tests, red interceptada
│   └── README.md    manual de operación
├── .github/workflows/audit-batch.yml   lote nocturno
├── CLAUDE.md                     contexto para futuras sesiones
└── .gitignore                    protege emails de prospectos y dist/
```

**Líneas:** sitio 2.493 (+651 de `i18n.js`) · build 317 · motor ~3.620 · tests ~1.575

**Peso servido en la primera carga:** 70.860 B, de los cuales 43.128 B son las dos fuentes precargadas. Cero peticiones a terceros.

**Git:** seis commits en `main`, todos empujados a `gabo5612/GaboAuditmyweb` y atribuidos a `gabo5612 <gabo5612@gmail.com>`.

| Commit | Qué trae |
|---|---|
| `31d8ada` | Sitio de tres páginas y motor de auditoría |
| `87126cb` | Minifica el sitio en `dist/` para producción |
| `2798a7c` | Despliega `dist/` y sirve las fuentes desde el propio origen |
| `ed7c791` | Ordena las reglas de caché: las fuentes deben ganar |
| `e11989c` | Pone hash de contenido en el nombre de las fuentes |
| `659e5a4` | Quita las claves `_comment` de `vercel.json` |

**Producción:** `portfolio-2026-snowy-one.vercel.app` — pendiente de renombrar a `gaboauditmyweb.vercel.app` en el panel de Vercel (ver `PENDIENTES.md`), sirviendo `dist/` con las fuentes con hash y caché inmutable. Verificado por bytes, no por confianza en el panel de Vercel — que es exactamente cómo se descubrió que dos despliegues no habían llegado.

> El repositorio es **público**. `INFORME.md`, `REPORTE-SEO.md` y `REPORTE-I18N.md` son material interno de trabajo, y `CLAUDE.md` incluye precios sin decidir y respuestas de FAQ marcadas como marcador de posición. Nada de eso es sensible, pero conviene decidir si se queda a la vista. Las claves y los datos de prospectos sí están cubiertos por `.gitignore`.

---

## 12. Lo que falta

### Bloqueante

**La clave de PageSpeed Insights.** Cinco minutos, gratis, sin tarjeta, en la consola de Google Cloud. Sin ella el motor no recoge nada: la cuota anónima está agotada de forma global y devuelve `429` al primer intento. Activa también la *Chrome UX Report API* en el mismo proyecto para el dato de usuarios reales.

Con la clave puesta, el siguiente paso es el de la sección 7 del documento de workflow: correr el motor contra las 20 tiendas peores de tu lista, grabar 5 Looms y mandar 5 emails **hoy**.

### Hallazgos abiertos en la pista de SEO

Cuatro de la revisión, en archivos de la sesión paralela. No los toqué para no pisar trabajo en vuelo:

- Las casillas de grupo cuentan las comprobaciones `no_medible` como aprobadas: una tienda sin `robots.txt` enseña `6/6` en verde, contra la regla del propio archivo de que nunca se aprueba por defecto
- El check de `noindex` culpa a la cabecera `X-Robots-Tag` siempre que exista, aunque diga `noarchive`
- URLs con doble barra (`//robots.txt`) cuando la tienda redirige; hoy Shopify las sirve, pero van escritas en el informe como fuente de cada comprobación
- La ayuda del CLI dice 21 comprobaciones y se emiten 22, que es el número que ve el cliente

### Decisiones de negocio pendientes

- Precio de cada sprint y del retainer (hoy `€ —` con distintivo ámbar)
- Respuestas del FAQ, marcadas `Placeholder.` en el propio texto
- Enlace de Cal.com (los CTA son hoy dos `mailto:`, uno por vía)
- Verificar contra la fuente primaria el coeficiente del 0,8% por cada 100 ms, y las tres tarjetas de estadística
- Casos de estudio: hay un hueco vacío en cada vía; el primero necesita permiso del cliente, captura antes, captura después y la fecha de cada una
- El panel doble del hub enseña `—` y `—/22`: se llenan con una tirada real del propio motor contra este dominio, publicada con su salida cruda

### Medición pendiente

**Volver a pasar Lighthouse en móvil.** La cadena de 1.820 ms que señalaba ya no existe y el peso inicial baja un 26 %, pero **no he vuelto a correrlo**, así que no hay un número nuevo que dar. Si algo sigue por debajo, se mira con los datos delante.

Queda sin tocar, por orden de coste: el CSS crítico sigue en un archivo externo que bloquea el render (~300 ms), e `i18n.js` son 13 KB comprimidos que sólo hacen falta cuando el idioma es español.

### Fases 3 y 4 del documento

Formulario, cola, Resend, panel de aprobación. **Deliberadamente sin construir.** La regla de parada del documento es explícita: no se construye la fase siguiente hasta que la actual haya dado al menos una llamada agendada. El propio documento avisa de que este sistema puede convertirse en la misma trampa que construir la web durante dos meses en vez de vender — «y es una trampa más divertida, porque programar es cómodo y vender no».
