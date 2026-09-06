# Pendientes — Gabriel Arias · Shopify Performance & SEO

**Fecha de corte:** 13 de agosto de 2026
**Última actualización:** 13 de agosto de 2026 — primera auditoría contra una tienda real
**Fuentes:** `plan-facturacion-4000-eur.md`, `workflow-auditoria-automatizada.md`, `INFORME.md`, `REPORTE-SEO.md`, `REPORTE-I18N.md`, `CLAUDE.md`

---

## Lectura de una línea

Hay ~5.400 líneas de motor, 129 tests, dos pistas de auditoría, capa i18n completa
y cuatro informes de trabajo. Hay **0 emails de outbound enviados** y **0 llamadas
agendadas**. Los bloques 0, 1 y 4 son los que mueven el objetivo; el bloque 2 no.

**Métrica que predice todo lo demás: 50 emails de outbound por semana. Esta semana: 0.**

El bloque 0 ya casi no bloquea: la clave funciona y está restringida, CrUX responde,
el secret está en Actions, el remoto está resuelto y el motor ya ha medido una tienda
real de principio a fin. Lo que queda en pie es el dominio y dos tiendas más de
prueba. **El cuello de botella ya no es técnico.**

---

## Sesión del 13 de agosto — primera tienda real

`psi.js` y `crux.js` dejaron de ser código no ejercitado: midieron `naturvet.com`
contra las APIs de verdad. Cuatro corridas completas.

**El motor estaba roto de una forma que no se veía.** La primera corrida falló con
`HTTP 429` en PSI móvil. Parecía cuota de Google. No lo era: `audit-engine/.env`
tenía la clave, pero **nadie la cargaba** — ni `dotenv`, ni `--env-file`, ni nada.
`src/psi.js:21` leía un `process.env` vacío, consultaba PSI de forma anónima, y ahí
la cuota es tan baja que devuelve 429 al primer intento.

Es el peor tipo de fallo: el síntoma acusa a un tercero. Con `bin/batch.js` sobre 20
tiendas, habrían fallado las 20 y el diagnóstico natural habría sido "Google me está
limitando", no "mi `.env` no se lee".

Arreglado en `audit-engine/src/env.js` (nuevo, 20 líneas, sin dependencias): carga
`../.env` con `process.loadEnvFile`, protegido por `existsSync` y por comprobación de
la función, porque el README promete Node 18+ y `loadEnvFile` llegó en 20.12. Lo
importan `bin/audit.js` y `bin/batch.js` en su primera línea. Va en los `bin/`, no en
los `src/`, para que los tests sigan siendo herméticos: una clave real en el `.env`
del desarrollador no debe cambiar lo que miden. Las variables que ya vienen del
entorno ganan, así que GitHub Actions no se altera.

Verificado: `node bin/audit.js www.naturvet.com` funciona sin banderas, 129 tests en
verde, y `campo.disponible: true` confirma que la CrUX API está activa en el proyecto.

### NaturVet — primer lead real medido

| Dato | Valor |
|---|---|
| Score móvil | 53 |
| LCP móvil | **15,29 s / 20,72 s / 21,45 s** en tres corridas |
| CLS | 0–0,005 |
| Peso total | ~4.700 KB |
| Apps detectadas | 5 · duplicadas: ninguna |
| Lead score | 30 — prioridad media, geo US (moneda USD) |
| Tema | `Naturvet 3.0` — a medida o premium |

Guardado en `audit-engine/auditorias/naturvet.com.json` (gitignored).

---

## Bloque 0 — Bloqueantes duros

Nada de lo demás corre hasta que esto esté.

- [x] **Clave de PageSpeed Insights** en Google Cloud — verificada contra la API real (HTTP 200)
- [x] **Chrome UX Report API** activada en el mismo proyecto — `campo.disponible: true` en la auditoría de NaturVet
- [x] Restricción de la clave: aplicación `Ninguno`, APIs limitadas a esas dos
- [x] Clave en `.env` local + `.env` en `.gitignore` (líneas 11–13) — **y ahora además se carga**, ver sesión del 13 de agosto
- [x] Secret `PAGESPEED_API_KEY` en GitHub → Settings → Secrets → Actions
- [x] `.github/workflows/audit-batch.yml` inyecta `PAGESPEED_API_KEY` y `CRUX_API_KEY` en el `env:` del step (líneas 59–60)
- [x] **Commitear y empujar.** La nota de "un único commit inicial" era vieja. La sesión del 13 de agosto añade cinco commits, todos en `main` y empujados
- [x] **Remoto resuelto:** `origin` → `github.com/gabo5612/GaboAuditmyweb.git`
- [ ] **Correr el motor contra 3 tiendas reales — 1 de 3.** `naturvet.com` hecha. Faltan dos, y conviene que sean de tema y tamaño distintos
- [ ] **Renombrar el proyecto en Vercel** a `gaboauditmyweb` → `gaboauditmyweb.vercel.app`. El repo (`gabo5612/GaboAuditmyweb`) y la carpeta local ya están renombrados; Vercel sigue el repo por id, así que el despliegue no se rompe, pero la URL sigue diciendo `portfolio-2026-snowy-one` hasta que se cambie a mano en Settings → General → Project Name
- [ ] **Comprar el dominio.** Sin dominio no hay informe con link, ni Resend, ni email que no acabe en spam ← **único bloqueante duro que queda**

