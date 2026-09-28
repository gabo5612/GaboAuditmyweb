# Outbound — correo en frío

**Fecha de corte:** 13 de agosto de 2026
**Estado:** cuenta de Resend creada · dominio `gaboauditmyweb.dev` comprado el 28 sep · DMARC `p=none` publicado · **falta verificar `send.` en Resend**

Este documento es el bloque 4 de `PENDIENTES.md` desarrollado. No es código:
la fase 3 del workflow (cola, envío automático, panel de aprobación) sigue sin
construirse a propósito, y la regla de parada no ha cambiado — **no se
construye hasta que la fase actual haya dado al menos una llamada agendada.**
Enviar los primeros correos a mano no es una carencia, es el plan.

---

## Lo que bloquea el dominio

Resend exige un dominio verificado para enviar. No hay sandbox aprovechable:
sin dominio no sale un solo correo de prospección. Eso pone la compra del
dominio por delante de todo lo demás de esta lista.

| Cuota del plan gratuito | Tu necesidad |
|---|---|
| 3.000 correos/mes | ~215/mes (50/semana) |
| 100 correos/día | 10/día |

Nunca vas a necesitar el plan de pago para esto.

---

## Configuración de Resend, en orden

### 1. Envía desde un subdominio, no desde la raíz

`send.gaboauditmyweb.dev`, no `gaboauditmyweb.dev`. Es la recomendación de Resend y el
motivo es de reputación: si quemas el subdominio con correo en frío, el
dominio raíz —el de tus facturas, el de tu Cal.com, el de los informes— no se
va contigo. Separarlos después es mucho más caro que separarlos ahora.

Dirección de envío sugerida: `gabriel@send.gaboauditmyweb.dev`, con
`reply-to` al buzón que leas de verdad.

### 2. Los registros DNS que da Resend

Los genera él al añadir el dominio y son distintos para cada uno — el selector
DKIM es único, así que no se pueden dejar escritos aquí. Van **todos sobre el
subdominio**, nunca sobre la raíz:

- `MX` — sobre `send.gaboauditmyweb.dev`
- `TXT` de SPF — sobre `send.gaboauditmyweb.dev`
- `TXT` de DKIM — `resend._domainkey.send.gaboauditmyweb.dev`

Suele verificar en 15 minutos, aunque el DNS puede tardar hasta 72 horas.

### 3. DMARC lo pones tú

Es el único que Resend no resuelve, y el que más pesa en si llegas a bandeja
de entrada. Empieza en observación:

```
_dmarc.gaboauditmyweb.dev   TXT   "v=DMARC1; p=none"      ← publicado el 28 sep
```

Le falta `rua=`, a propósito: el dominio no recibe correo, así que un
`dmarc@gaboauditmyweb.dev` sería un buzón que no existe. Cuando haya dónde
recibir los informes (un buzón en el dominio, o el agregador gratuito de
Postmark, que da una dirección propia), se añade `rua=mailto:…` con
`vercel dns` — Vercel es el DNS del dominio.

`p=none` no protege nada: solo te manda informes. Léelos una o dos semanas,
comprueba que todo tu correo legítimo alinea, y sube a `p=quarantine` y
después a `p=reject`. Saltar directo a `reject` con un dominio recién
configurado es la forma más rápida de que tus propios correos desaparezcan.

### 4. Calentamiento

El dominio es nuevo y no tiene reputación. Diez correos al día la primera
semana, y subir desde ahí. Enviar 50 el primer día desde un dominio recién
comprado es la definición de spam para cualquier filtro.

| Semana | Correos/día |
|---|---|
| 1 | 10 |
| 2 | 15 |
| 3 | 20 |
| 4+ | 20, sostenido |

---

## Requisitos legales, no opcionales

El objetivo es US/UK/CA/AU, y cada uno tiene su norma. Tres cosas que van en
**todos** los correos:

- **Enlace de baja** que funcione de verdad, y una lista de bajas que
  respetes. GDPR para UK, CASL para Canadá.
