/* Validación del análisis antes de convertirlo en informe.

   No es un validador genérico de JSON Schema: comprueba exactamente las
   reglas duras del prompt, que son las que, si se saltan, mandan un número
   inventado a un prospecto de 2.000 €.

   Un fallo aquí detiene el informe. El paso ⑤ no puede corregir lo que no
   llega a generarse, y eso es intencionado. */

const IMPACTOS = ['alto', 'medio', 'bajo'];
const CONFIANZAS = ['alta', 'media', 'baja'];

export function validarAnalisis(a, datos) {
  const errores = [];
  const avisos = [];
  const E = m => errores.push(m);
  const A = m => avisos.push(m);

  if (!a || typeof a !== 'object') return { ok: false, errores: ['el análisis no es un objeto'], avisos };

  if (!a.diagnostico_una_linea?.trim()) E('falta diagnostico_una_linea');
  if ((a.diagnostico_una_linea || '').length > 200) E('diagnostico_una_linea pasa de 200 caracteres');

  // ── Coste: regla 3. Sin facturación no hay importe. ──────────────
  const c = a.coste_estimado_mensual;
  if (!c) E('falta coste_estimado_mensual');
  else {
    if (!c.fuente?.trim()) E('coste_estimado_mensual sin fuente');
    if (!Array.isArray(c.supuestos) || !c.supuestos.length) E('coste_estimado_mensual sin supuestos');
    if (c.valor != null && datos?.dinero?.facturacion_mensual == null) {
      E('coste_estimado_mensual.valor tiene importe pero la facturación del cliente es desconocida — número inventado');
    }
    if (c.valor == null && c.porcentaje == null) E('coste_estimado_mensual no tiene ni valor ni porcentaje');
  }

  // ── Hallazgos: reglas 2 y 4. ─────────────────────────────────────
  if (!Array.isArray(a.hallazgos) || !a.hallazgos.length) E('no hay hallazgos');
  else {
    if (a.hallazgos.length > 5) E(`${a.hallazgos.length} hallazgos: el máximo es 5`);
    a.hallazgos.forEach((h, i) => {
      const p = `hallazgo ${i + 1}`;
      for (const campo of ['titulo', 'que_pasa', 'por_que_cuesta_dinero', 'que_haria']) {
        if (!h?.[campo]?.trim()) E(`${p}: falta ${campo}`);
      }
      if (!IMPACTOS.includes(h?.impacto)) E(`${p}: impacto debe ser ${IMPACTOS.join('|')}`);
      if (typeof h?.esfuerzo_horas !== 'number') E(`${p}: esfuerzo_horas debe ser un número`);

      const ev = h?.evidencia;
      if (!ev) E(`${p}: sin evidencia — el hallazgo no existe`);
      else {
        for (const campo of ['metrica', 'valor', 'fuente', 'fecha']) {
          if (!String(ev[campo] ?? '').trim()) E(`${p}: evidencia sin ${campo}`);
        }
        if (ev.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(ev.fecha)) E(`${p}: fecha "${ev.fecha}" no es AAAA-MM-DD`);
      }
      if (jergaDeAgencia(h)) A(`${p}: suena a agencia, reescríbelo`);
    });
  }

  // ── Plan: tres semanas exactas. ──────────────────────────────────
  if (!Array.isArray(a.plan_3_semanas) || a.plan_3_semanas.length !== 3) {
    E('plan_3_semanas debe tener exactamente 3 entradas');
  } else {
    a.plan_3_semanas.forEach((s, i) => {
      if (s?.semana !== i + 1) E(`plan: la entrada ${i + 1} debería ser semana ${i + 1}`);
      if (!s?.objetivo?.trim()) E(`plan semana ${i + 1}: sin objetivo`);
      if (!Array.isArray(s?.tareas) || !s.tareas.length) E(`plan semana ${i + 1}: sin tareas`);
      if (!s?.resultado_esperado?.trim()) E(`plan semana ${i + 1}: sin resultado esperado`);
    });
  }

  // ── Quick win ────────────────────────────────────────────────────
  const q = a.quick_win_regalado;
  if (!q) E('falta quick_win_regalado');
  else {
    if (!q.titulo?.trim()) E('quick win sin título');
    if (!Array.isArray(q.pasos) || !q.pasos.length) E('quick win sin pasos');
    if (!q.mejora_estimada?.trim()) E('quick win sin mejora estimada');
    if (typeof q.requiere_dev !== 'boolean') E('quick win: requiere_dev debe ser booleano');
    if (q.requiere_dev) A('el quick win necesita desarrollador: pierde casi toda su fuerza');
  }

  if (!CONFIANZAS.includes(a.confianza)) E(`confianza debe ser ${CONFIANZAS.join('|')}`);
  if (!Array.isArray(a.datos_faltantes)) E('datos_faltantes debe ser un array');

  // ── Regla 6: score > 75 obliga a confianza baja y honestidad. ────
  const score = datos?.rendimiento?.movil?.score;
  if (score != null && score > 75 && a.confianza !== 'baja') {
    E(`score móvil ${score} > 75: la confianza debe ser "baja" y el diagnóstico decir que hay poco que arreglar`);
  }

  // ── Regla 1: ningún número puede salir de la nada. ───────────────
  for (const inventado of numerosInventados(a, datos)) A(inventado);

  /* El motor registra lo que no midió en español; el informe va en el
     idioma del cliente y sólo imprime la lista del análisis. Si el análisis
     no las recoge todas, traducidas, una falta desaparece del informe. */
  const faltanMotor = (datos?.datos_faltantes || []).length;
  if ((a.idioma || 'en') !== 'es' && (a.datos_faltantes || []).length < faltanMotor) {
    E(`datos_faltantes: el motor registró ${faltanMotor} y el análisis trae ${(a.datos_faltantes || []).length}. Tradúcelas todas al idioma del informe.`);
  }

  return { ok: errores.length === 0, errores, avisos };
}

