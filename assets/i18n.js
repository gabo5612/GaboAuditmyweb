/* Gabriel Arias · Shopify performance
   Bilingual layer — English lives in index.html, Spanish lives here.

   English is the source of truth: index.html ships fully written in it, so
   with this file blocked the page is still complete and correct. Spanish is
   applied on top, keyed by data-i18n attributes, never by class names.

   Language is picked in this order:
     0. the page itself, if build.js wrote it in Spanish (/es/)
     1. ?lang=es|en in the URL
     2. the visitor's previous choice, from localStorage
     3. navigator.languages
     4. English

   Adding a string: give the element a data-i18n="section.key" in the markup
   (data-i18n-aria / -content / -href for attributes) and add the same key to
   ES below. A missing key falls back to whatever the markup says, which is
   English — so a half-translated page degrades to English, never to blanks. */

(function () {
  'use strict';

  var SUPPORTED = ['en', 'es'];
  var SOURCE = 'en';                 // the language written into the markup
  var STORE_KEY = 'ga-lang';
  var LOCALES = { en: 'en-US', es: 'es-ES' };

  /* ── Spanish ───────────────────────────────────────────
     Same voice as the English: direct, unhyped, every number sourced.
     Tuteo, matching audit-engine's own copy. */

  var ES = {
    /* ── Común a las tres páginas ─────────────────────── */
    'meta.title': 'Gabriel Arias · Rendimiento y SEO para Shopify',
    'meta.description': 'Dos cosas le cuestan dinero a tu tienda Shopify: lo que tarda en cargar y lo mal que Google la lee. Las dos se miden desde fuera. Auditoría gratis en 48 h.',
    'meta.ogTitle': 'Gabriel Arias · Rendimiento y SEO para Shopify',
    'meta.ogDescription': 'Dos sprints de 30 días, se venden por separado, cada uno con su garantía por escrito. Auditoría gratis en 48 horas, sin llamada.',

    'brand.role': 'Rendimiento y SEO Shopify',
    'nav.skip': 'Saltar al contenido',
    'nav.primary': 'Principal',
    'nav.speed': 'Velocidad',
    'nav.seo': 'SEO',
    'nav.audit': 'La auditoría',
    'nav.plan': 'Plan',
    'nav.about': 'Sobre mí',
    'nav.faq': 'FAQ',
    'nav.cta': 'Auditoría gratis',

    'hero.eyebrow': 'Shopify · dos sprints, se venden por separado',
    'hero.title': 'Dos cosas le cuestan dinero a tu tienda sin que se note: lo que tarda en cargar y lo mal que Google la lee.',
    'hero.lede': 'Las dos se miden desde fuera, en una tarde. Elige la que sea tu problema y te mando la medición en menos de 48 horas — gratis, sin llamada y te la quedas.',
    'hero.cta': 'Ver las dos, una al lado de la otra ↓',
    'hero.link': 'Qué incluye la auditoría gratis',
    'hero.note': 'Una sola persona, sólo Shopify. Cada sprint son 30 días con garantía por escrito.',
    'hero.noteCall': 'Sin llamada. Recibes un Loom y un informe escrito.',

    'dual.label': 'Esta web, medida con sus propias herramientas',
    'dual.speed': 'PageSpeed móvil',
    'dual.seo': 'Comprobaciones SEO superadas',
    'dual.badge': '● Medido el 28 sep 2026',
    'dual.note': 'PageSpeed: mediana de tres corridas móviles (98 · 98 · 100), Lighthouse 13.5.0. SEO: 0 fallos; las otras 7 miran fichas de producto y colecciones, que esta web no tiene.',
    'self.raw': 'Salida en bruto',
    'self.rawJson': 'JSON en bruto',
    'self.rerun': 'Vuelve a medirlo tú',

    'week.1': 'Semana 1',
    'week.2': 'Semana 2',
    'week.3': 'Semana 3',
    'week.4': 'Semana 4',

    'gauge.label': 'Esta web · PageSpeed móvil',
    'gauge.alt': 'PageSpeed móvil: 98 de 100',
    'gauge.badge': '● Medido el 28 sep 2026',
    'gauge.note': 'Mediana de tres corridas móviles de PageSpeed Insights: 98 · 98 · 100. Escritorio 100 en las tres. Lighthouse 13.5.0.',

    'facts.aria': 'De un vistazo',
    'facts.turnaround': 'Plazo',
    'facts.turnaroundValue': '48 h',
    'facts.turnaroundNote': 'De la petición al informe, en las dos vías',
    'facts.turnaroundNote2': 'De la petición al informe',
    'facts.sprint': 'Duración del sprint',
    'facts.sprintValue': '30 días',
    'facts.sprintNote': 'Alcance cerrado, precio cerrado, de uno en uno',
    'facts.guarantee': 'Garantía',
    'facts.guaranteeValue': '85+ o devolución',
    'facts.guaranteeNote': 'PageSpeed móvil, verificado juntos',
    'facts.guarantees': 'Garantías',
    'facts.guaranteesValue': 'Dos, las dos por escrito',
    'facts.guaranteesNote': '85+ en velocidad · toda comprobación fallida en verde en SEO',
    'facts.logos': 'Logos de clientes',
    'facts.logosNote': 'Sustituyen a esta columna tras el primer sprint',

    /* ── Las dos vías (home) ──────────────────────────── */
    'tracks.eyebrow': 'Las dos vías',
    'tracks.title': 'Las dos demostradas aquí, antes de que me des nada',
    'tracks.lede': 'Ninguna de las dos es una promesa que tengas que creerte. Arrastra el control; lee la lista de comprobaciones. Y decide cuál de las dos te está costando más.',
    'tracks.days': '30 días',
    'tracks.speedKind': 'Vía 01 · velocidad',
    'tracks.speedTitle': 'Tu cliente está mirando una pantalla en blanco',
    'tracks.speedText': 'A los tres segundos de carga, una de estas dos tiendas no ha enseñado nada. Misma tienda, misma conexión, antes y después del sprint.',
    'tracks.wireframe': 'Fotogramas de ejemplo — faltan capturas reales',
    'tracks.speedWarranty': 'PageSpeed 85+ o devolución íntegra',
    'tracks.speedCta': 'El sprint de velocidad →',
    'tracks.speedAside': 'O calcula lo que te cuesta un segundo',
    'tracks.seoKind': 'Vía 02 · SEO técnico',
    'tracks.seoTitle': 'Google lee una tienda distinta de la que ven tus clientes',
    'tracks.seoText': 'Veintidós comprobaciones técnicas deciden si puede rastrear, indexar y entender tu catálogo. La lista entera es pública y puedes repetirlas todas tú mismo.',
    'tracks.yourStore': 'Tu tienda · comprobaciones superadas',
    'tracks.awaitBadge': '▲ A la espera de tu análisis',
    'tracks.awaitText': 'La rellena la auditoría gratuita. Una comprobación que no se puede hacer se informa, nunca se descarta — el total siempre son 22.',
    'tracks.seoWarranty': 'Toda comprobación fallida en verde, o devolución íntegra',
    'tracks.seoCta': 'El sprint de SEO →',
    'tracks.seoAside': 'O lee las veintidós comprobaciones',
    'tracks.note': 'Se venden por separado, de uno en uno. Dos sprints en el mismo mes obligarían a recortar uno, y entonces ninguna de las dos garantías se sostiene.',

    'groups.crawl': 'Rastreo e indexación',
    'groups.dupes': 'Contenido duplicado',
    'groups.meta': 'Metadatos de página',
    'groups.rich': 'Resultados enriquecidos y buscadores con IA',

    'film.eyebrow': 'Misma tienda · misma conexión · antes y después',
    'film.badge': '▲ Fotogramas de ejemplo — sustituir por capturas reales',
    'film.title': 'A los tres segundos, una de las dos sigue en blanco',
    'film.lede': 'Arrastra el control, o enfócalo y usa ← →. Esto es lo que ve tu cliente mientras la página todavía está pensando.',
    'film.before': '■ Antes',
    'film.after': '● Después',
    'film.beforeLcp': '■ Antes · 4,8s LCP',
    'film.afterLcp': '● Después · 1,9s LCP',
    'film.play': '▶ Reproducir',
    'film.scrub': 'Control de tiempo de carga, en segundos',

    'numbers.eyebrow': 'El problema, en números',
    'numbers.title': 'Una página lenta es una partida de ingresos, no un ticket de informática',

    'stats.conversion': 'Conversión por cada 100 ms',
    'stats.conversionSourceA': 'Deloitte, ',
    'stats.conversionSourceB': ' — verificar la cifra contra el PDF original antes de publicar.',
    'stats.bounce': 'Rebote según tiempo de carga',
    'stats.bounceSource': 'Estudio móvil de Google/Akamai — verificar año y metodología antes de publicar.',
    'stats.cwv': 'Tiendas Shopify que suspenden CWV',
    'stats.cwvSource': 'Dataset de CrUX — saca tú mismo la cifra actual; no cites a un blog que cita a otro blog.',

    'calc.label': 'Lo que te está costando',
    'calc.revenue': 'Facturación mensual (USD)',
    'calc.lcp': 'LCP móvil actual (segundos)',
    'calc.lcpHint': 'Pasa PageSpeed Insights a tu tienda, pestaña móvil. El objetivo son 2,5s.',
    'calc.leakLabel': 'Fuga mensual estimada',
    'calc.verify': '▲ Verificar contra la fuente primaria antes de publicar.',
    /* Plantillas que rellena assets/main.js. Mismos marcadores en los dos idiomas. */
    'calc.formula': '{revenue} × ({lcp}s − {target}s) × {loss}%/s = {leak}/mes',
    // Con el tope activo la ecuación tiene que incluirlo para que evalúe a la
    // cifra que se muestra encima.
    'calc.formulaCapped': '{revenue} × mín({max}%, ({lcp}s − {target}s) × {loss}%/s) = {leak}/mes',
    'calc.cta': 'Encuentra {leak} en 48 horas →',

    'report.eyebrow': 'La auditoría gratuita · cualquiera de las dos vías',
    'report.title': 'Lo que te llega al correo en 48 horas',
    'report.lede': 'No un PDF adjunto. Un enlace a una página de este dominio que carga en menos de medio segundo — un consultor que te manda un archivo de 8 MB ya ha respondido a tu pregunta. Eliges una vía; la forma del informe es la misma en las dos.',
    'report.t1': 'El número que duele',
    'report.p1': 'En velocidad, lo que te cuesta el retraso cada mes, con la fórmula y el coeficiente impresos debajo. En SEO, cuántas de las veintidós comprobaciones suspendes — un recuento, no una moneda, porque los ingresos que se pierden por indexación no se pueden medir desde fuera sin inventárselos.',
    'report.t2': 'Tú contra dos competidores',
    'report.p2': 'Mismo test, mismo día, misma conexión. Tu tienda al lado de otras dos de tu nicho — porque un segundo en abstracto no significa nada, y un segundo por detrás de un rival lo significa todo. Los dos los eliges tú; adivinarlos daría una comparación falsa.',
    'report.t3': 'Cinco hallazgos, el peor primero',
    'report.p3': 'Cinco. No veinte. Un informe de veinte puntos no se lee, se aplaza. Cada uno dice qué está pasando, qué cuesta y qué haría yo — con la métrica, la fuente y la fecha al lado. En la vía de SEO, cada hallazgo cita la comprobación de la que sale.',
    'report.k4': 'Tuyo en cualquier caso',
    'report.t4': 'Un arreglo que puedes aplicar hoy, sin mí',
    'report.p4': 'Escrito clic a clic: qué pantalla de tu admin de Shopify, qué botón y cómo comprobar que ha funcionado. Si lo aplicas, ves moverse el número y no vuelves a hablar conmigo, la auditoría ha hecho su trabajo.',
    'report.t5': 'El plan, semana a semana',
    'report.p5': 'Tres semanas en la vía de velocidad, cuatro en la de SEO — la cuarta es el re-rastreo, porque un cambio de schema que nadie ha vuelto a rastrear está desplegado, no terminado. En cualquier caso, éste es el alcance completo del sprint, por escrito. Dáselo a tu desarrollador si lo prefieres; es tuyo.',
    'report.t6': 'Qué pasa si no cambia nada',
    'report.p6': 'Hacia dónde han ido derivando los números y qué te costará la próxima app que instales. Sin dramatismo. Las tiendas lentas casi nunca se rompen un día concreto, que es justo por lo que siguen lentas durante años.',
    'report.t7': 'Una sola forma de responder',
    'report.p7': 'Veinte minutos en un calendario, si los quieres. Sin segundo CTA, sin newsletter, sin secuencia de correos disfrazada de recurso.',

    'prov.l1': 'Medido con',
    'prov.p1': 'PageSpeed Insights para los datos de laboratorio y la CrUX History API para lo que han visto tus usuarios reales. En la vía de SEO, las respuestas de tu propia tienda — sin claves de API, sin nada que tengas que darme.',
    'prov.l2': 'Cada cifra lleva',
    'prov.p2': 'Su métrica, su valor, su fuente y la fecha en que se tomó. Un número sin esas cuatro cosas no aparece — la sección se queda vacía en su lugar.',
    'prov.l3': 'Antes de llegarte',
    'prov.p3': 'Lo leo, contrasto los números con las herramientas en vivo y grabo el walkthrough. No se envía nada que yo no haya mirado antes.',

    'plans.auditPrice': 'Gratis',
    'plans.auditTerm': '48 horas',
    'plans.audit1': 'Cinco hallazgos, ordenados por lo que te cuestan',
    'plans.audit2': 'Tu velocidad frente a la de dos competidores',
    'plans.audit3': 'Un plan de tres semanas para cualquier desarrollador',
    'plans.audit4': 'Un arreglo que puedes aplicar tú mismo, hoy',
    'plans.audit5': 'Un walkthrough de tres minutos en vídeo',
    'plans.auditCta': 'Ver qué incluye',
    'plans.flag': 'Empieza aquí',
    'plans.sprintKind': 'Sprint de optimización',
    'plans.sprintTerm': '30 días',
    'plans.sprint1': 'Tema, imágenes y scripts reconstruidos',
    'plans.sprint2': 'Core Web Vitals en verde en móvil',
    'plans.sprint3': 'Informe antes/después con números citados',
    'plans.sprint4': 'Dos semanas de seguimiento tras el lanzamiento',
    'plans.warranty': 'PageSpeed 85+ o devolución íntegra',
    'plans.sprintCta': 'Empieza por la auditoría gratis',
    'plans.retainerKind': 'Mantenimiento',
    'plans.perMonth': ' /mes',
    'plans.retainerTerm': 'Mensual, después de un sprint',
    'plans.retainer1': 'Monitorización semanal de vitals con usuarios reales',
    'plans.retainer2': 'Guardia de regresiones en cada cambio de tema',
    'plans.retainer3': 'Un experimento de CRO al mes',
    'plans.retainerCta': 'Pide la auditoría',

    /* ── Casos, proceso, sobre mí ─────────────────────── */
    'cases.eyebrow': 'Casos',
    'cases.title': 'Contexto, intervención, resultado medido',
    'cases.lede': 'Dos huecos, uno por vía, los dos a la espera de mediciones reales. Los análisis de tiendas públicas se etiquetan como tales — una demo sin relación comercial vale más que un cliente inventado.',
    'cases.speedSlot': 'Velocidad · hueco 01 · vacío',
    'cases.speedText': 'Reservado para el primer sprint de velocidad pagado. Publicarlo exige cuatro cosas: el permiso del cliente, la captura de antes, la captura de después y la fecha de cada una.',
    'cases.seoSlot': 'SEO · hueco 01 · vacío',
    'cases.seoText': 'Reservado para el primer sprint de SEO pagado. Los dos análisis, el primero y el re-rastreo, publicados uno al lado del otro con su fecha.',
    'cases.link': 'Qué incluye el sprint →',
    'cases.badge': 'Análisis de tienda pública — demo sin relación comercial',
    'cases.slot1': 'Hueco 01 · texto de ejemplo',
    'cases.context': 'Contexto',
    'cases.contextText': 'Tienda de ropa sobre un tema muy personalizado, seis scripts de analítica en la ruta crítica, hero servido a 2400px.',
    'cases.intervention': 'Intervención',
    'cases.interventionText': 'Terceros aplazados hasta la interacción, pipeline responsive en AVIF, dos apps que duplicaban el mismo tracking eliminadas.',
    'cases.result': 'Resultado',
    'cases.resultText': 'Pendiente de medición.',
    'cases.awaitFlag': '▲ A la espera de datos',
    'cases.slot2': 'Hueco 02 · vacío',
    'cases.slot2Text': 'Reservado para el primer sprint pagado. Publicarlo exige cuatro cosas: el permiso del cliente, la captura de antes, la captura de después y la fecha de cada una.',

    'process.eyebrow': 'Proceso',
    'process.title': 'Cómo funciona, en cualquiera de las dos vías',
    'process.t1': 'Auditoría gratis',
    'process.w1': '48 horas',
    'process.p1': 'Me mandas la URL de la tienda y me dices qué vía. Recibes un Loom y un informe escrito y priorizado. Sin llamada.',
    'process.t2': 'Línea base',
    'process.w2': 'Día 1',
    'process.p2': 'Registramos juntos los números de partida, para que el resultado final no sea mi palabra contra la tuya. Es también contra lo que se mide la garantía.',
    'process.t3': 'Sprint',
    'process.w3': '30 días',
    'process.p3': 'El trabajo se hace sobre un tema duplicado. Nada sale a producción hasta que apruebas el diff. Una vía cada vez.',
    'process.t4': 'Prueba',
    'process.w4': 'Última semana',
    'process.p4': 'La misma medición, otra vez. En velocidad, el PageSpeed y los vitals de cierre; en SEO, el re-rastreo con toda comprobación fallida en verde.',

    'about.eyebrow': 'Sobre mí',
    'about.p1': 'Construyendo y publicando webs desde 2014, los últimos años dentro del ecommerce, donde la diferencia entre una página rápida y una lenta aparece en los números del checkout y no en un informe.',
    'about.p2': 'Trabajo en las dos partes de una tienda que no son cuestión de opinión: lo rápida que es y si un rastreador puede leerla. Las dos se miden antes de empezar y se miden al terminar, y los dos podemos ver el número.',
    'about.p3': 'Sólo Shopify. Un sprint cada vez. Ésa es toda la oferta.',

    'faq.eyebrow': 'FAQ',
    'faq.title': 'Antes de que preguntes',
    'faq.q1': '¿Cuál necesito?',
    'faq.a1': 'Placeholder. Si tienes tráfico que no convierte, empieza por velocidad. Si tienes un catálogo que Google apenas enseña, empieza por SEO. Las dos auditorías son gratis — coge la que menos claro tengas.',
    'faq.q2': '¿Puedo contratar las dos a la vez?',
    'faq.a2': 'En el mismo mes no. Una sola persona con dos sprints en marcha tiene que recortar uno, y entonces ninguna garantía vale nada. Una detrás de otra caben en 50 días — tres semanas de velocidad y luego cuatro de SEO — por $5,150, y las dos garantías siguen en pie.',
    'faq.q3': '¿Y si ya tengo un desarrollador?',
    'faq.a3': 'Placeholder. O le paso un diff priorizado y lo implementa él, o lo implemento yo y él lo revisa. Las dos funcionan, y la segunda es más rápida.',
    'faq.q4': '¿Necesitas acceso a mi tema en producción?',
    'faq.a4': 'Placeholder. Acceso de colaborador a un tema duplicado. El de producción no se toca hasta que apruebas el diff. La auditoría gratuita no necesita nada — sólo la URL.',
    'faq.q5': '¿Trabajas con tiendas que no son Shopify?',
    'faq.a5': 'Placeholder. No. Los dos métodos son específicos de Shopify, que es justo por lo que cada uno lleva 30 días y no un trimestre.',

    'cta.title': 'Elige la que más te esté costando',
    'cta.lede': 'Cualquiera de las dos auditorías es gratis, tarda 48 horas, no necesita más que la URL de tu tienda y llega sin una llamada pegada.',
    'cta.speedButton': 'Auditoría de velocidad gratis',
    'cta.speedWarranty': '85+ o devolución',
    'cta.seoButton': 'Auditoría de SEO gratis',
    'cta.seoWarranty': 'Toda comprobación fallida en verde',
    'cta.button': 'Consigue tu auditoría gratis',
    'cta.speedMailto': 'mailto:gabrielariasdev@gmail.com?subject=Auditor%C3%ADa%20gratuita%20de%20velocidad%20Shopify&body=URL%20de%20la%20tienda%3A%20',
    'cta.seoMailto': 'mailto:gabrielariasdev@gmail.com?subject=Auditor%C3%ADa%20gratuita%20de%20SEO%20Shopify&body=URL%20de%20la%20tienda%3A%20',
    'cta.bookNote': '¿Prefieres hablarlo antes?',
    'cta.bookLink': 'Reservar 20 minutos →',

    'foot.speed': 'Sprint de velocidad',
    'foot.seo': 'Sprint de SEO',
    'foot.audit': 'La auditoría gratis',
    'foot.home': 'Inicio',
    'foot.reports': 'Los informes de esta web ↗',
    'foot.legal': 'Aviso legal · Privacidad',

    /* ── Página de velocidad ──────────────────────────── */
    'sp.metaTitle': 'Sprint de velocidad · Gabriel Arias',
    'sp.metaDescription': 'En 30 días llevo el PageSpeed de tu Shopify por encima de 85 y tu conversión móvil un 10–25% arriba. Alcance y precio cerrados. Auditoría gratis en 48 h.',
    'sp.ogTitle': 'Sprint de velocidad · Gabriel Arias',
    'sp.ogDescription': 'PageSpeed 85+ en 30 días, o devolución íntegra. Auditoría gratuita en 48 horas, sin llamada.',
    'sp.brandRole': 'Rendimiento Shopify',
    'sp.navCta': 'Auditoría de velocidad',
    'sp.eyebrow': 'Rendimiento Shopify · sprint de 30 días',
    'sp.title': 'Tu tienda pierde ingresos por cada segundo que tarda en cargar.',
    'sp.lede': 'En 30 días subo tu PageSpeed por encima de 85 y tu conversión móvil entre un 10 y un 25%. Alcance cerrado, precio cerrado, medido antes y después — en tus dispositivos, juntos.',
    'sp.cta': 'Auditoría gratis en 48 h',
    'sp.link': 'Ver lo que cuesta un segundo ↓',
    'sp.sprintNote': 'Tres semanas de trabajo, una de seguimiento',
    'sp.measuredWith': 'Medido con',
    'sp.measuredNote': 'Datos de laboratorio, y lo que vieron tus usuarios reales',
    'sp.lcpTarget': 'LCP · objetivo ≤ 2,5 s',
    'sp.inpTarget': 'INP · objetivo ≤ 200 ms',
    'sp.clsTarget': 'CLS · objetivo ≤ 0,1',
    'sp.realUsers': 'Usuarios reales · 6 meses',
    'sp.awaiting': 'A la espera',
    'sp.cruxTrend': 'Tendencia CrUX',
    'sp.numbersLede': 'Pon tus propios números. La fórmula va impresa con el tope dentro y el coeficiente está citado, para que tu desarrollador compruebe la aritmética en treinta segundos.',
    'sp.coefficient': 'Coeficiente: 0,8% de conversión por cada 100 ms de más, con un tope del 45% — por encima de ahí ninguna estimación es creíble.',
    'sp.planEyebrow': 'El sprint · 30 días',
    'sp.planTitle': 'Tres semanas de trabajo, medidas por los dos extremos',
    'sp.planLede': 'El alcance es el plan de tu auditoría gratuita, sin cambios. El trabajo se hace sobre un tema duplicado y nada sale a producción hasta que apruebas el diff.',
    'sp.w0': 'Línea base',
    'sp.w0Text': 'Registramos juntos los números de partida, en tus dispositivos, para que el resultado final no sea mi palabra contra la tuya.',
    'sp.w1': 'Ruta crítica',
    'sp.w1Text': 'Scripts de terceros aplazados hasta la interacción, apps duplicadas fuera, recursos que bloquean el render despejados.',
    'sp.w2': 'Imágenes y fuentes',
    'sp.w2Text': 'Pipeline responsive en AVIF, dimensiones correctas por breakpoint, carga de fuentes que deja de mover el layout.',
    'sp.w3': 'Tema y prueba',
    'sp.w3Text': 'Liquid y CSS en las plantillas que importan, y después la medición de cierre y el informe antes/después.',
    'sp.auditKind': 'Auditoría de velocidad',
    'sp.casesLede': 'Dos huecos, los dos a la espera de mediciones reales. Los análisis de tiendas públicas se etiquetan como tales — una demo sin relación comercial vale más que un cliente inventado.',
    'sp.awaitText': 'Sin barras hasta que exista un par antes/después medido, con fuente y fecha.',
    'sp.a2': 'Placeholder. Acceso de colaborador a un tema duplicado. El de producción no se toca hasta que apruebas el diff.',
    'sp.q3': '¿Cómo funciona exactamente la garantía?',
    'sp.a3': 'Placeholder. PageSpeed móvil 85+ en el conjunto de plantillas acordado, medido juntos el último día. Por debajo de eso, devolución íntegra y te quedas el trabajo.',
    'sp.q4': '¿Condiciones de pago?',
    'sp.a4': 'Placeholder — fijar condiciones antes de publicar. Transferencia o tarjeta, repartido entre inicio y entrega.',
    'sp.q5': '¿Esto me ayuda con el SEO?',
    'sp.a5a': 'Placeholder. La velocidad es una señal más entre muchas y no voy a fingir que es la decisiva. Si tu problema es la indexación, ',
    'sp.a5link': 'el sprint de SEO',
    'sp.a5b': ' es la respuesta honesta — se venden por separado y ninguno depende del otro.',
    'sp.ctaTitle': 'Descubre lo que te está costando tu velocidad',
    'sp.ctaLede': 'Un Loom de tres minutos y un informe escrito, en menos de 48 horas. Sin llamada.',

    /* ── Página de SEO ────────────────────────────────── */
    'se.metaTitle': 'Sprint de SEO técnico · Gabriel Arias',
    'se.metaDescription': 'Veintidós comprobaciones técnicas deciden si Google puede rastrear, indexar y leer tu tienda Shopify. La auditoría gratis las corre todas y dice cuáles superas.',
    'se.ogTitle': 'Sprint de SEO técnico · Gabriel Arias',
    'se.ogDescription': 'Toda comprobación fallida en verde, o devolución íntegra. Nunca una promesa sobre posiciones. Auditoría gratis en 48 horas.',
    'se.brandRole': 'SEO técnico Shopify',
    'se.navCta': 'Auditoría de SEO',
    'se.eyebrow': 'SEO técnico Shopify · sprint de 30 días',
    'se.title': 'Shopify viene configurado para vender, no para indexar.',
    'se.lede': 'Veintidós comprobaciones técnicas deciden si Google puede rastrear, indexar y leer bien tu tienda. La tuya supera un número desconocido de ellas. La auditoría gratuita las pasa todas y te dice cuáles.',
    'se.cta': 'Consigue tu auditoría de SEO gratis',
    'se.link': 'Ver las 22 comprobaciones ↓',
    'se.note': 'Sin keywords, sin backlinks, sin promesas de posiciones. Sólo técnico — la parte que se puede medir desde fuera.',
    'se.gaugeLabel': 'Esta web · comprobaciones superadas',
    'se.gaugeBadge': '● Medido el 28 sep 2026',
    'se.gaugeNote': 'Las mismas 22 comprobaciones de la auditoría gratis, contra este dominio: 0 fallos, 0 avisos. Las otras 7 miran fichas de producto y colecciones, que esta web no tiene.',
    'se.checksRun': 'Comprobaciones',
    'se.checksNote': 'Siempre 22 — lo que no se puede medir se informa, nunca se descarta',
    'se.sprintNote': 'Cuatro semanas — la última es re-rastreo y prueba',
    'se.guaranteeValue': 'Toda fallida en verde',
    'se.guaranteeNote': 'O devolución íntegra. Nunca una promesa sobre posiciones.',
    'se.readsEyebrow': 'Lo que recibe un rastreador de verdad',
    'se.readsBadge': '▲ Patrón ilustrativo — no es una tienda medida',
    'se.readsTitle': 'Tu ficha de producto, tal y como la lee Google',
    'se.readsLede': 'Misma página, mismo tema. A la izquierda, los campos que un rastreador encuentra en una plantilla por defecto de Shopify. A la derecha, los mismos campos después del sprint. Aquí no hay trabajo de contenido — es lo que la página declara sobre sí misma.',
    'se.tabsAria': 'Plantilla que se inspecciona',
    'se.tabProduct': 'Producto',
    'se.tabCollection': 'Colección',
    'se.tabHome': 'Inicio',
    'se.default': '■ Plantilla por defecto',
    'se.after': '● Después del sprint',
    'se.defEyebrow': 'Propiedades de la plataforma, no estadísticas',
    'se.defTitle': 'Cinco cosas que Shopify hace por defecto y Google lee mal',
    'se.defLede': 'Todas se pueden verificar en tu propia tienda, en un navegador, ahora mismo. Ninguna es una afirmación sobre tus posiciones.',
    'se.d1t': 'Cada producto vive en dos URLs',
    'se.d1a': ' y ',
    'se.d1b': ' sirven la misma página. Cuál se queda Google depende por completo de la etiqueta canonical que emita tu tema.',
    'se.d2t': 'Los filtros y el orden generan variantes rastreables',
    'se.d2': 'Cada combinación de filtros de una colección es una URL a la que un rastreador puede llegar y en la que gasta presupuesto. En un catálogo de cualquier tamaño son miles de páginas casi idénticas compitiendo con la que quieres posicionar.',
    'se.d3t': 'Un patrón de título, cientos de páginas',
    'se.d3': 'Los temas construyen el título y la meta description desde una plantilla. Es consistente, y es por lo que la misma fórmula se repite en todo tu catálogo sin nada que distinga una página de la siguiente.',
    'se.d4t': 'Los productos con variantes necesitan ProductGroup',
    'se.d4a': 'Google pide ',
    'se.d4b': ' cuando un producto tiene variantes, con precio y disponibilidad en la variante. Muchos temas siguen emitiendo un ',
    'se.d4c': ' pelado y pierden el resultado enriquecido.',
    'se.d5t': 'Un noindex puede llegar por cabecera HTTP',
    'se.d5': ' vive en la respuesta, no en el tema. Puedes leer todas las plantillas que tienes y no ver nunca la instrucción que está dejando una página fuera del índice.',
    'se.checksEyebrow': 'La auditoría · cuatro grupos',
    'se.checksTitle': 'Veintidós comprobaciones, y la lista entera es pública',
    'se.checksLede': 'Puedes repetirlas todas desde tu propio navegador. Una comprobación que no se puede hacer en tu tienda se informa como no medible — nunca se descarta en silencio para que la nota salga mejor, que es por lo que el total siempre son veintidós.',
    'se.pass': '● Correcto',
    'se.fail': '■ Falla',
    'se.warn': '▲ Aviso',
    'se.na': '– No aplica',
    'se.unmeasurable': '— No medible',
    'se.legendNote': 'No aplica y no medible no cuentan en contra del porcentaje de salud. Una tienda de un solo mercado sin hreflang no tiene una carencia — tiene una comprobación que no le aplica.',
    'se.checksWord': '6 comprobaciones',
    'se.checksWord4': '4 comprobaciones',
    'se.checksWord5': '5 comprobaciones',
    'se.checksWord7': '7 comprobaciones',
    'se.passedWord': 'superadas',
    'se.g1why': 'Si Google no puede entrar, todo lo que venga después es decoración.',
    'se.g2why': 'La especialidad de Shopify: la misma página accesible desde varias rutas.',
    'se.g3why': 'Lo que enseña el resultado de verdad, y lo que distingue una página de otra.',
    'se.g4why': 'Los datos estructurados son cómo un listado pasa a ser un resultado con precio, stock y ruta.',
    'se.c1': 'Existe y es accesible',
    'se.c2': 'No bloquea /products, /collections ni /pages',
    'se.c3': 'Una línea Sitemap: en robots.txt',
    'se.c4': 'El índice se sirve, con sus secciones',
    'se.c5': 'Meta robots y X-Robots-Tag en las tres plantillas',
    'se.c6': 'Una URL inventada devuelve un 404 real, no uno blando',
    'se.c7': 'Un canonical en las tres plantillas',
    'se.c8': 'Apunta a la propia página',
    'se.c9': '/collections/x/products/y canonicaliza a /products/y',
    'se.c10': 'Coherente, con x-default presente',
    'se.c11': 'Presente, entre 15 y 65 caracteres',
    'se.c12': 'Distinto en cada plantilla',
    'se.c13': 'Presente, entre 70 y 160 caracteres',
    'se.c14': 'Exactamente uno por plantilla',
    'se.c15': 'El atributo alt está declarado — un alt vacío en una imagen decorativa es correcto',
    'se.c16': 'Product o ProductGroup con name, image, price, priceCurrency, availability',
    'se.c17': 'BreadcrumbList en la ficha de producto',
    'se.c18': 'Organization o WebSite en la home',
    'se.c19': 'ItemList o CollectionPage en la colección',
    'se.c20': 'og:title y og:image',
    'se.c21': 'Ningún bloque JSON-LD roto',
    'se.c22': 'Presente — se informa como informativo',
    'se.notdoLabel': 'Lo que la auditoría no hace',
    'se.notdoText': 'Sin keywords, sin backlinks, sin intención de búsqueda, sin calidad de contenido. Todo eso necesita tu Search Console y APIs de pago, y no se puede medir desde fuera sin inventar. Se lista como dato que falta en cada informe, en vez de adivinarlo.',
    'se.planEyebrow': 'El sprint · 30 días',
    'se.planTitle': 'Cuatro semanas, y la cuarta es la prueba',
    'se.planLede': 'Un cambio de schema que nadie ha vuelto a rastrear está desplegado, no terminado. La última semana existe porque el trabajo no está hecho hasta que Google ha vuelto y puedo enseñarte el antes y el después.',
    'se.w1Text': 'robots.txt, sitemap, noindex en todas las plantillas, 404 de verdad. Si Google no puede entrar, lo demás es decoración.',
    'se.w2Text': 'Canonicals, las dos rutas de producto, parámetros de filtro y orden, hreflang si vendes en más de un mercado.',
    'se.w3': 'Datos estructurados y metadatos',
    'se.w3Text': 'ProductGroup con precio y disponibilidad, migas de pan, organización, listas de colección, títulos y descripciones por plantilla.',
    'se.w4': 'Re-rastreo y prueba',
    'se.w4Text': 'La auditoría se pasa otra vez. Toda comprobación que fallaba está en verde, o el sprint no está terminado. Recibes los dos análisis uno al lado del otro.',
    'se.auditKind': 'Auditoría de SEO',
    'se.audit1': 'Las 22 comprobaciones, con el estado de cada una',
    'se.audit2': 'Hallazgos anclados a las comprobaciones que fallan',
    'se.audit3': 'El plan de cuatro semanas, tuyo para dárselo a quien quieras',
    'se.auditCta': 'Pide la auditoría de SEO',
    'se.sprintKind': 'Sprint de SEO técnico',
    'se.sprintTerm': '30 días · cuatro semanas',
    'se.sprint1': 'Toda comprobación fallida arreglada, en tu tema',
    'se.sprint2': 'Canonicals, rutas y parámetros resueltos',
    'se.sprint3': 'ProductGroup, migas de pan y schema de colección',
    'se.sprint4': 'Re-rastreo en la semana cuatro, con los dos análisis publicados',
    'se.warranty': 'Toda comprobación fallida en verde, o devolución íntegra',
    'se.neverFlag': '▲ Nunca prometido',
    'se.neverText': 'Posiciones, tráfico o ingresos. Los arreglos salen dentro del mes; cuándo vuelve Google a rastrear y a reordenar no me toca prometerlo.',
    'se.q1': '¿Esto me lleva a la primera página?',
    'se.a1': 'Placeholder. No, y quien te lo prometa te está vendiendo otra cosa. Esto deja tu tienda correctamente rastreable, indexable y legible. Por qué posicionas después depende de tu contenido y de tu mercado — y no toco ninguno de los dos.',
    'se.q2': '¿Necesito también el sprint de velocidad?',
    'se.a2a': 'Placeholder. Se venden por separado y ninguno depende del otro. Si estás eligiendo, empieza por ',
    'se.a2link': 'velocidad',
    'se.a2b': ' cuando ya tienes el tráfico, y por SEO cuando no.',
    'se.q3': '¿Qué cuenta como comprobación fallida?',
    'se.a3': 'Placeholder. La auditoría lista las 22 con su estado antes de empezar. La garantía cubre exactamente las marcadas como fallidas en ese primer análisis — acordado por escrito, sin objetivos móviles.',
    'se.q4': '¿Necesitas mi Search Console?',
    'se.a4': 'Placeholder. Para la auditoría no — todo lo que lleva se mide desde fuera. Durante el sprint ayuda para el re-rastreo de la semana cuatro, pero no es imprescindible.',
    'se.ctaTitle': 'Descubre cuántas de las 22 estás superando',
    'se.ctaLede': 'Las 22 comprobaciones, hallazgos anclados a las que fallan y un arreglo que puedes aplicar tú. En menos de 48 horas, sin llamada.',
    'se.crossA': '¿Buscabas velocidad? ',
    'se.crossLink': 'El sprint de velocidad está aquí',
    'se.crossB': '.',

    /* Valores del demo de rastreo. Los nombres técnicos —Product,
       ProductGroup, BreadcrumbList, ItemList, Organization— no se traducen:
       son literales que el cliente verá en su propio HTML. */
    'rd.missing': 'ausente',
    'rd.self': 'a sí misma',
    'rd.yes': 'sí',
    'rd.absent': 'ausente',
    'rd.default': 'por defecto',
    'rd.reviewed': 'revisado',
    'rd.declared': 'declarado',
    'rd.set': 'definida',
    'rd.published': 'publicado',
    'rd.cleanOnly': 'sólo la limpia',
    'rd.found1': '1 encontrado',
    'rd.found2': '2 encontrados',
    'rd.chars138': '138 caracteres',
    'rd.chars124': '124 caracteres',
    'rd.pb1': 'La misma página se sirve también en /products/runner. Google elige una.',
    'rd.pb2': 'Plantilla del tema, misma forma en todos los productos.',
    'rd.pb3': 'Google se escribe la suya a partir del cuerpo de la página.',
    'rd.pb4': 'El nombre del producto más el encabezado de la sección de encima.',
    'rd.pb5': 'Las variantes necesitan ProductGroup; el precio va en la variante.',
    'rd.pb6': 'Sin BreadcrumbList, así que no hay ruta en el resultado.',
    'rd.pa1': 'Autorreferente, idéntico desde las dos rutas.',
    'rd.pa2': 'Patrón por plantilla, con el campo que distingue.',
    'rd.pa3': 'Escrita por plantilla, dentro del rango que Google enseña.',
    'rd.pa4': 'Uno por página, el nombre del producto.',
    'rd.pa5': 'name, image, price, priceCurrency, availability.',
    'rd.pa6': 'Inicio › Zapatillas › Runner, igual que la URL.',
    'rd.cb1': 'Cada combinación de filtros se canonicaliza a sí misma.',
    'rd.cb2': 'El mismo título en todas las variantes filtradas de esta página.',
    'rd.cb3': 'Nada distingue una variante de otra.',
    'rd.cb4': 'Correcto.',
    'rd.cb5': 'Sin ItemList ni CollectionPage.',
    'rd.cb6': 'Los filtros y el orden son URLs accesibles que gastan presupuesto.',
    'rd.ca1': 'Las variantes filtradas apuntan a la colección limpia.',
    'rd.ca2': 'Un solo título para la página que debe posicionar.',
    'rd.ca3': 'Escrita para la colección, no para el filtro.',
    'rd.ca4': 'Sin cambios.',
    'rd.ca5': 'Los productos en el orden en que los enseña la página.',
    'rd.ca6': 'Las variantes con parámetros ya no compiten por presupuesto.',
    'rd.hb1': 'El de serie de Shopify. Su último grupo bloquea a un rastreador llamado Nutch, que despista a las herramientas descuidadas.',
    'rd.hb2': 'Presente en robots.txt.',
    'rd.hb3': 'Nada en la cabecera de respuesta.',
    'rd.hb4': 'Sin bloque Organization ni WebSite.',
    'rd.hb5': 'Los enlaces a la tienda se ven sin previsualización.',
    'rd.hb6': 'Sólo informativo; los rastreadores de IA empiezan a leerlo.',
    'rd.ha1': 'El grupo * verificado línea a línea, nada importante bloqueado.',
    'rd.ha2': 'Sin cambios.',
    'rd.ha3': 'Comprobado en las tres plantillas, no sólo en ésta.',
    'rd.ha4': 'Nombre, logo, URL y perfiles.',
    'rd.ha5': 'Título e imagen en cada enlace compartido.',
    'rd.ha6': 'Escrito, y marcado como informativo en el informe.'
  };

  var DICTS = { es: ES };

  /* ── Detection ─────────────────────────────────────────── */

  function normalise(tag) {
    var base = String(tag || '').toLowerCase().split('-')[0];
    return SUPPORTED.indexOf(base) > -1 ? base : null;
  }

  function stored() {
    try { return normalise(localStorage.getItem(STORE_KEY)); } catch (e) { return null; }
  }

  function remember(lang) {
    try { localStorage.setItem(STORE_KEY, lang); } catch (e) { /* private mode */ }
  }

  function detect() {
    /* A page built in another language (/es/, from build.js) already is
       that language: its URL is the choice, and neither a stored
       preference nor the browser gets to paint English over it — there is
       no English dictionary to paint with. */
    var built = normalise(document.documentElement.lang);
    if (built && built !== SOURCE) return built;

    var params = new URLSearchParams(window.location.search);
    var fromUrl = normalise(params.get('lang'));
    if (fromUrl) return fromUrl;

    var saved = stored();
    if (saved) return saved;

    var list = navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language];
    for (var i = 0; i < list.length; i++) {
      var hit = normalise(list[i]);
      if (hit) return hit;
    }
    return SOURCE;
  }

  /* ── Applying ──────────────────────────────────────────
     The English in the markup is the fallback, so it is snapshotted the
     first time an element is touched and restored when switching back. */

  var originals = new Map();

  function baseline(el, slot, read) {
    var slots = originals.get(el);
    if (!slots) { slots = {}; originals.set(el, slots); }
    if (!(slot in slots)) slots[slot] = read();
    return slots[slot];
  }

  function swap(selector, slot, read, write) {
    var nodes = document.querySelectorAll(selector);
    Array.prototype.forEach.call(nodes, function (el) {
      var key = el.getAttribute(slot === 'text' ? 'data-i18n' : 'data-i18n-' + slot);
      var fallback = baseline(el, slot, function () { return read(el); });
      var dict = DICTS[current];
      write(el, (dict && dict[key]) || fallback);
    });
  }

  function apply() {
    swap('[data-i18n]', 'text',
      function (el) { return el.textContent; },
      function (el, value) { el.textContent = value; });

    swap('[data-i18n-aria]', 'aria',
      function (el) { return el.getAttribute('aria-label'); },
      function (el, value) { el.setAttribute('aria-label', value); });

    swap('[data-i18n-content]', 'content',
      function (el) { return el.getAttribute('content'); },
      function (el, value) { el.setAttribute('content', value); });

    swap('[data-i18n-href]', 'href',
      function (el) { return el.getAttribute('href'); },
      function (el, value) { el.setAttribute('href', value); });

    document.documentElement.lang = current;

    Array.prototype.forEach.call(document.querySelectorAll('[data-lang]'), function (el) {
      var active = el.getAttribute('data-lang') === current;
      if (active) el.setAttribute('aria-current', 'true');
      else el.removeAttribute('aria-current');
    });

    document.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang: current } }));
  }

  /* ── Public surface ────────────────────────────────────── */

  var current = detect();

  var api = {
    lang: current,
    locale: LOCALES[current],

    /* Strings assembled in JS live in assets/main.js in English and are
       looked up here; a missing key returns the English fallback. */
    t: function (key, fallback) {
      var dict = DICTS[current];
      return (dict && dict[key]) || fallback;
    },

    num: function (n, decimals) {
      return Number(n).toLocaleString(api.locale, {
        minimumFractionDigits: decimals || 0,
        maximumFractionDigits: decimals || 0
      });
    },

    money: function (n) {
      return '$' + Math.round(Number(n) || 0).toLocaleString(api.locale);
    },

    set: function (lang) {
      var next = normalise(lang);
      if (!next || next === current) return;
      current = next;
      api.lang = next;
      api.locale = LOCALES[next];
      remember(next);
      apply();
    }
  };

  window.i18n = api;

  /* The switch is a pair of real ?lang= links: if this handler never binds,
     following one still lands on a page that reads the parameter. */
  var group = document.querySelector('[data-lang-switch]');
  if (group) {
    group.addEventListener('click', function (event) {
      var link = event.target.closest('[data-lang]');
      if (!link) return;
      /* In dist/ the other language is its own URL under /es/: remember the
         choice and let the link navigate. Only a ?lang= link — the source
         served as-is — swaps in place. */
      if (link.getAttribute('href').charAt(0) !== '?') {
        remember(link.getAttribute('data-lang'));
        return;
      }
      event.preventDefault();
      api.set(link.getAttribute('data-lang'));
      var url = new URL(window.location.href);
      url.searchParams.set('lang', api.lang);
      window.history.replaceState(null, '', url);
    });
  }

  apply();
})();