---

## Bloque 1 — Decisiones que solo tú puedes tomar

La web no se puede publicar sin esto. No es código, es criterio.

- [x] **Precio del sprint de velocidad — $2.750.** Techo del rango del plan, en dólares: el mercado objetivo es US/UK/CA/AU al 100 %
- [x] **Precio del sprint de SEO — $2.400.** Por debajo de velocidad pese a ser cuatro semanas contra tres: velocidad carga más riesgo (85+ es binario y el stack de apps del cliente puede impedirlo) y viene con una historia de dinero que SEO tiene prohibida
- [x] **Precio del retainer — $1.500/mes**, mínimo 6 meses. Deliberadamente en la mitad baja del rango: el retainer es la columna vertebral y el sí del mes 2 tiene que ser fácil
- [x] **Paquete velocidad + SEO: 50 días en serie, $5.150.** Tres semanas de velocidad más cuatro de SEO son 49 días de trabajo real, así que caben sin recortar nada y las dos garantías siguen en pie. Precio completo cada uno, sin descuento por paquete — comprimirlos es justo lo que la web dice que no hace
- [ ] **Respuestas del FAQ** — siguen marcadas `Placeholder.` salvo `faq.a2`, reescrita con los 50 días

- [x] **Cal.com creado y enlazado** — `cal.com/gabriel-arias-dev/audit`. Enlace, no embed: el script de Cal.com sería un tercero en la web cuyo argumento es la velocidad. No hizo falta API key. Los CTA de auditoría siguen en `mailto:` a propósito — no son una reserva. El sitio principal de la llamada es el final del informe, vía `bin/report.js --cal`
- [ ] **Confirmar que el evento `/audit` dura 20 minutos.** Cinco sitios del copy prometen veinte: `cta.bookLink` en las dos páginas, `report.p7`, y `t.cta` en las dos plantillas de informe. El slug ya no lo delata, pero el cliente ve la duración al reservar
- [ ] **Verificar contra fuente primaria** el coeficiente de 0,8 % por cada 100 ms y las tres tarjetas de estadística. Es la única cifra del sistema sin procedencia real, y vive en la calculadora de la home — en un sitio cuya regla 4 es "sin fuente, no hay número"
- [ ] **Caso de estudio 01** — captura antes, captura después, fecha de cada una
- [ ] **Caso de estudio 02** — necesita permiso del cliente. Mientras no exista: teardown de tienda pública etiquetado como tal (`Public store teardown — unaffiliated demo`)
- [ ] **Columna de logos de clientes** — sustituir por tres MetricTile agregadas hasta que existan

**Descuento de cliente fundador, pendiente de decidir:** −30 % a los dos primeros a
cambio de caso de estudio publicable y testimonio, por escrito en el contrato. Compra
el activo que bloquea los casos 01 y 02 sin tocar la lista, que es mucho más difícil
de subir que de bajar.

---

## Bloque 2 — Código pendiente

Nada de esto hace daño hoy: ningún prospecto ha recibido todavía un informe.
Puede esperar a la semana 2.

### Aplicar el bloque de SEO al sitio

- [ ] Pegar `scratchpad/seo-sitio.md` en `index.html` (la colisión que lo frenó ya no existe: `assets/i18n.js` está escrito)
- [ ] Añadir las claves ES nuevas al diccionario de `assets/i18n.js`
- [ ] Pasar la auditoría de claves de §7.6 del reporte i18n (`missing: []`, `orphan: []`)

### Cuatro hallazgos abiertos de la pista SEO

- [ ] **Las casillas de grupo cuentan `no_medible` como aprobadas** → una tienda sin `robots.txt` enseña `6/6` en verde. El peor de los cuatro: es el mismo patrón de "aviso tranquilizador y falso" que ya se cazó en §7.2 del informe
- [ ] El check de `noindex` culpa a `X-Robots-Tag` siempre que exista, aunque diga `noarchive`
- [ ] URLs con doble barra (`//robots.txt`) escritas en el informe como fuente de cada comprobación
- [ ] La ayuda del CLI dice 21 comprobaciones y se emiten 22