/**
 * Validación del análisis SEO. Mismas reglas duras, con dos diferencias:
 *
 * - Cada hallazgo tiene que citar el `id` de una comprobación que
 *   realmente falló. Es una regla más fuerte que la de velocidad: aquí no
 *   se comprueba que el número exista en la entrada, se comprueba que el
 *   problema exista.
 * - Prohibido el dinero. Sin volumen de búsqueda ni CTR por posición,
 *   cualquier euro en un informe de SEO es inventado, y el cliente que lo
 *   descubre no vuelve.
 */
export function validarAnalisisSeo(a, datos) {
  const errores = [];
  const avisos = [];
  const E = m => errores.push(m);
  const A = m => avisos.push(m);

  if (!a || typeof a !== 'object') return { ok: false, errores: ['el análisis no es un objeto'], avisos };

  if (!a.diagnostico_una_linea?.trim()) E('falta diagnostico_una_linea');
  if ((a.diagnostico_una_linea || '').length > 200) E('diagnostico_una_linea pasa de 200 caracteres');
  if (!a.que_no_promete?.trim()) E('falta que_no_promete — es obligatorio y no se suaviza');

  // ── Hallazgos anclados a comprobaciones reales ───────────────────
  const porId = new Map((datos?.comprobaciones || []).map(c => [c.id, c]));

  if (!Array.isArray(a.hallazgos) || !a.hallazgos.length) E('no hay hallazgos');
  else {
    if (a.hallazgos.length > 5) E(`${a.hallazgos.length} hallazgos: el máximo es 5`);
    a.hallazgos.forEach((h, i) => {
      const p = `hallazgo ${i + 1}`;
      for (const campo of ['titulo', 'que_pasa', 'por_que_importa', 'que_haria', 'verificable_como']) {
        if (!h?.[campo]?.trim()) E(`${p}: falta ${campo}`);
      }
      if (!IMPACTOS.includes(h?.impacto)) E(`${p}: impacto debe ser ${IMPACTOS.join('|')}`);
      if (typeof h?.esfuerzo_horas !== 'number') E(`${p}: esfuerzo_horas debe ser un número`);

      const ev = h?.evidencia;
      if (!ev) { E(`${p}: sin evidencia — el hallazgo no existe`); return; }
      for (const campo of ['comprobacion', 'valor', 'fuente', 'fecha']) {
        if (!String(ev[campo] ?? '').trim()) E(`${p}: evidencia sin ${campo}`);
      }
      if (ev.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(ev.fecha)) E(`${p}: fecha "${ev.fecha}" no es AAAA-MM-DD`);

      const c = porId.get(ev.comprobacion);
      if (!c) {
        E(`${p}: cita la comprobación "${ev.comprobacion}", que no existe en la auditoría — hallazgo inventado`);
      } else if (!['falla', 'aviso'].includes(c.estado)) {
        E(`${p}: la comprobación "${ev.comprobacion}" está en estado "${c.estado}", no es un problema`);
      } else if (ev.valor && c.valor && !String(c.valor).includes(String(ev.valor).slice(0, 20))) {
        A(`${p}: el valor citado no coincide con el medido ("${c.valor}") — compruébalo`);
      }

      if (jergaDeAgencia(h)) A(`${p}: suena a agencia, reescríbelo`);
    });

    // Regla 3: ni euros ni promesas de tráfico dentro de los hallazgos.
    const prosa = a.hallazgos.map(h =>
      `${h?.titulo} ${h?.que_pasa} ${h?.por_que_importa} ${h?.que_haria}`).join(' ');
    if (/[€$£]|\beuros?\b|\bdólares?\b|\bdollars?\b|facturaci[óo]n|ingresos|revenue/i.test(prosa)) {
      E('los hallazgos hablan de dinero: la auditoría SEO no mide ingresos y cualquier importe sería inventado');
    }
    if (/\b(primera p[áa]gina|top ?\d|posici[óo]n \d|puesto \d|\d+ ?% (m[áa]s|more) de (tr[áa]fico|traffic))/i.test(prosa)) {
      E('los hallazgos prometen posiciones o tráfico: la entrada no contiene ni una impresión ni una posición');
    }
  }

  // ── Plan: cuatro semanas exactas, la última de verificación ──────
  if (!Array.isArray(a.plan_4_semanas) || a.plan_4_semanas.length !== 4) {
    E('plan_4_semanas debe tener exactamente 4 entradas');
  } else {
    a.plan_4_semanas.forEach((s, i) => {
      if (s?.semana !== i + 1) E(`plan: la entrada ${i + 1} debería ser semana ${i + 1}`);
      if (!s?.objetivo?.trim()) E(`plan semana ${i + 1}: sin objetivo`);
      if (!Array.isArray(s?.tareas) || !s.tareas.length) E(`plan semana ${i + 1}: sin tareas`);
      if (!s?.resultado_esperado?.trim()) E(`plan semana ${i + 1}: sin resultado esperado`);
    });
    if (!a.plan_4_semanas[3]?.verificable_como?.trim()) {
      A('la semana 4 no dice cómo se verifica: es la semana de re-rastreo, sin verificación no cierra');
    }
  }

  const q = a.quick_win_regalado;
  if (!q) E('falta quick_win_regalado');
  else {
    if (!q.titulo?.trim()) E('quick win sin título');
    if (!Array.isArray(q.pasos) || !q.pasos.length) E('quick win sin pasos');
    if (!q.mejora_estimada?.trim()) E('quick win sin mejora estimada');
    if (typeof q.requiere_dev !== 'boolean') E('quick win: requiere_dev debe ser booleano');
    if (q.requiere_dev) A('el quick win necesita desarrollador: pierde casi toda su fuerza');
  }

  if (!CONFIANZAS.includes(a.confianza)) E(`confianza debe ser ${CONFIANZAS.join('|')}`);
  if (!Array.isArray(a.datos_faltantes)) E('datos_faltantes debe ser un array');

  // Regla 6: casi nada roto obliga a confianza baja y a decirlo.
  const fallos = datos?.resumen?.falla;
  if (fallos != null && fallos <= 1 && a.confianza !== 'baja') {
    E(`sólo ${fallos} comprobación(es) fallida(s): la confianza debe ser "baja" y el diagnóstico decir que la base técnica está en orden`);
  }

  /* El motor registra lo que no midió en español; el informe va en el
     idioma del cliente y sólo imprime la lista del análisis. Si el análisis
     no las recoge todas, traducidas, una falta desaparece del informe. */
  const faltanMotor = (datos?.datos_faltantes || []).length;
  if ((a.idioma || 'en') !== 'es' && (a.datos_faltantes || []).length < faltanMotor) {
    E(`datos_faltantes: el motor registró ${faltanMotor} y el análisis trae ${(a.datos_faltantes || []).length}. Tradúcelas todas al idioma del informe.`);
  }

  return { ok: errores.length === 0, errores, avisos };
}

