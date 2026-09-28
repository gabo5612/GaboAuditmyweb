/* Utilidades compartidas. Sin dependencias: Node 18+ trae fetch. */

export const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36 GabrielAriasAudit/0.1';

/** Espera en ms. */
export const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * fetch con timeout y reintentos con espera creciente.
 * Riesgo §5: "PSI falla o da timeout en tiendas muy lentas — justo las que
 * más te interesan". 3 reintentos, y si aun así falla, el llamante marca
 * la auditoría como fallida en vez de enviar un informe con huecos.
 */
export async function fetchRetry(url, {
  retries = 3, timeout = 60000, esperaBaseMs = 2000, reintentoTardioMs = null, ...opts
} = {}) {
  let lastErr, deRed = false;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(esperaBaseMs * Math.pow(2, attempt - 1)); // 2s, 4s, 8s

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, {
        ...opts,
        signal: ctrl.signal,
        headers: { 'user-agent': UA, ...(opts.headers || {}) },
      });
      // 429 y 5xx merecen reintento; 4xx restantes no van a mejorar.
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`HTTP ${res.status} en ${url}`);
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      deRed = true;
    } finally {
      clearTimeout(timer);
    }
  }

  /* Reintento tardío, sólo para fallos de red (`fetch failed`, socket
     cerrado), nunca para un 429 o un 5xx: ésos son el servidor diciendo que
     no, y volver a preguntar medio minuto después no cambia la respuesta.
     El PSI de escritorio de NaturVet cayó así en 1 de 4 corridas pese a los
     tres reintentos rápidos: el corte dura más que 2 + 4 + 8 s. */
  if (deRed && reintentoTardioMs != null && lastErr instanceof Error && !/^HTTP \d/.test(lastErr.message)) {
    await sleep(reintentoTardioMs);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, {
        ...opts,
        signal: ctrl.signal,
        headers: { 'user-agent': UA, ...(opts.headers || {}) },
      });
      if (res.status !== 429 && res.status < 500) return res;
      lastErr = new Error(`HTTP ${res.status} en ${url}`);
    } catch (err) {
      lastErr = err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr || new Error(`fetch falló: ${url}`);
}

export async function fetchJson(url, opts) {
  const res = await fetchRetry(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res.json();
}

/** Normaliza a origen con https y sin barra final. */
export function normalizeOrigin(input) {
  let raw = String(input || '').trim();
  if (!raw) throw new Error('URL vacía');
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  const u = new URL(raw);
  return u.origin;
}

/**
 * Une un origen (o una URL con barra final) con una ruta absoluta sin
 * producir `https://x.com//robots.txt`. La doble barra no rompe la petición,
 * pero se imprime en el informe como fuente de cada comprobación, y un
 * prospecto técnico la lee como descuido.
 */
export function unirUrl(base, ruta) {
  return new URL(ruta, base).href;
}

export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

/** Token largo no adivinable para la URL del informe (doc §4). */
export function reportToken(bytes = 16) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, b => b.toString(16).padStart(2, '0')).join('');
}

export const today = () => new Date().toISOString().slice(0, 10);

export function round(n, decimals = 1) {
  if (n == null || Number.isNaN(n)) return null;
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

/** Log a stderr, para que stdout quede limpio para el JSON. */
export const log = (...args) => console.error(...args);
