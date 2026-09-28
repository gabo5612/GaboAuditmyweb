# Motor de auditoría

Implementa las fases 0 a 2 de `workflow-auditoria-automatizada.md`: recogida
de datos, informe y lote. El análisis (etapa ③) lo haces con Claude a partir
de `analysis/prompt.md`, y el envío (etapa ⑥) todavía es manual.

Cero dependencias. Node 18 o superior.

---

## Puesta en marcha, cinco minutos

1. Consigue una clave de PageSpeed Insights en la
   [consola de Google Cloud](https://console.cloud.google.com/apis/library/pagespeedonline.googleapis.com)
   — gratis, sin tarjeta. **Sin ella el motor no sirve para nada**: la cuota
   sin clave está prácticamente a cero y PSI responde 429 al primer intento.
2. Activa también la *Chrome UX Report API* en el mismo proyecto si quieres
   el dato de usuarios reales.
3. Exporta la clave:

```bash
export PAGESPEED_API_KEY="tu-clave"
```

---

## Fase 0 — una tienda

```bash
node bin/audit.js tienda.com --competidores rival-a.com,rival-b.com
```

Sale el JSON crudo por stdout y un resumen por stderr. Con `--out auditorias/`
lo guarda en un archivo.

Mide el móvil **tres veces** y publica la corrida mediana por LCP, con el
rango: una corrida suelta no es un dato (el LCP de NaturVet varió un 40 % el
mismo día). Las respuestas cacheadas de PSI —mismo `fetchTime`— no cuentan.
`--corridas 1` para una criba rápida de muchas tiendas.

Los competidores **los pones tú**. Adivinarlos automáticamente daría
comparaciones falsas, y una comparación falsa hunde el informe en la primera
frase. Dos por tienda bastan.

Si no conoces la facturación del cliente, no la pases: la pérdida se expresa
en porcentaje y el importe queda vacío. Nunca se estima.

## Etapa ③ — el análisis

Abre `analysis/prompt.md`, pégalo en Claude junto con el JSON y con
`analysis/schema.json`. Guarda la respuesta como `analisis/<host>.json`.

## Fase 1 — el informe

```bash
node bin/report.js auditorias/tienda.com.json analisis/tienda.com.json \
  --loom https://www.loom.com/share/<id> \
  --cal https://cal.com/gabriel-arias-dev/audit \
  --out informes/
```

Sale un HTML autocontenido de unos 20 KB, sin una sola petición externa, con
`noindex` y un nombre de archivo que es un token de 32 caracteres. Súbelo a
`/audit/<token>` y manda ese enlace.

El informe se valida antes de generarse. Si el análisis se salta una regla
dura —un hallazgo sin evidencia, un importe con la facturación desconocida,
seis hallazgos en vez de cinco— **no se genera**. Es intencionado: el paso ⑤
no puede corregir lo que nunca llega a existir.

Además avisa (sin bloquear) de cifras que aparecen en la prosa pero no en los
datos recogidos. Ese aviso pilla el fallo caro: el «3,2 s» que suena creíble
y no lo midió nadie.

## Fase 2 — el lote

```bash
cp queue.example.csv queue.csv   # edítalo
node bin/batch.js queue.csv --out auditorias/
```

Genera un JSON por tienda y un `resumen.csv` ordenado por lead score: ése es
el orden en que grabas los Looms.

En GitHub Actions corre solo a las 03:00 UTC de lunes a viernes
(`.github/workflows/audit-batch.yml`). Guarda `PAGESPEED_API_KEY` en
Settings → Secrets → Actions. El resumen aparece en la pantalla del propio
job, así que puedes mirarlo desde el móvil sin descargar nada.

---

## Tests

```bash
npm test        # node --test, sin instalar nada
```

La red se intercepta en `fetch`, así que `psi.js` y `crux.js` ejecutan su
camino real —construcción de la URL, clave de API, reintentos, parseo—
contra respuestas grabadas en `test/fixtures/` con la forma exacta que
devuelven las APIs. Por eso la suite corre sin clave y sin gastar cuota.

Lo que cubre, además del parseo: que la fórmula del dinero siga siendo
idéntica a la de `assets/main.js`, que el informe no emita ni una petición
externa, que escape el contenido hostil, que una tienda que no es Shopify se
descarte antes de gastar cuota de PSI, y que un fallo de PSI marque la
auditoría como fallida en vez de emitir un informe con huecos.

El bloque más grande es el del guardián de cifras de `validate.js`: los casos
que fijan qué número se acepta y cuál se avisa. Ese guardián falló tres veces
de formas distintas mientras se escribía, y las tres eran silenciosas —
aceptaba cualquier cosa. Un aviso que nunca salta es peor que no tenerlo,
porque da una falsa sensación de red de seguridad.

## Lo que NO hace

- **No envía nada.** No hay Resend, ni cola, ni formulario. Eso es la fase 3
  y el documento dice que no la construyas hasta que ésta te haya dado al
  menos una llamada agendada.
- **No renderiza páginas.** El HTML se analiza con expresiones regulares, sin
  navegador. Por eso lo que depende de renderizar —si una imagen se sirve más
  grande de lo que se muestra— se toma de las oportunidades de Lighthouse en
  vez de estimarse.
- **No ve las apps que inyecta un Tag Manager.** `apps.total: 0` significa
  «ninguna en el HTML inicial», nunca «esta tienda no tiene apps». El campo
  `apps.alcance` lo dice en cada JSON para que no se te olvide al redactar.
- **No adivina competidores, facturación ni país con certeza.** El país se
  deduce de la moneda activa o del dominio, y viaja con su evidencia y su
  nivel de confianza.

## Archivos

| Ruta | Qué es |
|---|---|
| `bin/audit.js` | Fase 0 — una tienda |
| `bin/batch.js` | Fase 2 — un CSV entero |
| `bin/report.js` | Fase 1 — informe HTML |
| `src/collect.js` | Orquestador de la etapa ② |
| `src/money.js` | **La fórmula.** Espejo de `assets/main.js` |
| `src/signatures.js` | Tabla de firmas de apps |
| `src/validate.js` | Las reglas duras, hechas código |
| `analysis/prompt.md` | Etapa ③ |
| `report/template.js` | Etapa ④ |
| `fixtures/` | Datos sintéticos para probar la plantilla sin gastar cuota |

## Antes de enviar nada

La checklist del paso ⑤ del documento, que ninguna de estas herramientas
sustituye:

- [ ] ¿Los números cuadran? Abre PageSpeed y comprueba dos a ojo
- [ ] ¿Las apps detectadas son reales o hay falsos positivos?
- [ ] ¿El diagnóstico suena a persona o a robot?
- [ ] ¿Hay algún hallazgo obviamente incorrecto para *esta* tienda?
- [ ] Grabar el Loom de 3 minutos recorriendo el propio informe
- [ ] Pegar el enlace del Loom y regenerar

El Loom nunca se automatiza. Es la única parte del sistema que un competidor
no puede copiar en un fin de semana.