const redondear = (n, d) => Math.round(n * Math.pow(10, d)) / Math.pow(10, d);
const igual = (a, b) => Math.abs(a - b) < 1e-9;

/* Claves que contienen números que nunca son una medición: identificadores
   internos de Shopify. Citarlos en un informe no tendría sentido, y dejarlos
   en el pajar hace que casi cualquier cifra encuentre pareja por azar. */
const CLAVES_NO_MEDIDAS = new Set(['id', 'theme_store_id', 'shop_id']);

/**
 * Los valores que el informe puede citar legítimamente: sólo números que
 * son números en el JSON, nunca dígitos dentro de una cadena. Así quedan
 * fuera las fechas ("2026-08-12"), las versiones ("12.2.1") y los anchos
 * incrustados en URLs ("?width=2400"), que no son mediciones de nada.
 */
function valoresMedidos(datos) {
  const salida = [];
  const visitar = (nodo, clave) => {
    if (typeof nodo === 'number') {
      if (Number.isFinite(nodo) && !CLAVES_NO_MEDIDAS.has(clave)) salida.push(nodo);
    } else if (Array.isArray(nodo)) {
      for (const hijo of nodo) visitar(hijo, clave);
    } else if (nodo && typeof nodo === 'object') {
      for (const [k, v] of Object.entries(nodo)) visitar(v, k);
    }
  };
  visitar(datos, null);
  return salida;
}