### Tres hallazgos de la primera corrida real (13 de agosto)

Ninguno rompe la venta hoy, pero los tres tocan la credibilidad de los números.

- [ ] **`www` vs apex: lo declarado no es lo medido.** Pasas `www.naturvet.com`, el JSON registra `origin: https://www.naturvet.com`, y PSI audita `https://naturvet.com/`. PSI sigue la redirección y la medición vale, pero un informe que dice una URL y mide otra es exactamente el tipo de detalle que un prospecto técnico usa para descartarte. Normalizar en `collect.js` o imprimir la URL realmente analizada
- [ ] **PSI de escritorio falla de forma intermitente** (`fetch failed`) pese a los 3 reintentos de `util.js`. Cayó en 1 de 4 corridas. No invalida la auditoría — se va a `datos_faltantes` como debe — pero en un lote de 20 significa informes cojos sin que nadie se entere. Mirar si merece más reintentos o un reintento tardío
- [ ] **El LCP móvil varía un 40 % entre corridas** (15,29 / 20,72 / 21,45 s). No es un bug: es la realidad de una tienda muy lenta. Pero el informe cita un valor puntual como si fuera estable. Decidir la política — ¿mediana de N corridas, o rango explícito? Apoyar el titular en el peor valor es indefendible si el cliente lo vuelve a medir y le sale 15 s

### Otros

- [ ] **Revisar `audit-engine/bin/report.js`** — se sobrescribió sin leerlo, con dos sesiones paralelas en vuelo (§10 del reporte SEO)
- [ ] **Segunda métrica del gauge (`—/22`)** — se rellena corriendo `bin/seo.js` contra el propio dominio en el build
- [ ] **Gauge de PageSpeed del hero** — fetch en build a la API + enlace al informe público. Depende del bloque 0
- [ ] **Publicación del informe en URL pública** — `tudominio.com/audit/<token>` con `noindex`. Hoy el motor genera un archivo, no un link: se pierde saber quién lo abrió y hasta dónde bajó, que es lo que te dice a quién llamar

### Lo que NO se construye todavía

Fases 3 y 4 del workflow: formulario, cola, Resend, panel de aprobación.
**Regla de parada: no se construye la fase siguiente hasta que la actual haya
dado al menos una llamada agendada.**

---

## Bloque 3 — Cobros, documentación y expediente

- [x] **Cuenta para cobros internacionales — Banesco Panamá**, ya operativa. Sustituye a Wise/Payoneer como destino de los pagos
- [ ] **Confirmar con el asesor cómo encaja Banesco Panamá con el expediente.** Dos cosas distintas: (a) declarar la cuenta extranjera si residiendo en España supera el umbral del Modelo 720, y (b) que los ingresos que aterrizan en Panamá sean *demostrables* como facturación tuya — el expediente se sostiene sobre facturas cobradas y trazables, y un cobro en una cuenta que no aparece por ningún lado no prueba nada. Puede que convenga cobrar en una cuenta española y usar Banesco solo para los clientes que no puedan pagar de otro modo
- [ ] Stripe para los recurrentes del retainer — cobro con tarjeta, liquidando donde decidas con el asesor
- [ ] Numeración de facturas arrancada, correlativa y sin saltos desde la 001 (Wave o similar)
- [ ] Plantilla de contrato con cláusulas explícitas: **trabajo remoto, cliente fuera de España**
- [ ] Plantilla de propuesta
- [ ] CRM mínimo (Notion / Trello) con el pipeline de outbound
- [ ] Toggl
- [ ] Analytics + Search Console + Meta Pixel el día que se publique la web

### Dos restricciones que condicionan a quién puedes venderle

- La empresa cliente debe llevar **mínimo 1 año de actividad**
- La relación contigo debe tener **mínimo 3 meses** antes de presentar
- Los clientes españoles no pueden superar el **20 %** de la facturación total

> Consecuencia práctica: el cliente que cierres en el mes 5 probablemente no
> sirva para el expediente. Los que cierres en los próximos 60 días sí. Es el
> argumento más fuerte que existe para dejar de programar hoy.

*No soy abogado de extranjería ni asesor fiscal. Los umbrales se actualizan con
el SMI; confirma cifras y estrategia del expediente con un abogado antes de presentar.*

---

## Bloque 4 — Venta

Lo único que mueve el objetivo de €4.500/mes.