- **Dirección postal física** en el pie. Lo exige CAN-SPAM para el correo
  comercial en EE. UU., y su ausencia es la infracción más fácil de demostrar
  que existe.
- **Identificación honesta**: nombre real, dominio real, sin asuntos que
  simulen una conversación previa (`Re:` en un primer contacto, por ejemplo).

CASL de Canadá es la más estricta de las cuatro: exige consentimiento previo o
una relación comercial existente. Si quieres simplificar, deja Canadá fuera
del primer lote y quédate con US/UK/AU.

*No soy abogado. Esto es la forma general de las normas, no un dictamen sobre
tu caso.*

---

## Las plantillas

En inglés: los compradores son US/UK/CA/AU. Cortas a propósito — un correo en
frío que no cabe en una pantalla de móvil no se lee.

Convenciones: `{tienda}` es el dominio, `{informe}` el enlace al informe
publicado, `{loom}` el vídeo, `{cal}` es `https://cal.com/gabriel-arias-dev/audit`.

### Correo 1 — el primer contacto

> **Asunto:** `{tienda} takes {n}s to show anything on mobile`
>
> I ran PageSpeed against {tienda} this morning. Mobile score {score}, and the
> largest element paints at {n} seconds — your customer is looking at a blank
> screen for most of that.
>
> Three minutes walking through what's causing it: {loom}
>
> Full audit here, free, yours to keep whatever you do next: {informe}
>
> There is one fix in there you can apply today without a developer, in about
> ten minutes. No reply needed for that one — just take it.
>
> If you want the rest of it done, I run 30-day sprints for Shopify stores:
> PageSpeed 85+ or full refund, fixed scope, fixed price. Twenty minutes if
> it is useful: {cal}
>
> — Gabriel Arias
> Shopify performance · {dominio}

**Sobre el número del asunto:** usa una cifra conservadora, no la peor. El LCP
de una tienda lenta varía mucho entre mediciones — NaturVet dio 15,29 s,
20,72 s y 21,45 s en tres corridas el mismo día. Si el asunto dice 21 s y el
prospecto mide 15 s, acabas de perder la credibilidad en la primera línea, que
es justo donde no te la puedes permitir. Cita la mediana y redondea hacia
abajo.

### Correo 2 — seguimiento, día 4

> **Asunto:** `Re: {tienda} takes {n}s to show anything on mobile`
>
> Following up once on the audit I sent Thursday: {informe}
>
> The quick win in it stands on its own — apply it whether or not we ever
> talk.
>
> If speed is not your problem right now, say so and I will stop. If it is,
> the calendar is here: {cal}
>
> — Gabriel

### Correo 3 — cierre, día 10

> **Asunto:** `Closing the loop on {tienda}`
>
> Last one from me. The audit stays up at {informe} — no expiry, no login.
>
> If it becomes a priority in a few months, reply to this email and I will
> pick it up from here.
>
> — Gabriel

Tres correos y paras. Un cuarto no convierte y sí genera denuncias de spam,
que es lo único que puede tumbar el dominio.

---

## Qué medir

El cuadro semanal de `PENDIENTES.md` ya tiene las filas. Dos que Resend te da
gratis en su panel y conviene mirar desde el primer día:

- **Tasa de rebote** por encima del 5 % significa que la lista está sucia:
  verifica los correos antes de enviar, no después.
- **Denuncias de spam** por encima del 0,1 % es la señal de parar y revisar el
  texto. A partir de ahí la recuperación es lenta.

---

## Orden de ejecución

1. ~~Comprar el dominio~~ ✓ `gaboauditmyweb.dev`
2. Añadirlo en Resend ← **aquí**, subdominio `send.`, pegar los tres registros
3. ~~DMARC en `p=none`~~ ✓ — falta `rua` para recibir los informes
4. Correr el lote sobre las 20 tiendas peores
5. Grabar 5 Looms, enviar 5 correos **a mano** el primer día
6. Subir a 10/día siguiendo el calentamiento
7. Fase 3 (envío automático) **solo** cuando esto haya dado una llamada