const JERGA = [
  'sinergia', 'holístico', 'holistico', 'presencia digital', 'ecosistema digital',
  'en el mundo actual', 'soluciones a medida', 'valor añadido', 'poner en valor',
  'synergy', 'holistic', 'digital presence', 'in today', 'leverage', 'cutting-edge',
  'best-in-class', 'seamless', 'robust solution', 'game-changer',
  // SEO: el sector con más vocabulario vacío por metro cuadrado.
  'posicionamiento integral', 'estrategia 360', 'seo 360', 'autoridad de dominio',
  'primeras posiciones', 'nos posicionamos', 'boost your rankings', 'dominate search',
];
/* Recorre los campos de texto que haya, no una lista fija: el hallazgo de
   velocidad tiene `por_que_cuesta_dinero` y el de SEO `por_que_importa`. */
function jergaDeAgencia(h) {
  const texto = Object.values(h || {})
    .filter(v => typeof v === 'string').join(' ').toLowerCase();
  return JERGA.some(j => texto.includes(j));
}

/**
 * Busca cifras con unidad en la prosa que no aparezcan en el JSON de
 * entrada. Es heurístico y por eso avisa en vez de bloquear: el juicio
 * final es tuyo en el paso ⑤. Pero pilla el fallo caro — el "3,2 s" que
 * suena creíble y no lo midió nadie.
 */
function numerosInventados(a, datos) {
  if (!datos) return [];

  /* Comparación numérica, no de subcadena. Buscar "10" dentro del JSON
     serializado casa con "11044168" y con "1024", así que el guardián
     dejaba pasar casi cualquier cifra que redondease a un entero corto.
     Aquí se extraen los números medidos como valores y se comparan con
     tolerancia. */
  const medidos = valoresMedidos(datos);

  const prosa = (a.hallazgos || []).flatMap(h => [
    h.titulo, h.que_pasa, h.por_que_cuesta_dinero, h.que_haria, h.evidencia?.valor,
  ]).concat(a.diagnostico_una_linea, a.que_pasa_si_no_se_arregla).filter(Boolean).join(' ');

  const avisos = [];
  const vistos = new Set();

  /* El límite se expresa como "no seguido de letra o dígito", no como \b:
     detrás de `%` nunca hay frontera de palabra, así que con \b ningún
     porcentaje llegaba a comprobarse — justo la unidad donde más fácil se
     cuela una promesa inventada. */
  for (const m of prosa.matchAll(/(\d+(?:[.,]\d+)?)\s*(ms|s|kb|mb|%)(?![\w%])/gi)) {
    const [, crudo, unidad] = m;
    const clave = `${crudo}${unidad}`.toLowerCase();
    if (vistos.has(clave)) continue;
    vistos.add(clave);

    const valor = parseFloat(crudo.replace(',', '.'));
    if (!Number.isFinite(valor)) continue;

    /* Un número escrito es legítimo si es el redondeo fiel de algo medido,
       a la precisión con la que se escribió: "5,2 s" vale para un LCP de
       5,23 s, pero "3,2 s" no vale porque exista un 3 suelto en los datos.

       El cambio de unidad sólo se admite entre segundos y milisegundos, y
       sólo si eso es lo que se escribió: sin esa condición, un LCP de
       escritorio de 2,4 s acaba validando un "2400 kb". */
    const decimales = (crudo.split(/[.,]/)[1] || '').length;
    const u = unidad.toLowerCase();
    const esRedondeoDe = v =>
      igual(redondear(v, decimales), valor) ||
      (u === 's' && igual(redondear(v / 1000, decimales), valor)) ||
      (u === 'ms' && igual(redondear(v * 1000, decimales), valor));

    if (!medidos.some(esRedondeoDe)) {
      avisos.push(`"${crudo} ${unidad}" no aparece en los datos recogidos — compruébalo antes de aprobar`);
    }
  }
  return avisos;
}
