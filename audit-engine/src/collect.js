/* Etapa ② — Recogida de datos. Orquesta todo y devuelve un JSON crudo.

   Nada de prosa aquí: sólo hechos medidos, cada uno con su fuente y su
   fecha. La prosa la escribe la etapa ③ a partir de esto, y sólo puede
   usar números que aparezcan en esta salida. */

import { pareceEscaparate } from './seo.js';
import { fallasCampo } from './cwv.js';
import { normalizeOrigin, hostOf, today, log, sleep } from './util.js';
import { runPsi, elegirMediana } from './psi.js';
import { runCrux } from './crux.js';
import { cargarPagina, descubrirPaginas } from './page.js';
import { analizarInfra, confirmarShopifyEnHtml, detectarTema } from './infra.js';
import { detectarApps } from './apps.js';
import { calcularPerdida } from './money.js';
import { calcularScore, detectarMoneda } from './score.js';

/**
 * @param {string} entrada dominio o URL de la tienda
 * @param {object} opciones
 * @param {string[]} opciones.competidores URLs de competidores del mismo nicho
 * @param {number|null} opciones.facturacion facturación mensual, si el cliente la dio
 * @param {number} opciones.corridas corridas de PSI móvil; se publica la mediana
 * @param {number} opciones.esperaCacheMs separación mínima entre corridas móviles
 */