- [ ] **Lista de 50 tiendas Shopify candidatas** (BuiltWith, Store Leads, marcas DTC en Instagram)
- [ ] PageSpeed sobre las 50 → quedarte con las 20 peores
- [ ] Correr el lote sobre esas 20 (`bin/batch.js` + Actions ya construidos)
- [ ] **Grabar 5 Looms y enviar 5 emails — a mano, sin esperar a la fase 3**
- [ ] Subir a 10 emails/día → 50/semana
- [ ] SPF, DKIM y DMARC configurados **antes** del primer envío
- [ ] Calentamiento de dominio: 10 emails/día la primera semana
- [ ] Enlace de baja **y dirección postal física** en todos los emails; la segunda la exige CAN-SPAM en EE. UU.

**Resend:** cuenta creada, y **bloqueada hasta que haya dominio** — exige uno
verificado para enviar, sin sandbox aprovechable. El plan gratuito da 3.000
correos/mes y 100/día contra los ~215/mes que necesitas, así que no hará falta
pagarlo. Configuración, registros DNS, calentamiento y las tres plantillas de
correo, en `OUTBOUND.md`.
- [ ] Cuenta de Loom — el plan free da 25 vídeos; se toca techo rápido a 20/día
- [ ] Perfil en Shopify Partners
- [ ] Perfil ultra-especializado en Upwork (solo trabajos de €2.000+)
- [ ] Aplicar a Toptal / Gun.io
- [ ] 5 agencias/semana en LinkedIn para partnership white-label
- [ ] Blog: primer artículo en inglés (mes 2)

---

## Bloque 5 — Limitaciones aceptadas (no son deuda, no tocar)

Listadas para que dejen de ocupar espacio mental:

- El español no se indexa por separado; una sola URL, sin `hreflang`
- Parpadeo de idioma en el visitante hispanohablante (inherente a traducir en cliente)
- Con JS desactivado el sitio es inglés y el selector es inerte
- `?lang=` sólo acepta `en` y `es`
- Los placeholders con badge ámbar son intencionados y no se rellenan con valores inventados
- El motor no envía nada, no renderiza páginas y no adivina competidores
- Dark only, sin ramas `prefers-color-scheme`
- La etapa ③ (análisis) es manual a propósito: cero API keys, revisión humana obligatoria

---

## Plan de la semana

| Día | Qué |
|---|---|
| **Lunes** | ~~Clave de PSI~~ ✓ · ~~resolver remoto~~ ✓ · commit · **comprar dominio** |
| **Martes** | Lista de 50 · PageSpeed sobre las 50 · lote sobre las 20 peores |
| **Miércoles** | Decidir los tres precios y escribir las FAQ. Dos horas, no dos días |
| **Jueves** | 10 Looms · 10 emails |
| **Viernes** | 10 Looms · 10 emails · revisar métricas del lunes siguiente |

El bloque 2 entero puede esperar a la semana que viene. El `6/6` en verde falso
sólo hace daño cuando alguien recibe ese informe, y a día de hoy no lo ha
recibido nadie. **Ese es el problema.**

**Antes del lote del martes**, correr el motor contra dos tiendas más. La de NaturVet
destapó un fallo que 129 tests en verde no vieron; es barato que la tercera destape
otro antes que las 20.

---

## Siguiente paso inmediato

NaturVet está en la **etapa ③**, el único punto manual del pipeline:

```
bin/audit.js  →  naturvet.com.json  →  ③ análisis  →  naturvet.com.analysis.json  →  bin/report.js  →  informe HTML
   ✓ hecho                              ← aquí                                        ↑ revisión humana obligatoria
```

Se pega el JSON crudo + `analysis/prompt.md` + `analysis/schema.json` en Claude, sale
el análisis, lo valida `validate.js` y `bin/report.js` lo renderiza.

Dos decisiones que el prompt no puede tomar por ti:

- **La facturación de NaturVet es desconocida**, así que la pérdida saldrá como *45 %
  de la facturación*, sin importe. Si consigues una estimación, pásala con
  `--facturacion` y el número se vuelve mucho más vendible. Inventarla está prohibido
  por la regla 1 del prompt
- **Relanzar la auditoría antes del análisis**, para no arrastrar el hueco del PSI de
  escritorio de la última corrida

---

## Cuadro semanal (revisar cada lunes)

| Métrica | Objetivo | Actual |
|---|---|---|
| Emails de outbound enviados | 50/semana | 0 |
| Respuestas recibidas | 5–8/semana | 0 |
| Llamadas agendadas | 2/semana | 0 |
| Propuestas enviadas | 1–2/semana | 0 |
| Tasa de cierre | > 25 % | — |
| MRR | subiendo cada mes | €0 |
| Facturado **y cobrado** | vs. objetivo del mes | €0 |

Si el outbound baja de 50/semana, el mes se cae.
