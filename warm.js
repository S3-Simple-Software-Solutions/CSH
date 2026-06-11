'use strict';
// Calienta la caché del proxy: rastrea páginas (depth-1) y todos sus assets.
const BASE = 'http://127.0.0.1:8088';

const seedPages = [
  '/', '/calendario', '/contacto', '/historia', '/noticias',
  '/plantilla', '/socios', '/terminos',
];

const fetched = new Set();
async function pull(u) {
  if (fetched.has(u)) return null;
  fetched.add(u);
  try {
    const r = await fetch(BASE + u, { headers: { 'accept-encoding': 'identity' } });
    const ct = r.headers.get('content-type') || '';
    const txt = /text\/|javascript|json|svg/i.test(ct) ? await r.text() : null;
    process.stdout.write(`. ${r.status} ${u}\n`);
    return txt;
  } catch (e) {
    process.stdout.write(`x ERR ${u} :: ${e.message}\n`);
    return null;
  }
}

// Extrae rutas same-origin de un HTML/CSS.
function extract(text) {
  const urls = new Set();
  const re = /(?:href|src|content)\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(text))) urls.add(m[1]);
  // srcset: separar por comas y espacios
  const reSet = /srcset\s*=\s*["']([^"']+)["']/gi;
  while ((m = reSet.exec(text))) {
    m[1].split(',').forEach((part) => {
      const u = part.trim().split(/\s+/)[0];
      if (u) urls.add(u);
    });
  }
  // url(...) en CSS
  const reCss = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
  while ((m = reCss.exec(text))) urls.add(m[1]);
  return [...urls];
}

function normalize(u) {
  if (!u) return null;
  if (u.startsWith('//')) return null;            // protocol-relative externo
  if (/^https?:/i.test(u)) return null;           // externo absoluto
  if (u.startsWith('#') || u.startsWith('mailto:') || u.startsWith('tel:')) return null;
  if (!u.startsWith('/')) u = '/' + u;
  return u.replace(/&amp;/g, '&');
}

(async () => {
  // 1) páginas semilla -> recoger sub-páginas y assets
  const assetUrls = new Set();
  const pageUrls = new Set(seedPages);

  for (const p of seedPages) {
    const html = await pull(p);
    if (!html) continue;
    for (const raw of extract(html)) {
      const u = normalize(raw);
      if (!u) continue;
      if (/\.(css|js|png|jpe?g|webp|avif|svg|gif|ico|woff2?|ttf|json)$/i.test(u) ||
          u.startsWith('/_next/')) {
        assetUrls.add(u);
      } else if (u.split('?')[0].split('#')[0].split('/').length <= 3) {
        pageUrls.add(u.split('#')[0]);
      }
    }
  }

  // 2) páginas internas descubiertas (depth-1)
  for (const p of pageUrls) {
    const html = await pull(p);
    if (!html) continue;
    for (const raw of extract(html)) {
      const u = normalize(raw);
      if (!u) continue;
      if (/\.(css|js|png|jpe?g|webp|avif|svg|gif|ico|woff2?|ttf|json)$/i.test(u) ||
          u.startsWith('/_next/')) {
        assetUrls.add(u);
      }
    }
  }

  // 3) todos los assets (incluye _next/image que trae las fotos reales)
  for (const a of assetUrls) await pull(a);

  process.stdout.write(`\nTotal solicitado: ${fetched.size} recursos\n`);
})();