export async function auditar(entrada, opciones = {}) {
  const {
    competidores = [], facturacion = null, moneda = null, facturacionRango = null,
    /* 1 por defecto en la biblioteca; los bin/ piden 3. Así la cuota de un
       uso programático no se triplica sin que nadie lo haya decidido. */
    corridas = 1,
    // PSI cachea ~60 s por URL: preguntar antes devuelve la misma corrida.
    esperaCacheMs = 65000,
    psiOpciones = {},
  } = opciones;
  const origin = normalizeOrigin(entrada);
  const host = hostOf(origin);
  const faltantes = [];

  log(`\n▸ Auditando ${host}`);

  // ── Infraestructura y validación de que es Shopify ────────────────
  // Un dominio muerto, un DNS que no resuelve o un TLS roto son resultados
  // legítimos de una auditoría, no excepciones: tienen que salir como
  // `fallida` igual que el resto, no como una traza de pila sin JSON.
  let infra;
  try {
    infra = await analizarInfra(origin);
  } catch (err) {
    return fallida(origin, host, `no se pudo contactar con el dominio: ${err.message}`, 'inalcanzable');
  }

  const home = await cargarPagina(infra.url_final || origin);

  if (home.error) {
    return fallida(origin, host, `no se pudo descargar la home: ${home.error}`);
  }

  const shopifyHtml = confirmarShopifyEnHtml(home.html);
  const esShopify = infra.shopify.confirmado || shopifyHtml.confirmado;
  if (!esShopify) {
    // Validación §① punto 2. Respuesta honesta: sólo audito Shopify.
    return fallida(origin, host, 'no es una tienda Shopify', 'no_shopify');
  }

  /* Las dos puertas de pareceEscaparate que dependen de la URL y no del
     HTML: una tienda cerrada (/password) o una cadena que acaba en el
     checkout. westernrise.com (28 sep) se midió entera sobre /password. */
  const escaparate = pareceEscaparate({ title: 'x', h1: 1 }, home.final_url || infra.url_final || origin);
  if (!escaparate.ok) return fallida(origin, host, escaparate.motivo, 'no_escaparate');

  // ── Estructura: home + ficha de producto + colección ──────────────
  const { producto, coleccion } = await descubrirPaginas(infra.url_final || origin, home.html);
  const paginas = [home];
  if (producto) paginas.push(await cargarPagina(producto));
  if (coleccion) paginas.push(await cargarPagina(coleccion));
  const validas = paginas.filter(p => p && !p.error);

  if (!producto) faltantes.push('No se localizó una ficha de producto pública.');
  if (!coleccion) faltantes.push('No se localizó una página de colección pública.');

  const tema = detectarTema(home.html);
  const monedaActiva = detectarMoneda(home.html);
  const apps = detectarApps(validas, host);
  if (!tema) faltantes.push('No se pudo identificar el tema (Shopify.theme no presente en el HTML).');

  // ── Rendimiento ───────────────────────────────────────────────────
  const urlPsi = infra.url_final || origin;
  const corridasMovil = [];
  let ultimaMovil = 0;
  const medirMovil = async () => {
    const espera = esperaCacheMs - (Date.now() - ultimaMovil);
    if (ultimaMovil && espera > 0) await sleep(espera);
    ultimaMovil = Date.now();
    return runPsi(urlPsi, 'mobile', psiOpciones);
  };

  let psiEscritorio = null;
  try {
    corridasMovil.push(await medirMovil());
  } catch (err) {
    // Sin el dato móvil no hay informe. Es la métrica sobre la que se
    // sostiene todo el argumento: mejor fallar que rellenar el hueco.
    return fallida(origin, host, `PageSpeed móvil falló: ${err.message}`);
  }
  try {
    psiEscritorio = await runPsi(urlPsi, 'desktop', psiOpciones);
  } catch (err) {
    faltantes.push(`No hay dato de PageSpeed en escritorio: ${err.message}`);
  }

  /* El origen tiene que ser el de después de la redirección: CrUX indexa por
     origen exacto, y casi toda tienda con dominio propio manda el ápex a
     www. Preguntando por el ápex se recibe un 404 y el dato de campo se
     descarta como "tráfico bajo" en tiendas que sí lo tienen.

     Y va envuelto porque es una fuente opcional: un fallo de red aquí no
     puede tumbar una auditoría por lo demás completa. */
  let crux;
  const origenCampo = origenDe(infra.url_final) || origin;
  try {
    crux = await runCrux(origenCampo, 'PHONE');
  } catch (err) {
    crux = { disponible: false, motivo: `la consulta falló: ${err.message}` };
  }
  if (!crux.disponible) {
    faltantes.push(`Sin dato de campo de usuarios reales: ${crux.motivo}.`);
  }

  // ── Competencia ───────────────────────────────────────────────────
  // Se auditan los competidores que TÚ indicas. Adivinarlos automáticamente
  // produciría comparaciones falsas, que es exactamente el fallo que hunde
  // la credibilidad en la primera frase.
  const competencia = [];
  for (const url of competidores.filter(Boolean)) {
    try {
      const co = normalizeOrigin(url);
      log(`  · competidor: ${hostOf(co)}`);
      const psi = await runPsi(co, 'mobile');
      /* También sus usuarios reales: la comparación que cuenta es campo
         contra campo. Un laboratorio de una corrida contra la mediana de
         tres del prospecto no es «mismo test, mismo día». */
      let campo = null;
      for (const o of [co, co.replace('://www.', '://'), co.replace('://', '://www.')]) {
        try {
          const c = await runCrux(o, 'PHONE');
          const f = fallasCampo(c);
          if (f) {
            const u = k => c.series?.[k]?.ultimo ?? null;
            campo = {
              lcp_s: u('largest_contentful_paint') != null ? Math.round(u('largest_contentful_paint') / 10) / 100 : null,
              inp_ms: u('interaction_to_next_paint'), cls: u('cumulative_layout_shift') != null ? Number(u('cumulative_layout_shift')) : null,
              aprueba_cwv: f.fallas.length === 0, fuente: c.fuente, fecha: c.fecha,
            };
            break;
          }
        } catch { /* sin CrUX para este origen: se prueba la otra forma */ }
      }
      competencia.push({
        host: hostOf(co), url: co,
        score: psi.score, lcp_s: psi.metricas.lcp_s, cls: psi.metricas.cls,
        fuente: psi.fuente, fecha: psi.fecha,
        campo,
      });
    } catch (err) {
      log(`    ! falló: ${err.message}`);
    }
  }
  if (!competencia.length) {
    faltantes.push('Sin comparativa: no se indicaron competidores del mismo nicho.');
  }

  /* ── Resto de corridas móviles ───────────────────────────────────
     Van aquí, después de escritorio, CrUX y competidores, para que la
     espera contra la caché de PSI corra mientras se mide lo demás en vez
     de sumarse. Una respuesta cacheada lleva el mismo fetchTime que la
     anterior: no es otra medición y no cuenta. */
  const vistas = new Set(corridasMovil.map(c => c.fetch_time).filter(Boolean));
  let intentos = 0;
  while (corridasMovil.length < corridas && intentos < corridas * 2) {
    intentos++;
    try {
      const c = await medirMovil();
      if (c.fetch_time && vistas.has(c.fetch_time)) {
        log(`    · respuesta cacheada de PSI (${c.fetch_time}), no cuenta`);
        continue;
      }
      if (c.fetch_time) vistas.add(c.fetch_time);
      corridasMovil.push(c);
    } catch (err) {
      log(`    ! corrida móvil extra falló: ${err.message}`);
    }
  }
  if (corridasMovil.length < corridas) {
    faltantes.push(`Sólo ${corridasMovil.length} de ${corridas} corridas móviles de PageSpeed: la cifra publicada es la mediana de las que hay.`);
  }
  const psiMovil = elegirMediana(corridasMovil);

  // ── Dinero y prioridad ────────────────────────────────────────────
  /* La pérdida se calcula sobre lo que viven los clientes, no sobre el
     teléfono emulado de Lighthouse. NaturVet (28 sep): 12,87 s de LCP en
     laboratorio, 1,93 s en el p75 de usuarios reales. Con el de laboratorio
     el informe decía «pierdes el 45 % de la facturación» a una tienda que
     aprueba Core Web Vitals, y PageSpeed enseña el dato de campo arriba del
     todo: el prospecto lo desmiente en un clic. El de laboratorio sigue en
     rendimiento.movil para el diagnóstico — el porqué, no el cuánto. */
  const lcpCampoMs = crux?.disponible ? crux.series?.largest_contentful_paint?.ultimo : null;
  const baseCampo = Number.isFinite(lcpCampoMs) && lcpCampoMs > 0;
  const lcpDinero = baseCampo ? Math.round(lcpCampoMs / 10) / 100 : psiMovil.metricas.lcp_s;
  const dinero = {
    ...calcularPerdida(lcpDinero, facturacion, moneda || monedaActiva || 'USD'),
    base: baseCampo ? 'campo' : 'laboratorio',
    base_fuente: baseCampo ? `${crux.fuente}, ${crux.fecha}` : `PageSpeed Insights (laboratorio), ${psiMovil.fecha}`,
    lcp_laboratorio_s: psiMovil.metricas.lcp_s,
  };
  if (!baseCampo) {
    faltantes.push('Sin dato de usuarios reales (CrUX): la pérdida se calcula sobre el LCP de laboratorio, que en un teléfono emulado suele ser peor que el real.');
  }
  if (!dinero.medible) {
    // PSI respondió pero sin LCP. Rellenarlo con un 0 % tranquilizador es
    // exactamente el fallo que el motor existe para no cometer.
    faltantes.push('PageSpeed no devolvió Largest Contentful Paint: no se puede estimar la pérdida.');
  }
  if (facturacion == null) {
    faltantes.push('Facturación mensual desconocida: la pérdida sólo se expresa en porcentaje.');
  }

  const score = calcularScore({
    psiMovil, apps, tema, moneda: monedaActiva, host, facturacionRango, dinero,
  });

  return {
    estado: 'ok',
    tienda: {
      host, origin, url_final: infra.url_final, moneda_activa: monedaActiva,
      // La URL que PSI midió de verdad. El informe imprime ésta, no la pedida.
      url_analizada: psiMovil.url_analizada,
    },
    fecha_auditoria: today(),
    infra,
    tema,
    paginas: validas.map(p => ({
      url: p.url,
      bytes_html: p.bytes,
      scripts: p.recursos.scripts.length,
      imagenes: p.imagenes,
      fuentes: p.fuentes,
    })),
    apps,
    rendimiento: { movil: psiMovil, escritorio: psiEscritorio },
    campo: crux,
    competencia,
    dinero,
    lead_score: score,
    datos_faltantes: faltantes,
  };
}

/** Sólo el esquema y el host: es como CrUX indexa sus registros. */
function origenDe(url) {
  try { return new URL(url).origin; } catch { return null; }
}

function fallida(origin, host, motivo, codigo = 'error') {
  log(`  ✗ ${motivo}`);
  return {
    estado: 'fallida',
    codigo,
    motivo,
    tienda: { host, origin },
    fecha_auditoria: today(),
    // Riesgo §5: nunca envíes un informe con huecos. Marcarlo como fallido
    // es la salida correcta, no rellenar lo que falta.
    datos_faltantes: [motivo],
  };
}
