'use strict';
// Réplica caché de herediano.com — sirve los bytes reales del sitio y los
// guarda en disco. Una vez "calentado" funciona sin depender del origen.
//
// Delante de todo hay un login por sesión (cookie firmada con HMAC). Las
// peticiones desde loopback (warm.js) se dejan pasar sin login para poder
// calentar la caché. El tráfico público llega vía nginx -> no es loopback.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const os = require('os');
const { execFileSync } = require('child_process');
const nodemailer = require('nodemailer');
const QRCodeNode = require('qrcode');

const ORIGIN = 'https://www.herediano.com';
const PORT = process.env.PORT || 8088;
const HOST = '0.0.0.0';
const CACHE_DIR = path.join(__dirname, 'cache');
const DATA_DIR = path.join(__dirname, 'data');
const PARQUEO_FILE = path.join(DATA_DIR, 'parqueo.json');
const ADMIN_USERS_FILE = path.join(DATA_DIR, 'admin-users.json');
const ADMIN_LOGO_PATH = '/admin/assets/logo-shield.png';
const SITE_LOGO_PATH = '/brand/logo-shield.png';
const WALLET_PASS_TYPE_ID = process.env.HEREDIANO_WALLET_PASS_TYPE_ID || '';
const WALLET_TEAM_ID = process.env.HEREDIANO_WALLET_TEAM_ID || '';
const WALLET_CERT_PATH = process.env.HEREDIANO_WALLET_CERT_PATH || '';
const WALLET_KEY_PATH = process.env.HEREDIANO_WALLET_KEY_PATH || '';
const WALLET_WWDR_PATH = process.env.HEREDIANO_WALLET_WWDR_PATH || '';
const WALLET_KEY_PASS = process.env.HEREDIANO_WALLET_KEY_PASS || '';
const MAIL_FROM = process.env.HEREDIANO_MAIL_FROM || '"Club Sport Herediano" <herediano@milocalhost.work>';
const MAIL_APP_URL = process.env.HEREDIANO_APP_URL || 'https://herediano.milocalhost.work';
const SMTP_HOST = process.env.HEREDIANO_SMTP_HOST || process.env.SMTP_HOST || '127.0.0.1';
const SMTP_PORT = Number(process.env.HEREDIANO_SMTP_PORT || process.env.SMTP_PORT || 1587);
const SMTP_SECURE = String(process.env.HEREDIANO_SMTP_SECURE || process.env.SMTP_SECURE || '').toLowerCase() === 'true';
const SMTP_USER = process.env.HEREDIANO_SMTP_USER || process.env.SMTP_USER || '';
const SMTP_PASS = process.env.HEREDIANO_SMTP_PASS || process.env.SMTP_PASS || '';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// ── Configuración del login ────────────────────────────────────────────────
const AUTH_USER = process.env.HEREDIANO_USER || 'admin';
const AUTH_PASS = process.env.HEREDIANO_PASS || 'herediano2026';
const SECRET = process.env.HEREDIANO_SECRET ||
  'cambie-esta-clave-herediano-secret-2026';
const SESSION_HOURS = Number(process.env.HEREDIANO_SESSION_HOURS || 12);
const COOKIE = 'hsid';
const ADMIN_COOKIE = 'csh_admin';
const ADMIN_SESSION_HOURS = Number(process.env.HEREDIANO_ADMIN_SESSION_HOURS || 8);

const ADMIN_USERS = [
  {
    id: 'u-001',
    name: 'Administrador CSH',
    username: process.env.HEREDIANO_ADMIN_USER || 'admin',
    email: process.env.HEREDIANO_ADMIN_EMAIL || 'admin@herediano.com',
    password: process.env.HEREDIANO_ADMIN_PASS || AUTH_PASS,
    role: 'Super admin',
    area: 'Administracion',
    status: 'Activo',
    parkingRole: 'admin',
  },
  {
    id: 'u-002',
    name: 'Operaciones Estadio',
    username: 'operaciones',
    email: 'operaciones@herediano.com',
    password: 'operaciones1921',
    role: 'Operador',
    area: 'Parqueo',
    status: 'Demo',
    parkingRole: 'admin',
  },
  {
    id: 'u-003',
    name: 'Comercial CSH',
    username: 'comercial',
    email: 'comercial@herediano.com',
    password: 'comercial1921',
    role: 'Editor',
    area: 'Patrocinadores',
    status: 'Demo',
    parkingRole: 'socio',
  },
  {
    id: 'u-004',
    name: 'Socio Demo',
    username: 'socio1',
    email: 'socio1@herediano.com',
    password: 'socio1921',
    role: 'Socio',
    area: 'Parqueo',
    status: 'Demo',
    parkingRole: 'socio',
  },
];

function loadAdminUserOverrides() {
  try {
    return JSON.parse(fs.readFileSync(ADMIN_USERS_FILE, 'utf8'));
  } catch (_) {
    return { passwords: {} };
  }
}

function saveAdminUserOverrides(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(ADMIN_USERS_FILE, JSON.stringify(data, null, 2));
}

function applyAdminUserOverrides() {
  const data = loadAdminUserOverrides();
  for (const user of ADMIN_USERS) {
    if (data.passwords && typeof data.passwords[user.id] === 'string') {
      user.password = data.passwords[user.id];
    }
  }
}

function setAdminUserPassword(userId, password) {
  const data = loadAdminUserOverrides();
  data.passwords = data.passwords || {};
  data.passwords[userId] = password;
  saveAdminUserOverrides(data);
  const user = ADMIN_USERS.find((u) => u.id === userId);
  if (user) user.password = password;
}

applyAdminUserOverrides();

const ADMIN_MODULES = [
  { path: '/admin/pagina-web', label: 'Pagina web', eyebrow: 'Contenido publico', icon: 'web' },
  { path: '/admin/usuarios', label: 'Gestion de usuarios', eyebrow: 'Cuentas y permisos', icon: 'users' },
  { path: '/admin/patrocinadores', label: 'Gestion de patrocinadores', eyebrow: 'Marcas y contratos', icon: 'sponsors' },
  { path: '/admin/parqueo', label: 'Gestion de parqueo', eyebrow: 'Zonas y reservas', icon: 'parking' },
  { path: '/admin/cupones', label: 'Gestion de cupones', eyebrow: 'Promos y beneficios', icon: 'coupons' },
  { path: '/admin/restaurantes', label: 'Gestion de restaurantes', eyebrow: 'Locales y menus', icon: 'restaurants' },
];

fs.mkdirSync(CACHE_DIR, { recursive: true });

const keyFor = (url) => crypto.createHash('sha1').update(url).digest('hex');
const isText = (ct) => /text\/|javascript|json|xml|svg/i.test(ct || '');

// ── Sesión: token = "<expMs>.<hmac>" ───────────────────────────────────────
function sign(exp) {
  return crypto.createHmac('sha256', SECRET).update(String(exp)).digest('hex');
}
function makeToken() {
  const exp = Date.now() + SESSION_HOURS * 3600 * 1000;
  return exp + '.' + sign(exp);
}
function validToken(tok) {
  if (!tok || tok.indexOf('.') < 0) return false;
  const [expStr, mac] = tok.split('.');
  const exp = Number(expStr);
  if (!exp || exp < Date.now()) return false;
  const good = sign(exp);
  if (mac.length !== good.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(good));
  } catch (_) { return false; }
}
function parseCookies(header) {
  const out = {};
  for (const p of (header || '').split(';')) {
    const i = p.indexOf('=');
    if (i <= 0) continue;
    try {
      out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
    } catch (_) {
      out[p.slice(0, i).trim()] = '';
    }
  }
  return out;
}
function isLoopback(req) {
  const ip = req.socket.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}
function isHttps(req) {
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  return proto === 'https' || Boolean(req.socket.encrypted);
}
function safeNext(value) {
  const next = String(value || '/');
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
  if (next.startsWith('/__login')) return '/';
  return /[\r\n]/.test(next) ? '/' : next;
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}
function sessionCookie(req) {
  const attrs = [
    `${COOKIE}=${makeToken()}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${SESSION_HOURS * 3600}`,
  ];
  if (isHttps(req)) attrs.push('Secure');
  return attrs.join('; ');
}
function clearSessionCookie(req) {
  const attrs = [`${COOKIE}=`, 'HttpOnly', 'Path=/', 'SameSite=Lax', 'Max-Age=0'];
  if (isHttps(req)) attrs.push('Secure');
  return attrs.join('; ');
}
function safeEqual(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  return left.length === right.length &&
    crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
}
function checkCreds(u, p) {
  return safeEqual(u, AUTH_USER) && safeEqual(p, AUTH_PASS);
}
function findAdminUser(login, password) {
  const needle = String(login || '').trim().toLowerCase();
  return ADMIN_USERS.find((user) => {
    const userMatches = user.username.toLowerCase() === needle ||
      user.email.toLowerCase() === needle;
    return userMatches && safeEqual(password, user.password);
  }) || null;
}
function signAdmin(exp, userId) {
  return crypto.createHmac('sha256', SECRET)
    .update(`admin:${exp}:${userId}`)
    .digest('hex');
}
function makeAdminToken(user) {
  const exp = Date.now() + ADMIN_SESSION_HOURS * 3600 * 1000;
  return `${exp}.${user.id}.${signAdmin(exp, user.id)}`;
}
function validAdminToken(tok) {
  if (!tok || tok.split('.').length !== 3) return null;
  const [expStr, userId, mac] = tok.split('.');
  const exp = Number(expStr);
  if (!exp || exp < Date.now()) return null;
  const user = ADMIN_USERS.find((u) => u.id === userId);
  if (!user) return null;
  const good = signAdmin(exp, userId);
  if (mac.length !== good.length) return null;
  try {
    return crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(good)) ? user : null;
  } catch (_) { return null; }
}
function adminSessionCookie(req, user) {
  const attrs = [
    `${ADMIN_COOKIE}=${makeAdminToken(user)}`,
    'HttpOnly',
    'Path=/admin',
    'SameSite=Lax',
    `Max-Age=${ADMIN_SESSION_HOURS * 3600}`,
  ];
  if (isHttps(req)) attrs.push('Secure');
  return attrs.join('; ');
}
function clearAdminSessionCookie(req) {
  const attrs = [`${ADMIN_COOKIE}=`, 'HttpOnly', 'Path=/admin', 'SameSite=Lax', 'Max-Age=0'];
  if (isHttps(req)) attrs.push('Secure');
  return attrs.join('; ');
}
function safeAdminNext(value) {
  const next = safeNext(value);
  if (next.startsWith('/admin/sign-in') || next.startsWith('/admin/logout')) return '/admin';
  return next === '/admin' || next.startsWith('/admin/') ? next : '/admin';
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1e4) req.destroy(); // evita cuerpos absurdos
    });
    req.on('end', () => resolve(data));
    req.on('error', () => resolve(''));
  });
}

// ── Parqueo: capa de datos (data/parqueo.json) ─────────────────────────────
function initParqueo() {
  const espacios = [];
  for (const piso of [1, 2]) {
    for (const zona of ['A', 'B']) {
      for (let num = 1; num <= 100; num++) {
        espacios.push({
          id: `P${piso}-${zona}${String(num).padStart(3, '0')}`,
          piso,
          zona,
          num,
          tipo: 'regular',
          estado: 'disponible',
          reservaId: null,
        });
      }
    }
  }
  return { espacios, reservas: [], eventos: [] };
}

function saveParqueo(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(PARQUEO_FILE, JSON.stringify(data, null, 2));
}

function loadParqueo() {
  try {
    return JSON.parse(fs.readFileSync(PARQUEO_FILE, 'utf8'));
  } catch (_) {
    const data = initParqueo();
    saveParqueo(data);
    return data;
  }
}

function nextId(prefix, arr) {
  let max = 0;
  for (const item of arr) {
    const n = Number(String(item.id).split('-').pop());
    if (n > max) max = n;
  }
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

function logEvento(data, tipo, { espacioId, user, placa, notas }) {
  data.eventos.push({
    id: nextId('E', data.eventos),
    tipo,
    espacioId: espacioId || '',
    userId: user ? user.id : null,
    userName: user ? user.name : '',
    placa: placa || '',
    timestamp: new Date().toISOString(),
    notas: notas || '',
  });
}

function sendJson(res, status, obj) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(obj));
}

function b64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function unb64url(input) {
  const value = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(value + '='.repeat((4 - value.length % 4) % 4), 'base64').toString();
}

function walletPayload(recibo) {
  const payload = {
    espacioId: recibo.espacioId,
    placa: recibo.placa,
    horas: recibo.horas,
    monto: recibo.monto,
    issuedAt: new Date().toISOString(),
  };
  const data = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('hex');
  return { data, sig, url: `/api/parqueo/publico/wallet?d=${data}&s=${sig}` };
}

function readWalletPayload(requestUrl) {
  const data = requestUrl.searchParams.get('d') || '';
  const sig = requestUrl.searchParams.get('s') || '';
  const good = crypto.createHmac('sha256', SECRET).update(data).digest('hex');
  if (!sig || sig.length !== good.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
    const payload = JSON.parse(unb64url(data));
    if (!payload.espacioId || !payload.placa) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

function walletConfigured() {
  return WALLET_PASS_TYPE_ID && WALLET_TEAM_ID && WALLET_CERT_PATH && WALLET_KEY_PATH && WALLET_WWDR_PATH &&
    fs.existsSync(WALLET_CERT_PATH) && fs.existsSync(WALLET_KEY_PATH) && fs.existsSync(WALLET_WWDR_PATH);
}

function walletSetupHtml() {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Apple Wallet | Club Sport Herediano</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0a0908;color:#f7f1df;font-family:Inter,system-ui,sans-serif;padding:24px}
.box{max-width:520px;border:1px solid rgba(201,169,97,.45);border-radius:6px;background:#13100e;padding:26px;line-height:1.55}
h1{margin:0 0 10px;font-family:Impact,Haettenschweiler,sans-serif;text-transform:uppercase;font-size:34px}
p{color:#aa9d84} code{color:#c9a961} a{color:#c9a961}
</style></head><body><div class="box">
<h1>Wallet pendiente</h1>
<p>El boton ya esta conectado, pero Apple Wallet requiere firmar el pase con certificados de Apple Developer PassKit.</p>
<p>Configura en <code>.env</code>: <code>HEREDIANO_WALLET_PASS_TYPE_ID</code>, <code>HEREDIANO_WALLET_TEAM_ID</code>, <code>HEREDIANO_WALLET_CERT_PATH</code>, <code>HEREDIANO_WALLET_KEY_PATH</code> y <code>HEREDIANO_WALLET_WWDR_PATH</code>.</p>
<p><a href="/parqueo">Volver al parqueo</a></p>
</div></body></html>`;
}

const WALLET_ICON = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAADwAAAA8CAIAAAC1nk4lAAAACXBIWXMAAAsTAAALEwEAmpwYAAAA' +
  'YUlEQVR4nO3OQQ0AIBDAMMC/5+ONAvZoFSzZnplk9v6tQG+TWCasE1YJq4RVwirhWm4Kwxu3tIxh' +
  'QjYWY50owjphlbBKWCWsElYJq4RVwirhWm4Kwxu3tIxhQjYWY50owjphlR8A4HFsDcvfCqUAAAAA' +
  'SUVORK5CYII=', 'base64');

function writeJsonFile(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
}

function buildWalletPass(payload) {
  if (!walletConfigured()) return null;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csh-pass-'));
  try {
    const serial = crypto.createHash('sha1')
      .update(`${payload.espacioId}|${payload.placa}|${payload.issuedAt}`)
      .digest('hex')
      .slice(0, 16);
    const pass = {
      formatVersion: 1,
      passTypeIdentifier: WALLET_PASS_TYPE_ID,
      serialNumber: serial,
      teamIdentifier: WALLET_TEAM_ID,
      organizationName: 'Club Sport Herediano',
      description: 'Comprobante de parqueo Club Sport Herediano',
      logoText: 'CSH Parqueo',
      foregroundColor: 'rgb(247,241,223)',
      backgroundColor: 'rgb(10,9,8)',
      labelColor: 'rgb(201,169,97)',
      barcode: {
        message: `CSH-PAGO|${payload.espacioId}|${payload.placa}|${payload.horas}h|CRC${payload.monto}|${payload.issuedAt}`,
        format: 'PKBarcodeFormatQR',
        messageEncoding: 'iso-8859-1',
      },
      generic: {
        primaryFields: [
          { key: 'espacio', label: 'Espacio', value: payload.espacioId },
        ],
        secondaryFields: [
          { key: 'placa', label: 'Placa', value: payload.placa },
          { key: 'monto', label: 'Monto', value: `CRC ${payload.monto}` },
        ],
        auxiliaryFields: [
          { key: 'tiempo', label: 'Tiempo', value: `${payload.horas}h` },
        ],
      },
    };
    writeJsonFile(path.join(tmp, 'pass.json'), pass);
    fs.writeFileSync(path.join(tmp, 'icon.png'), WALLET_ICON);
    fs.writeFileSync(path.join(tmp, 'icon@2x.png'), WALLET_ICON);
    const files = ['pass.json', 'icon.png', 'icon@2x.png'];
    const manifest = {};
    for (const file of files) {
      manifest[file] = crypto.createHash('sha1')
        .update(fs.readFileSync(path.join(tmp, file)))
        .digest('hex');
    }
    writeJsonFile(path.join(tmp, 'manifest.json'), manifest);
    const args = ['smime', '-binary', '-sign', '-certfile', WALLET_WWDR_PATH,
      '-signer', WALLET_CERT_PATH, '-inkey', WALLET_KEY_PATH,
      '-in', path.join(tmp, 'manifest.json'), '-out', path.join(tmp, 'signature'),
      '-outform', 'DER', '-nodetach'];
    if (WALLET_KEY_PASS) args.push('-passin', `pass:${WALLET_KEY_PASS}`);
    execFileSync('openssl', args, { stdio: 'ignore' });
    const output = path.join(tmp, 'parqueo.pkpass');
    execFileSync('zip', ['-q', '-j', output, ...files.map((f) => path.join(tmp, f)),
      path.join(tmp, 'manifest.json'), path.join(tmp, 'signature')], { stdio: 'ignore' });
    return fs.readFileSync(output);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ── Parqueo: API publica (invitado anonimo — consulta disponibilidad y reservas)
const PARQUEO_API_PUBLICA = '/api/parqueo/publico';
const TARIFA_HORA = 1000; // colones por hora o fraccion

function montoDe(reserva) {
  const ms = Date.now() - new Date(reserva.inicio).getTime();
  const horas = Math.max(1, Math.ceil(ms / 3600000));
  return { horas, monto: horas * TARIFA_HORA };
}

function maskedReservaEmail(reserva) {
  const email = reservaEmail(reserva);
  const at = email.indexOf('@');
  if (at <= 0 || at === email.length - 1) return 'Sin correo asociado';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  return `${local.slice(0, 3)}***@${domain}`;
}

function reservaEmail(reserva) {
  const owner = ADMIN_USERS.find((user) => user.id === reserva.userId);
  return String(reserva.emailQr || (owner && owner.email) || '').trim().toLowerCase();
}

function ensureReservaQrData(reserva) {
  if (!reserva.codigo) {
    reserva.codigo = `CSH-${reserva.id || crypto.randomUUID()}`;
  }
  if (!reserva.qrData) {
    reserva.qrData = `${reserva.codigo}|${reserva.espacioId}|${reserva.placa}|${reserva.fin}`;
  }
  return reserva.qrData;
}

function makeMailTransport() {
  const config = {
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    tls: { rejectUnauthorized: false },
  };
  if (SMTP_USER || SMTP_PASS) {
    config.auth = { user: SMTP_USER, pass: SMTP_PASS };
  }
  return nodemailer.createTransport(config);
}

function fmtMailDate(iso) {
  return new Date(iso).toLocaleString('es-CR', {
    timeZone: 'America/Costa_Rica',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parkingQrEmailHtml({ reserva }) {
  return `<!doctype html>
<html lang="es"><body style="margin:0;background:#f7f1df;padding:24px;font-family:Arial,sans-serif;color:#1c1713">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e6dcc3;border-radius:10px;overflow:hidden">
    <div style="background:#d62828;color:#fff;padding:22px 28px;text-align:center">
      <h1 style="margin:0;font-size:24px;letter-spacing:.04em">Club Sport Herediano</h1>
      <p style="margin:6px 0 0;color:#ffe7e7">QR de parqueo</p>
    </div>
    <div style="padding:26px 28px">
      <p style="font-size:15px;line-height:1.55;margin:0 0 18px">Presenta este codigo QR en el acceso del parqueo.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 18px">
        <tr><td style="padding:8px;background:#f7f1df;font-weight:bold">Espacio</td><td style="padding:8px">${escapeHtml(reserva.espacioId)}</td></tr>
        <tr><td style="padding:8px;background:#f7f1df;font-weight:bold">Placa</td><td style="padding:8px">${escapeHtml(reserva.placa)}</td></tr>
        <tr><td style="padding:8px;background:#f7f1df;font-weight:bold">Desde</td><td style="padding:8px">${escapeHtml(fmtMailDate(reserva.inicio))}</td></tr>
        <tr><td style="padding:8px;background:#f7f1df;font-weight:bold">Hasta</td><td style="padding:8px">${escapeHtml(fmtMailDate(reserva.fin))}</td></tr>
      </table>
      <p style="font-size:13px;color:#6b6254;margin:0">Tambien puedes abrir el modulo de parqueo: <a href="${MAIL_APP_URL}/parqueo" style="color:#d62828">${MAIL_APP_URL}/parqueo</a></p>
    </div>
    <div style="padding:14px 28px;background:#13100e;color:#aa9d84;text-align:center;font-size:12px">
      Mensaje automatico. No respondas a este correo.
    </div>
  </div>
</body></html>`;
}

async function sendParkingQrEmail({ to, reserva }) {
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    throw new Error('Correo invalido');
  }
  const qrPng = await QRCodeNode.toBuffer(ensureReservaQrData(reserva), {
    type: 'png',
    width: 360,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
  await makeMailTransport().sendMail({
    from: MAIL_FROM,
    to,
    subject: `QR de parqueo ${reserva.espacioId} - Club Sport Herediano`,
    html: parkingQrEmailHtml({ reserva }),
    attachments: [
      {
        filename: `QR-${reserva.codigo || reserva.espacioId}.png`,
        content: qrPng,
        contentType: 'image/png',
      },
    ],
  });
}

function paymentReceiptEmailHtml({ reserva, recibo }) {
  return `<!doctype html>
<html lang="es"><body style="margin:0;background:#f7f1df;padding:24px;font-family:Arial,sans-serif;color:#1c1713">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e6dcc3;border-radius:10px;overflow:hidden">
    <div style="background:#d62828;color:#fff;padding:22px 28px;text-align:center">
      <h1 style="margin:0;font-size:24px;letter-spacing:.04em">Club Sport Herediano</h1>
      <p style="margin:6px 0 0;color:#ffe7e7">Recibo de parqueo</p>
    </div>
    <div style="padding:26px 28px">
      <p style="font-size:15px;line-height:1.55;margin:0 0 18px">Tu pago fue registrado correctamente.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 18px">
        <tr><td style="padding:8px;background:#f7f1df;font-weight:bold">Transaccion</td><td style="padding:8px">${escapeHtml(recibo.transaccion)}</td></tr>
        <tr><td style="padding:8px;background:#f7f1df;font-weight:bold">Espacio</td><td style="padding:8px">${escapeHtml(reserva.espacioId)}</td></tr>
        <tr><td style="padding:8px;background:#f7f1df;font-weight:bold">Placa</td><td style="padding:8px">${escapeHtml(reserva.placa)}</td></tr>
        <tr><td style="padding:8px;background:#f7f1df;font-weight:bold">Tiempo cobrado</td><td style="padding:8px">${recibo.horas}h</td></tr>
        <tr><td style="padding:8px;background:#f7f1df;font-weight:bold">Total</td><td style="padding:8px">CRC ${recibo.monto}</td></tr>
      </table>
      <p style="font-size:13px;color:#6b6254;margin:0">El espacio quedo liberado despues del pago.</p>
    </div>
    <div style="padding:14px 28px;background:#13100e;color:#aa9d84;text-align:center;font-size:12px">
      Mensaje automatico. No respondas a este correo.
    </div>
  </div>
</body></html>`;
}

async function sendPaymentReceiptEmail({ to, reserva, recibo }) {
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    throw new Error('Correo invalido');
  }
  await makeMailTransport().sendMail({
    from: MAIL_FROM,
    to,
    subject: `Recibo de parqueo ${reserva.espacioId} - Club Sport Herediano`,
    html: paymentReceiptEmailHtml({ reserva, recibo }),
  });
}

async function handleParqueoPublico(req, res, urlPath, requestUrl) {
  const sub = urlPath.slice(PARQUEO_API_PUBLICA.length) || '/';
  const data = loadParqueo();
  const activa = (r) => r.estado === 'reservado' || r.estado === 'ocupado';
  const fail = (status, error) => sendJson(res, status, { ok: false, error });

  if (req.method === 'GET' && sub === '/estado') {
    return sendJson(res, 200, {
      ok: true,
      tarifa: TARIFA_HORA,
      espacios: data.espacios.map((e) => ({
        id: e.id,
        piso: e.piso,
        zona: e.zona,
        num: e.num,
        estado: e.estado,
        reserva: (() => {
          const r = e.reservaId ? data.reservas.find((reserva) => reserva.id === e.reservaId && activa(reserva)) : null;
          return r ? { inicio: r.inicio, fin: r.fin } : null;
        })(),
      })),
    });
  }

  if (req.method === 'GET' && sub === '/wallet') {
    return fail(410, 'Apple Wallet no esta disponible desde la consulta publica');
  }

  let body = {};
  if (req.method === 'POST') {
    try { body = JSON.parse((await readBody(req)) || '{}'); }
    catch (_) { return fail(400, 'JSON invalido'); }
  }

  const buscarPorPlaca = () => {
    const placa = String(body.placa || '').trim().toUpperCase();
    if (!placa || placa.length > 12) return { error: 'Ingresa una placa valida' };
    const reserva = data.reservas.find((r) => activa(r) && r.placa === placa);
    if (!reserva) return { error: 'No hay parqueo activo para esa placa' };
    return { reserva };
  };

  if (req.method === 'POST' && sub === '/ocupar') {
    const espacio = data.espacios.find((e) => e.id === body.espacioId);
    if (!espacio) return fail(404, 'El espacio no existe');
    if (espacio.estado !== 'disponible') return fail(409, 'El espacio no esta disponible');
    const placa = String(body.placa || '').trim().toUpperCase();
    if (!placa || placa.length > 12) return fail(400, 'Placa invalida');
    const duracion = Number(body.duracion);
    if (!Number.isFinite(duracion) || duracion < 15 || duracion > 1440) {
      return fail(400, 'Duracion invalida (15-1440 minutos)');
    }
    if (data.reservas.some((r) => activa(r) && r.placa === placa)) {
      return fail(409, 'Esa placa ya tiene un espacio activo');
    }
    const id = nextId('R', data.reservas);
    const inicio = new Date();
    const reserva = {
      id,
      espacioId: espacio.id,
      userId: null,
      userName: 'Invitado',
      placa,
      rol: 'invitado',
      estado: 'ocupado',
      inicio: inicio.toISOString(),
      fin: new Date(inicio.getTime() + duracion * 60000).toISOString(),
      codigo: `CSH-R-${id.slice(2).padStart(4, '0')}`,
      qrData: '',
    };
    reserva.qrData = `${reserva.codigo}|${espacio.id}|${placa}|${reserva.fin}`;
    const email = String(body.email || '').trim().toLowerCase();
    if (email) {
      if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return fail(400, 'Correo invalido');
      }
      reserva.emailQr = email;
    }
    data.reservas.push(reserva);
    espacio.estado = 'ocupado';
    espacio.reservaId = id;
    logEvento(data, 'entrada', {
      espacioId: espacio.id,
      user: { id: null, name: 'Invitado' },
      placa,
      notas: email ? `Walk-in, estimado ${duracion} min, QR a ${email}` : `Walk-in, estimado ${duracion} min`,
    });
    saveParqueo(data);
    let emailSent = false;
    let emailError = '';
    if (email) {
      try {
        await sendParkingQrEmail({ to: email, reserva });
        emailSent = true;
      } catch (err) {
        emailError = err.message || 'No se pudo enviar el correo';
        console.error(`[mail] Error enviando QR a ${email}: ${emailError}`);
      }
    }
    return sendJson(res, 200, {
      ok: true,
      sesion: {
        reservaId: reserva.id,
        espacioId: espacio.id,
        placa,
        inicio: reserva.inicio,
        fin: reserva.fin,
        codigo: reserva.codigo,
        qrData: reserva.qrData,
        correo: email ? maskedReservaEmail(reserva) : '',
        emailSent,
        emailError,
      },
    });
  }

  if (req.method === 'POST' && sub === '/consulta') {
    const { reserva, error } = buscarPorPlaca();
    if (error) return fail(404, error);
    const { horas, monto } = montoDe(reserva);
    return sendJson(res, 200, {
      ok: true,
      info: {
        espacioId: reserva.espacioId, placa: reserva.placa, estado: reserva.estado,
        inicio: reserva.inicio, fin: reserva.fin,
        correo: maskedReservaEmail(reserva),
        horas,
        monto,
        tarifa: TARIFA_HORA,
      },
    });
  }

  if (req.method === 'POST' && sub === '/reenviar') {
    const { reserva, error } = buscarPorPlaca();
    if (error) return fail(404, error);
    const correo = maskedReservaEmail(reserva);
    if (correo === 'Sin correo asociado') {
      return fail(409, 'La reserva no tiene correo asociado');
    }
    try {
      await sendParkingQrEmail({ to: reservaEmail(reserva), reserva });
    } catch (err) {
      console.error(`[mail] Error reenviando QR a ${correo}: ${err.message}`);
      return fail(502, 'No se pudo enviar el correo en este momento');
    }
    logEvento(data, 'envio', {
      espacioId: reserva.espacioId,
      user: { id: null, name: 'Consulta publica' },
      placa: reserva.placa,
      notas: `Reenvio solicitado a ${correo}`,
    });
    saveParqueo(data);
    return sendJson(res, 200, { ok: true, correo });
  }

  if (req.method === 'POST' && sub === '/pagar') {
    const { reserva, error } = buscarPorPlaca();
    if (error) return fail(404, error);
    const email = reservaEmail(reserva);
    if (!email) return fail(409, 'La reserva no tiene correo asociado para enviar el recibo');
    const pago = body.pago || {};
    const cardNumber = String(pago.cardNumber || '').replace(/\D/g, '');
    const exp = String(pago.exp || '').trim();
    const cvv = String(pago.cvv || '').replace(/\D/g, '');
    const name = String(pago.name || '').trim();
    if (name.length < 3) return fail(400, 'Ingresa el nombre del tarjetahabiente');
    if (cardNumber.length < 13 || cardNumber.length > 19) return fail(400, 'Numero de tarjeta invalido');
    if (!/^\d{2}\/\d{2}$/.test(exp)) return fail(400, 'Fecha de expiracion invalida');
    if (cvv.length < 3 || cvv.length > 4) return fail(400, 'CVV invalido');
    if (cardNumber.endsWith('0000')) return fail(402, 'La transaccion fue rechazada por el emisor');
    const { horas, monto } = montoDe(reserva);
    const recibo = {
      espacioId: reserva.espacioId,
      placa: reserva.placa,
      horas,
      monto,
      transaccion: `CSH-PAY-${Date.now().toString(36).toUpperCase()}`,
      correo: maskedReservaEmail(reserva),
    };
    try {
      await sendPaymentReceiptEmail({ to: email, reserva, recibo });
    } catch (err) {
      console.error(`[mail] Error enviando recibo a ${email}: ${err.message}`);
      return fail(502, 'No se pudo enviar el recibo. No se realizo el cobro');
    }
    reserva.estado = 'finalizada';
    reserva.pago = {
      transaccion: recibo.transaccion,
      monto,
      horas,
      timestamp: new Date().toISOString(),
      metodo: `****${cardNumber.slice(-4)}`,
    };
    const espacio = data.espacios.find((e) => e.id === reserva.espacioId);
    if (espacio) { espacio.estado = 'disponible'; espacio.reservaId = null; }
    logEvento(data, 'pago', {
      espacioId: reserva.espacioId,
      user: { id: null, name: 'Invitado' },
      placa: reserva.placa,
      notas: `CRC ${monto} (${horas}h) - ${recibo.transaccion}`,
    });
    saveParqueo(data);
    return sendJson(res, 200, {
      ok: true,
      recibo,
    });
  }

  return fail(404, 'Ruta no encontrada');
}

// ── Parqueo: API (montada bajo /admin para reusar la cookie de admin) ──────
const PARQUEO_API = '/admin/api/parqueo';

async function handleParqueoApi(req, res, urlPath, requestUrl, user) {
  const sub = urlPath.slice(PARQUEO_API.length) || '/';
  const role = user.parkingRole || 'invitado';
  const isAdmin = role === 'admin';
  const data = loadParqueo();
  const activa = (r) => r.estado === 'reservado' || r.estado === 'ocupado';
  const fail = (status, error) => sendJson(res, status, { ok: false, error });

  if (req.method === 'GET' && sub === '/estado') {
    return sendJson(res, 200, {
      ok: true,
      espacios: data.espacios,
      reservas: data.reservas.filter(activa),
    });
  }

  if (req.method === 'GET' && sub === '/eventos') {
    const limit = Math.min(Math.max(Number(requestUrl.searchParams.get('limit')) || 50, 1), 200);
    const offset = Math.max(Number(requestUrl.searchParams.get('offset')) || 0, 0);
    const piso = requestUrl.searchParams.get('piso');
    const placa = String(requestUrl.searchParams.get('placa') || '').trim().toUpperCase();
    let eventos = data.eventos.slice().reverse();
    if (piso) eventos = eventos.filter((e) => e.espacioId.startsWith(`P${piso}-`));
    if (placa) eventos = eventos.filter((e) => e.placa.toUpperCase().includes(placa));
    return sendJson(res, 200, {
      ok: true,
      total: eventos.length,
      eventos: eventos.slice(offset, offset + limit),
    });
  }

  let body = {};
  if (req.method === 'POST' || req.method === 'DELETE') {
    try { body = JSON.parse((await readBody(req)) || '{}'); }
    catch (_) { return fail(400, 'JSON invalido'); }
  }

  if (req.method === 'POST' && sub === '/reservar') {
    const espacio = data.espacios.find((e) => e.id === body.espacioId);
    if (!espacio) return fail(404, 'El espacio no existe');
    if (espacio.estado !== 'disponible') return fail(409, 'El espacio no esta disponible');
    const placa = String(body.placa || '').trim().toUpperCase();
    if (!placa || placa.length > 12) return fail(400, 'Placa invalida');
    const duracion = Number(body.duracion);
    if (!Number.isFinite(duracion) || duracion < 15 || duracion > 1440) {
      return fail(400, 'Duracion invalida (15-1440 minutos)');
    }
    // El admin reserva en nombre de terceros; el limite aplica a socios/invitados.
    if (!isAdmin && data.reservas.some((r) => activa(r) && r.userId === user.id)) {
      return fail(409, 'Ya tienes una reserva activa');
    }
    const id = nextId('R', data.reservas);
    const codigo = `CSH-R-${id.slice(2).padStart(4, '0')}`;
    const inicio = new Date();
    const fin = new Date(inicio.getTime() + duracion * 60000);
    const reserva = {
      id,
      espacioId: espacio.id,
      userId: user.id,
      userName: user.name,
      placa,
      rol: role,
      estado: 'reservado',
      inicio: inicio.toISOString(),
      fin: fin.toISOString(),
      codigo,
      qrData: `${codigo}|${espacio.id}|${placa}|${fin.toISOString()}`,
    };
    data.reservas.push(reserva);
    espacio.estado = 'reservado';
    espacio.reservaId = id;
    logEvento(data, 'reserva', { espacioId: espacio.id, user, placa, notas: `Duracion ${duracion} min` });
    saveParqueo(data);
    return sendJson(res, 200, { ok: true, reserva });
  }

  if (req.method === 'POST' && sub === '/ocupar') {
    if (!isAdmin) return fail(403, 'Solo administradores pueden marcar entradas');
    const reserva = data.reservas.find((r) => r.id === body.reservaId);
    if (!reserva || !activa(reserva)) return fail(404, 'Reserva no activa');
    if (reserva.estado === 'ocupado') return fail(409, 'El espacio ya esta ocupado');
    reserva.estado = 'ocupado';
    const espacio = data.espacios.find((e) => e.id === reserva.espacioId);
    if (espacio) espacio.estado = 'ocupado';
    logEvento(data, 'entrada', { espacioId: reserva.espacioId, user, placa: reserva.placa });
    saveParqueo(data);
    return sendJson(res, 200, { ok: true, reserva });
  }

  if (req.method === 'POST' && sub === '/liberar') {
    const espacio = data.espacios.find((e) => e.id === body.espacioId);
    if (!espacio) return fail(404, 'El espacio no existe');
    const reserva = data.reservas.find((r) => r.id === espacio.reservaId);
    if (!reserva || !activa(reserva)) return fail(409, 'El espacio no tiene reserva activa');
    const propia = reserva.userId === user.id;
    if (!propia && !isAdmin) return fail(403, 'Sin permiso para liberar este espacio');
    reserva.estado = 'finalizada';
    espacio.estado = 'disponible';
    espacio.reservaId = null;
    logEvento(data, 'salida', {
      espacioId: espacio.id, user, placa: reserva.placa,
      notas: propia ? '' : 'Liberado por admin',
    });
    saveParqueo(data);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'POST' && sub === '/enviar-qr') {
    const reserva = data.reservas.find((r) => r.id === body.reservaId);
    if (!reserva || !activa(reserva)) return fail(404, 'Reserva no activa');
    const propia = reserva.userId === user.id;
    if (!propia && !isAdmin) return fail(403, 'Sin permiso sobre esta reserva');
    const email = String(body.email || '').trim().toLowerCase();
    if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail(400, 'Correo invalido');
    }
    reserva.emailQr = email;
    try {
      await sendParkingQrEmail({ to: email, reserva });
    } catch (err) {
      console.error(`[mail] Error enviando QR a ${email}: ${err.message}`);
      return fail(502, 'No se pudo enviar el correo en este momento');
    }
    logEvento(data, 'envio', {
      espacioId: reserva.espacioId, user, placa: reserva.placa, notas: `QR a ${email}`,
    });
    saveParqueo(data);
    return sendJson(res, 200, { ok: true, email });
  }

  if (req.method === 'POST' && sub === '/extender') {
    const reserva = data.reservas.find((r) => r.id === body.reservaId);
    if (!reserva || !activa(reserva)) return fail(404, 'Reserva no activa');
    const propia = reserva.userId === user.id;
    if (!propia && !isAdmin) return fail(403, 'Sin permiso para extender esta reserva');
    const minutos = Number(body.minutos);
    if (!Number.isFinite(minutos) || minutos < 5 || minutos > 720) {
      return fail(400, 'Minutos invalidos (5-720)');
    }
    // Si esta vencida, la extension cuenta a partir de ahora.
    const base = Math.max(new Date(reserva.fin).getTime(), Date.now());
    reserva.fin = new Date(base + minutos * 60000).toISOString();
    reserva.qrData = `${reserva.codigo}|${reserva.espacioId}|${reserva.placa}|${reserva.fin}`;
    logEvento(data, 'extension', {
      espacioId: reserva.espacioId, user, placa: reserva.placa, notas: `+${minutos} min`,
    });
    saveParqueo(data);
    return sendJson(res, 200, { ok: true, reserva });
  }

  if (req.method === 'DELETE' && sub.startsWith('/reserva/')) {
    const id = decodeURIComponent(sub.slice('/reserva/'.length));
    const reserva = data.reservas.find((r) => r.id === id);
    if (!reserva || !activa(reserva)) return fail(404, 'Reserva no activa');
    const propia = reserva.userId === user.id;
    if (!propia && !isAdmin) return fail(403, 'Sin permiso para cancelar esta reserva');
    reserva.estado = 'cancelada';
    const espacio = data.espacios.find((e) => e.id === reserva.espacioId);
    if (espacio) { espacio.estado = 'disponible'; espacio.reservaId = null; }
    logEvento(data, 'cancelacion', {
      espacioId: reserva.espacioId, user, placa: reserva.placa,
      notas: propia ? '' : 'Cancelada por admin',
    });
    saveParqueo(data);
    return sendJson(res, 200, { ok: true });
  }

  return fail(404, 'Ruta no encontrada');
}

const ADMIN_USERS_API = '/admin/api/users';

async function handleAdminUsersApi(req, res, urlPath, user) {
  const sub = urlPath.slice(ADMIN_USERS_API.length) || '/';
  const fail = (status, error) => sendJson(res, status, { ok: false, error });
  if (user.parkingRole !== 'admin') return fail(403, 'Solo administradores pueden cambiar contrasenas');

  if (req.method === 'POST' && sub === '/password') {
    let body = {};
    try { body = JSON.parse((await readBody(req)) || '{}'); }
    catch (_) { return fail(400, 'JSON invalido'); }
    const target = ADMIN_USERS.find((u) => u.id === body.userId);
    if (!target) return fail(404, 'Usuario no encontrado');
    const password = String(body.password || '');
    if (password.length < 8 || password.length > 80) {
      return fail(400, 'La contrasena debe tener entre 8 y 80 caracteres');
    }
    setAdminUserPassword(target.id, password);
    return sendJson(res, 200, {
      ok: true,
      user: { id: target.id, name: target.name, email: target.email },
    });
  }

  return fail(404, 'Ruta no encontrada');
}

// ── Página de login (sin dependencias externas, sin emojis) ─────────────────
function loginPage({ error, next = '/' } = {}) {
  const action = `/__login?next=${encodeURIComponent(safeNext(next))}`;
  const errorHtml = error ? `<div class="err">${escapeHtml(error)}</div>` : '';
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Acceso — Club Sport Herediano</title>
<style>
  :root { --rojo:#b91c1c; --rojo-osc:#7f1212; --oro:#f5c518; }
  * { box-sizing:border-box; }
  body { margin:0; min-height:100vh; display:flex; align-items:center;
    justify-content:center; font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
    background:linear-gradient(135deg,var(--rojo-osc),var(--rojo)); color:#1f2937; }
  .card { width:100%; max-width:380px; background:#fff; border-radius:16px;
    box-shadow:0 20px 50px rgba(0,0,0,.35); padding:32px 28px;
    border-top:6px solid var(--oro); }
  .brand { text-align:center; margin-bottom:22px; }
  .brand .esc { width:70px; height:auto; margin:0 auto 10px; display:block;
    filter:drop-shadow(0 10px 18px rgba(0,0,0,.25)); }
  .brand h1 { font-size:18px; margin:0; color:var(--rojo-osc); }
  .brand p { font-size:12px; color:#6b7280; margin:4px 0 0; }
  label { display:block; font-size:13px; font-weight:600; margin:14px 0 6px; }
  input { width:100%; padding:11px 12px; border:1px solid #d1d5db; border-radius:9px;
    font-size:15px; outline:none; }
  input:focus { border-color:var(--rojo); box-shadow:0 0 0 3px rgba(185,28,28,.15); }
  button { width:100%; margin-top:22px; padding:12px; border:0; border-radius:9px;
    background:var(--rojo); color:#fff; font-size:15px; font-weight:700; cursor:pointer; }
  button:hover { background:var(--rojo-osc); }
  .err { margin-top:16px; background:#fee2e2; color:#991b1b; font-size:13px;
    padding:10px 12px; border-radius:9px; text-align:center; }
  .pie { text-align:center; font-size:11px; color:#9ca3af; margin-top:20px; }
</style>
</head>
<body>
  <form class="card" method="POST" action="${action}">
    <div class="brand">
      <img class="esc" src="${ADMIN_LOGO_PATH}" alt="Escudo Club Sport Herediano">
      <h1>Club Sport Herediano</h1>
      <p>Acceso restringido</p>
    </div>
    <label for="u">Usuario</label>
    <input id="u" name="usuario" autocomplete="username" autofocus required>
    <label for="p">Contrase&ntilde;a</label>
    <input id="p" name="clave" type="password" autocomplete="current-password" required>
    ${errorHtml}
    <button type="submit">Ingresar</button>
    <div class="pie">Sitio privado &middot; milocalhost</div>
  </form>
</body>
</html>`;
}

function adminLoginPage({ error, next = '/admin' } = {}) {
  const action = `/admin/sign-in?next=${encodeURIComponent(safeAdminNext(next))}`;
  const errorHtml = error ? `<div class="admin-error">${escapeHtml(error)}</div>` : '';
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sign in administrativo | Club Sport Herediano</title>
<style>
  :root {
    --bg:#0a0908; --surface:#15120f; --surface-2:#1e1713; --paper:#f7f1df;
    --muted:#b7aa8e; --gold:#c9a961; --red:#d62828; --red-dark:#8f1414;
    --line:rgba(247,241,223,.13);
  }
  * { box-sizing:border-box; }
  body {
    margin:0; min-height:100vh; display:grid; place-items:center; color:var(--paper);
    font-family:Manrope, Inter, system-ui, -apple-system, Segoe UI, sans-serif;
    background:
      linear-gradient(110deg, rgba(10,9,8,.92), rgba(10,9,8,.62)),
      radial-gradient(circle at 82% 12%, rgba(214,40,40,.28), transparent 32%),
      linear-gradient(135deg, var(--red-dark), #0a0908 46%, #050403);
  }
  .login-wrap {
    width:min(920px, calc(100vw - 32px)); min-height:560px; display:grid;
    grid-template-columns:1.05fr .95fr; border:1px solid var(--line);
    background:rgba(15,13,11,.76); box-shadow:0 30px 90px rgba(0,0,0,.45);
  }
  .brand-panel { padding:48px; display:flex; flex-direction:column; justify-content:space-between; }
  .mark { width:82px; height:auto; display:block; object-fit:contain; filter:drop-shadow(0 12px 22px rgba(0,0,0,.45)); }
  .brand-panel h1 { margin:28px 0 12px; font-size:clamp(36px, 6vw, 64px); line-height:.9;
    text-transform:uppercase; letter-spacing:0; font-family:Impact, Haettenschweiler, sans-serif; }
  .brand-panel p { max-width:420px; color:var(--muted); line-height:1.55; margin:0; }
  form { background:rgba(10,9,8,.55); border-left:1px solid var(--line); padding:56px 42px;
    display:flex; flex-direction:column; justify-content:center; }
  form h2 { margin:0 0 8px; font-size:22px; }
  form p { margin:0 0 28px; color:var(--muted); font-size:14px; line-height:1.5; }
  label { display:block; font-size:12px; color:var(--gold); letter-spacing:.14em;
    text-transform:uppercase; margin:18px 0 8px; }
  input { width:100%; min-height:48px; border:1px solid var(--line); border-radius:4px;
    background:#100d0b; color:var(--paper); padding:0 14px; font-size:15px; outline:none; }
  input:focus { border-color:var(--gold); box-shadow:0 0 0 3px rgba(201,169,97,.14); }
  button { width:100%; margin-top:24px; min-height:48px; border:0; border-radius:4px;
    background:var(--red); color:white; font-weight:800; letter-spacing:.08em;
    text-transform:uppercase; cursor:pointer; transition:transform .16s ease, background .16s ease; }
  button:hover { background:#b91d1d; transform:translateY(-1px); }
  .admin-error { margin-top:16px; border:1px solid rgba(214,40,40,.45); color:#ffd0d0;
    background:rgba(214,40,40,.12); padding:11px 12px; border-radius:4px; font-size:13px; }
  .links { margin-top:22px; display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; }
  .links a { color:var(--muted); text-decoration:none; font-size:13px; }
  .links a:hover { color:var(--paper); }
  @media (max-width:760px) {
    .login-wrap { grid-template-columns:1fr; min-height:auto; }
    .brand-panel { padding:32px 28px 18px; }
    form { border-left:0; border-top:1px solid var(--line); padding:30px 28px 34px; }
  }
</style>
</head>
<body>
  <section class="login-wrap" aria-label="Acceso administrativo">
    <div class="brand-panel">
      <div>
        <img class="mark" src="${ADMIN_LOGO_PATH}" alt="Escudo Club Sport Herediano">
        <h1>Club Sport Herediano</h1>
        <p>Acceso interno para operar la administracion digital del club.</p>
      </div>
    </div>
    <form method="POST" action="${action}">
      <h2>Sign in</h2>
      <p>Ingresa con una cuenta administrativa para abrir el panel simulado.</p>
      <label for="admin-user">Usuario o correo</label>
      <input id="admin-user" name="usuario" autocomplete="username" autofocus required>
      <label for="admin-pass">Contrasena</label>
      <input id="admin-pass" name="clave" type="password" autocomplete="current-password" required>
      ${errorHtml}
      <button type="submit">Entrar</button>
      <div class="links">
        <a href="/">Volver al sitio</a>
        <a href="/__logout">Cerrar acceso provisional</a>
      </div>
    </form>
  </section>
</body>
</html>`;
}

function adminIcon(name, className = 'module-icon') {
  const paths = {
    overview: '<rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect>',
    web: '<rect x="3" y="4" width="18" height="13" rx="2"></rect><path d="M8 21h8"></path><path d="M12 17v4"></path><path d="M3 9h18"></path>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"></path><circle cx="9.5" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
    sponsors: '<rect x="3" y="7" width="18" height="13" rx="2"></rect><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><path d="M3 12h18"></path><path d="M12 12v2"></path>',
    parking: '<rect x="5" y="3" width="14" height="18" rx="2"></rect><path d="M10 17V7h4a3 3 0 0 1 0 6h-4"></path>',
    coupons: '<path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7z"></path><path d="M9 9h.01"></path><path d="M15 15h.01"></path><path d="M16 8l-8 8"></path>',
    restaurants: '<path d="M7 2v8"></path><path d="M4 2v8"></path><path d="M10 2v8"></path><path d="M4 10h6"></path><path d="M7 10v12"></path><path d="M17 2v20"></path><path d="M17 2a4 4 0 0 1 4 4v5h-4"></path>',
  };
  return `<span class="${className}" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      ${paths[name] || paths.overview}
    </svg>
  </span>`;
}

function adminNav(activePath) {
  const links = ADMIN_MODULES.map((mod) => {
    const active = activePath === mod.path ? ' active' : '';
    return `<a class="nav-link${active}" href="${mod.path}">
      <span class="nav-main">${adminIcon(mod.icon, 'nav-icon')}<span>${escapeHtml(mod.label)}</span></span>
      <small>${escapeHtml(mod.eyebrow)}</small>
    </a>`;
  }).join('');
  const homeActive = activePath === '/admin' || activePath === '/admin/' ? ' active' : '';
  return `<nav>
    <a class="nav-link${homeActive}" href="/admin">
      <span class="nav-main">${adminIcon('overview', 'nav-icon')}<span>Resumen</span></span>
      <small>Centro de mando</small>
    </a>
    ${links}
  </nav>`;
}

function adminUsersTable() {
  const rows = ADMIN_USERS.map((user) => `<tr>
    <td>${escapeHtml(user.name)}</td>
    <td>${escapeHtml(user.email)}</td>
    <td>${escapeHtml(user.role)}</td>
    <td>${escapeHtml(user.area)}</td>
    <td><span class="state">${escapeHtml(user.status)}</span></td>
    <td><button class="user-pass-btn" type="button" data-user-id="${escapeHtml(user.id)}" data-user-name="${escapeHtml(user.name)}">Cambiar clave</button></td>
  </tr>`).join('');
  return `<div class="table-wrap">
    <style>
      .user-pass-btn { min-height:32px; border-radius:4px; border:1px solid var(--line); background:transparent;
        color:var(--paper); font:inherit; font-size:12px; padding:0 10px; cursor:pointer; }
      .user-pass-btn:hover { border-color:var(--gold); color:var(--gold); }
      #user-pass-back { position:fixed; inset:0; z-index:90; display:none; place-items:center;
        background:rgba(5,4,3,.72); padding:18px; }
      #user-pass-back.open { display:grid; }
      .user-pass-modal { width:min(420px, 100%); border:1px solid rgba(201,169,97,.4); border-radius:6px;
        background:var(--surface-2); padding:22px; }
      .user-pass-head { display:flex; justify-content:space-between; gap:12px; align-items:center; }
      .user-pass-head h3 { margin:0; font-family:Impact, Haettenschweiler, sans-serif; font-size:26px; text-transform:uppercase; }
      .user-pass-x { border:0; background:transparent; color:var(--muted); font-size:24px; cursor:pointer; line-height:1; }
      .user-pass-modal label { display:block; margin:16px 0 6px; color:var(--gold); font-size:11px; letter-spacing:.14em; text-transform:uppercase; }
      .user-pass-modal input { width:100%; min-height:42px; border:1px solid var(--line); border-radius:4px;
        background:#100d0b; color:var(--paper); padding:0 12px; font:inherit; outline:none; }
      .user-pass-modal input:focus { border-color:var(--gold); }
      .user-pass-actions { display:flex; gap:10px; flex-wrap:wrap; margin-top:18px; }
      .user-pass-save { min-height:38px; border-radius:4px; border:1px solid var(--red); background:var(--red);
        color:#fff; font-weight:700; padding:0 14px; cursor:pointer; }
      .user-pass-cancel { min-height:38px; border-radius:4px; border:1px solid var(--line); background:transparent;
        color:var(--paper); padding:0 14px; cursor:pointer; }
      #user-pass-msg { display:none; margin-top:12px; font-size:13px; }
      #user-pass-msg.ok { color:#7ee2a0; }
      #user-pass-msg.err { color:#ffd0d0; }
    </style>
    <table>
      <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Area</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div id="user-pass-back">
      <div class="user-pass-modal">
        <div class="user-pass-head">
          <h3>Cambiar clave</h3>
          <button class="user-pass-x" type="button" data-user-pass-close aria-label="Cerrar">&times;</button>
        </div>
        <p id="user-pass-name" style="color:var(--muted);margin:6px 0 0"></p>
        <label for="user-pass-new">Nueva contrasena</label>
        <input id="user-pass-new" type="password" autocomplete="new-password" minlength="8" maxlength="80">
        <label for="user-pass-confirm">Confirmar contrasena</label>
        <input id="user-pass-confirm" type="password" autocomplete="new-password" minlength="8" maxlength="80">
        <div class="user-pass-actions">
          <button class="user-pass-save" type="button" id="user-pass-save">Guardar</button>
          <button class="user-pass-cancel" type="button" data-user-pass-close>Cancelar</button>
        </div>
        <div id="user-pass-msg"></div>
      </div>
    </div>
    <script>
    (function () {
      var selected = null;
      var back = document.getElementById('user-pass-back');
      var nameEl = document.getElementById('user-pass-name');
      var pass = document.getElementById('user-pass-new');
      var confirm = document.getElementById('user-pass-confirm');
      var msg = document.getElementById('user-pass-msg');
      function showMsg(text, ok) {
        msg.textContent = text;
        msg.className = ok ? 'ok' : 'err';
        msg.style.display = 'block';
      }
      function close() {
        back.classList.remove('open');
        selected = null;
        pass.value = '';
        confirm.value = '';
        msg.style.display = 'none';
      }
      document.addEventListener('click', function (ev) {
        var btn = ev.target.closest('.user-pass-btn');
        if (btn) {
          selected = btn.getAttribute('data-user-id');
          nameEl.textContent = btn.getAttribute('data-user-name') || '';
          pass.value = '';
          confirm.value = '';
          msg.style.display = 'none';
          back.classList.add('open');
          pass.focus();
          return;
        }
        if (ev.target === back || ev.target.closest('[data-user-pass-close]')) close();
      });
      document.getElementById('user-pass-save').addEventListener('click', function () {
        if (!selected) return;
        if (pass.value.length < 8) { showMsg('La contrasena debe tener al menos 8 caracteres.', false); return; }
        if (pass.value !== confirm.value) { showMsg('Las contrasenas no coinciden.', false); return; }
        fetch('/admin/api/users/password', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ userId: selected, password: pass.value }),
        }).then(function (r) { return r.json(); })
          .then(function (j) {
            if (!j.ok) { showMsg(j.error || 'No se pudo cambiar la clave.', false); return; }
            showMsg('Clave actualizada para ' + j.user.name + '.', true);
            pass.value = '';
            confirm.value = '';
          })
          .catch(function () { showMsg('Error de red.', false); });
      });
    })();
    </script>
  </div>`;
}

function adminOverview() {
  const modules = ADMIN_MODULES.map((mod) => `<a class="module" href="${mod.path}">
    <span class="module-top">
      ${adminIcon(mod.icon)}
      <span class="module-eyebrow">${escapeHtml(mod.eyebrow)}</span>
    </span>
    <span class="module-body">
      <strong>${escapeHtml(mod.label)}</strong>
      <em>Bajo construccion</em>
    </span>
  </a>`).join('');
  return `<section class="workspace">
    <div class="page-head">
      <div>
        <p>Administracion</p>
        <h1>Centro administrativo</h1>
      </div>
      <span class="build">Bajo construccion</span>
    </div>
    <div class="notice">
      Este panel es una maqueta funcional para validar navegacion, acceso y estructura de modulos.
    </div>
    <div class="module-grid">${modules}</div>
  </section>`;
}

function parqueoPublicoHtml() {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Parqueo | Club Sport Herediano</title>
<style>
  :root { --bg:#0a0908; --surface:#13100e; --surface-2:#1c1713; --paper:#f7f1df;
    --muted:#aa9d84; --gold:#c9a961; --red:#d62828; --line:rgba(247,241,223,.12);
    --verde:#16a34a; --naranja:#ea580c; --rojo:#d62828; }
  * { box-sizing:border-box; }
  body { margin:0; min-height:100vh; background:var(--bg); color:var(--paper);
    font-family:Inter, Manrope, system-ui, -apple-system, Segoe UI, sans-serif; }
  header { height:72px; border-bottom:1px solid var(--line); display:flex; align-items:center;
    justify-content:space-between; gap:16px; padding:0 28px; background:rgba(10,9,8,.9);
    position:sticky; top:0; z-index:5; }
  .brand { display:flex; align-items:center; gap:12px; color:var(--paper); text-decoration:none; }
  .brand img { width:38px; height:42px; object-fit:contain; }
  .brand strong { font-size:13px; letter-spacing:.16em; text-transform:uppercase; }
  .links a { color:var(--muted); text-decoration:none; font-size:13px; margin-left:18px; }
  .links a:hover { color:var(--paper); }
  main { max-width:1280px; margin:0 auto; padding:34px 28px 60px; }
  h1 { margin:0 0 8px; font-family:Impact, Haettenschweiler, sans-serif; text-transform:uppercase;
    font-size:clamp(34px, 5vw, 58px); line-height:.92; }
  .sub { color:var(--muted); margin:0 0 22px; max-width:640px; line-height:1.55; }
  .aviso { border-left:3px solid var(--gold); background:rgba(247,241,223,.05); color:var(--muted);
    padding:12px 16px; margin-bottom:28px; max-width:640px; line-height:1.5; font-size:14px; }
  .aviso a { color:var(--gold); }
  .pago-card { border:1px solid rgba(201,169,97,.4); border-radius:6px; background:var(--surface);
    padding:22px; max-width:1040px; margin-bottom:36px; display:grid; grid-template-columns:minmax(280px, 1fr) minmax(360px, 1.15fr);
    gap:22px; align-items:start; }
  .pq-search-form { min-width:0; }
  .pago-card h2 { margin:0 0 4px; font-family:Impact, Haettenschweiler, sans-serif; font-size:24px; text-transform:uppercase; }
  .pago-card p { margin:0; color:var(--muted); font-size:13px; line-height:1.5; }
  label { display:block; font-size:11px; color:var(--gold); letter-spacing:.14em; text-transform:uppercase; margin:16px 0 6px; }
  input, select { width:100%; min-height:44px; border:1px solid var(--line); border-radius:4px;
    background:#100d0b; color:var(--paper); padding:0 12px; font-size:15px; outline:none; font-family:inherit; }
  input:focus, select:focus { border-color:var(--gold); }
  .btn { min-height:42px; border-radius:4px; border:1px solid var(--red); background:var(--red);
    color:#fff; font-size:13px; font-weight:700; padding:0 16px; cursor:pointer; font-family:inherit; margin-top:16px; }
  .btn:hover { background:#b91d1d; }
  .btn.ghost { background:transparent; border-color:var(--line); color:var(--paper); font-weight:500; }
  .btn.ghost:hover { background:var(--surface-2); }
  .err { display:none; margin-top:14px; border:1px solid rgba(214,40,40,.5); background:rgba(214,40,40,.12);
    color:#ffd0d0; padding:10px 12px; border-radius:4px; font-size:13px; }
  #pq-detalle { display:none; margin-top:18px; border-top:1px solid var(--line); padding-top:14px; font-size:14px; }
  #pq-detalle div { display:flex; justify-content:space-between; gap:12px; margin-bottom:6px; }
  #pq-detalle span { color:var(--muted); }
  #pq-detalle .monto { font-size:24px; color:var(--gold); font-weight:800; }
  #pq-recibo { display:none; min-height:100%; border:1px dashed rgba(201,169,97,.5); border-radius:4px;
    padding:16px; text-align:center; line-height:1.6; }
  #pq-recibo strong { color:#7ee2a0; }
  .pq-reserva-grid { margin-top:14px; display:grid; grid-template-columns:1fr 1fr; gap:8px 14px; text-align:left; }
  .pq-reserva-grid div { border-bottom:1px solid var(--line); padding-bottom:6px; }
  .pq-reserva-grid span { display:block; color:var(--muted); font-size:11px; text-transform:uppercase; letter-spacing:.12em; }
  .pq-security-note { margin:14px 0 0; color:var(--muted); font-size:12px; line-height:1.45; }
  .pq-ok-msg { display:none; margin-top:12px; color:#7ee2a0; font-size:13px; }
  .pq-total { margin:14px 0 0; padding:12px; border:1px solid rgba(201,169,97,.35); border-radius:4px;
    display:flex; justify-content:space-between; gap:14px; color:var(--muted); }
  .pq-total strong { color:var(--gold); font-size:20px; }
  #pq-pay-back { position:fixed; inset:0; z-index:70; display:none; place-items:center; background:rgba(5,4,3,.72); padding:18px; }
  #pq-pay-back.open { display:grid; }
  .pq-pay-modal { width:min(460px, 100%); background:var(--surface-2); border:1px solid rgba(201,169,97,.45);
    border-radius:6px; padding:22px; max-height:calc(100vh - 36px); overflow:auto; }
  .pq-pay-head { display:flex; align-items:center; justify-content:space-between; gap:12px; }
  .pq-pay-head h3 { margin:0; font-family:Impact, Haettenschweiler, sans-serif; font-size:28px; text-transform:uppercase; }
  .pq-pay-x { border:0; background:transparent; color:var(--muted); font-size:24px; cursor:pointer; line-height:1; }
  .pq-pay-summary { margin:14px 0; border:1px solid var(--line); border-radius:4px; padding:12px; color:var(--muted); font-size:13px; }
  .pq-pay-summary strong { color:var(--paper); }
  .pq-pay-row { display:grid; grid-template-columns:1fr 120px; gap:10px; }
  #pq-pay-msg { display:none; margin-top:12px; border-radius:4px; padding:10px 12px; font-size:13px; }
  #pq-pay-msg.ok { display:block; color:#7ee2a0; border:1px solid rgba(22,163,74,.45); background:rgba(22,163,74,.12); }
  #pq-pay-msg.err { display:block; color:#ffd0d0; border:1px solid rgba(214,40,40,.5); background:rgba(214,40,40,.12); }
  .pq-toolbar { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:18px; }
  .pq-tabs { display:flex; gap:8px; }
  .pq-tab { min-height:38px; padding:0 18px; border-radius:4px; border:1px solid var(--line);
    background:var(--surface); color:var(--muted); font-size:13px; font-weight:700; cursor:pointer; font-family:inherit; }
  .pq-tab.active { border-color:var(--gold); color:var(--paper); background:rgba(201,169,97,.12); }
  .pq-leyenda { display:flex; gap:16px; color:var(--muted); font-size:12px; flex-wrap:wrap; align-items:center; }
  .pq-leyenda span { display:inline-flex; align-items:center; gap:6px; }
  .pq-leyenda i { width:12px; height:12px; border-radius:3px; display:inline-block; }
  .pq-piso { display:grid; grid-template-columns:1fr 84px 1fr; gap:16px; }
  .pq-zona { border:1px solid var(--line); border-radius:6px; background:var(--surface); padding:14px; min-width:0; }
  .pq-zona h3 { margin:0 0 12px; font-size:12px; letter-spacing:.16em; text-transform:uppercase; color:var(--gold); }
  .pq-grid { display:grid; grid-template-columns:repeat(10, 1fr); gap:4px; }
  .espacio { position:relative; overflow:hidden; aspect-ratio:1; border-radius:3px; display:grid; place-items:center;
    font-size:10px; font-weight:600; color:rgba(255,255,255,.92); user-select:none; }
  .espacio .pq-num { position:relative; z-index:1; }
  .espacio.disponible { background:rgba(22,163,74,.72); cursor:pointer; }
  .espacio.disponible:hover { background:var(--verde); outline:2px solid var(--gold); }
  .espacio.reservado { background:rgba(234,88,12,.85); }
  .espacio.ocupado { background:rgba(214,40,40,.88); }
  .pq-exp { position:absolute; left:3px; right:3px; bottom:3px; height:4px; border-radius:999px;
    background:rgba(5,4,3,.45); overflow:hidden; }
  .pq-exp i { display:block; width:100%; height:100%; background:#7ee2a0; border-radius:999px;
    transition:width 1s linear, background .25s ease; }
  .pq-exp i.medio { background:#facc15; }
  .pq-exp i.bajo { background:#fff; }
  .pq-exp i.vencido { background:#111; width:100%; }
  .pq-overdue { position:absolute; top:3px; right:3px; z-index:2; background:rgba(5,4,3,.68);
    color:#fff; font-size:8px; line-height:1; padding:2px 3px; border-radius:3px; }
  .pq-calle { border:1px dashed rgba(201,169,97,.4); border-radius:6px; display:flex; flex-direction:column;
    align-items:center; justify-content:center; gap:18px; color:var(--muted); font-size:11px; letter-spacing:.18em; }
  .pq-calle-label { writing-mode:vertical-rl; text-orientation:upright; letter-spacing:.4em; }
  #pq-form-back { position:fixed; inset:0; z-index:60; display:none; place-items:center;
    background:rgba(5,4,3,.72); padding:18px; }
  #pq-form-back.open { display:grid; }
  .pq-form-card { width:min(420px, 100%); background:var(--surface-2); border:1px solid rgba(201,169,97,.4);
    border-radius:6px; padding:22px; max-height:calc(100vh - 36px); overflow:auto; }
  .pq-form-head { display:flex; align-items:center; justify-content:space-between; gap:12px; }
  .pq-form-head h3 { margin:0; font-family:Impact, Haettenschweiler, sans-serif; font-size:26px; text-transform:uppercase; }
  .pq-x { border:0; background:transparent; color:var(--muted); font-size:24px; cursor:pointer; line-height:1; }
  .pq-x:hover { color:var(--paper); }
  .pq-form-sub { margin:6px 0 0; color:var(--muted); font-size:13px; }
  .pq-form-actions { display:flex; gap:10px; flex-wrap:wrap; }
  .pq-ok { margin-top:14px; border:1px dashed rgba(201,169,97,.5); border-radius:4px; padding:14px; line-height:1.6; }
  .pq-ok strong { color:#7ee2a0; }
  #pq-form-qr { width:164px; margin:14px auto 8px; background:#fff; padding:8px; border-radius:4px; }
  #pq-form-qr img, #pq-form-qr canvas { display:block; margin:0 auto; }
  .pq-form-code { color:var(--gold); font-size:12px; word-break:break-all; text-align:center; }
  @media (max-width:980px) {
    .pq-piso { grid-template-columns:1fr; }
    .pq-calle { min-height:56px; flex-direction:row; }
    .pq-calle-label { writing-mode:horizontal-tb; text-orientation:mixed; }
  }
  @media (max-width:720px) {
    .pago-card { grid-template-columns:1fr; }
    /* En mobile el formulario reemplaza el contenido principal en vez de modal */
    #pq-form-back { position:static; background:none; padding:0; }
    #pq-form-back.open { display:block; }
    .pq-form-card { width:100%; max-height:none; }
    body.pq-form-open main > :not(#pq-form-back) { display:none; }
  }
</style>
</head>
<body>
  <header>
    <a class="brand" href="/">
      <img src="${ADMIN_LOGO_PATH}" alt="Escudo Club Sport Herediano">
      <strong>Herediano &middot; Parqueo</strong>
    </a>
    <div class="links">
      <a href="/">Volver al sitio</a>
      <a href="/admin/sign-in?next=%2Fadmin%2Fparqueo">Sign in socios</a>
    </div>
  </header>
  <main>
    <h1>Parqueo del estadio</h1>
    <p class="sub">Consulta la disponibilidad de los 400 espacios en tiempo real y busca tu reserva con la placa del vehiculo.</p>
    <div class="aviso">
      Las reservas son exclusivas para socios y personal del club.
      <a href="/admin/sign-in?next=%2Fadmin%2Fparqueo">Inicia sesion</a> si tienes una cuenta.
    </div>
    <div class="pago-card">
      <div class="pq-search-form">
        <h2>Buscar mi Carro</h2>
        <p>Ingresa la placa para confirmar la reserva y ver el correo asociado de forma segura.</p>
        <label for="pq-placa">Placa del vehiculo</label>
        <input id="pq-placa" maxlength="12" placeholder="ABC-123" autocomplete="off">
        <button class="btn" type="button" id="pq-consultar">Buscar mi Carro</button>
        <div class="err" id="pq-err"></div>
        <div id="pq-detalle"></div>
      </div>
      <div id="pq-recibo"></div>
    </div>
    <div class="pq-toolbar">
      <div class="pq-tabs">
        <button class="pq-tab active" type="button" data-piso="1">Piso 1</button>
        <button class="pq-tab" type="button" data-piso="2">Piso 2</button>
      </div>
      <div class="pq-leyenda">
        <span><i style="background:#16a34a"></i> Disponible</span>
        <span><i style="background:#ea580c"></i> Reservado</span>
        <span><i style="background:#d62828"></i> Ocupado</span>
        <span id="pq-stats"></span>
      </div>
    </div>
    <div id="pq-croquis"><p style="color:var(--muted)">Cargando croquis...</p></div>
    <div id="pq-form-back"><div class="pq-form-card" id="pq-form"></div></div>
    <div id="pq-pay-back"><div class="pq-pay-modal" id="pq-pay-modal"></div></div>
  </main>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
  <script>
  (function () {
    var API = '/api/parqueo/publico';
    var TARIFA = ${TARIFA_HORA};
    var ESPACIOS = [];
    var piso = 1;
    var reservaActual = null;

    function $(sel) { return document.querySelector(sel); }
    function esc(v) {
      return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function fmtFecha(iso) {
      var d = new Date(iso);
      return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }
    function money(n) { return '&#8353;' + Number(n || 0).toLocaleString('es-CR'); }
    function api(method, ruta, body) {
      return fetch(API + ruta, {
        method: method,
        headers: { 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      }).then(function (r) { return r.json(); })
        .catch(function () { return { ok: false, error: 'Error de red' }; });
    }

    function renderCroquis() {
      var porZona = { A: [], B: [] };
      for (var i = 0; i < ESPACIOS.length; i++) {
        var e = ESPACIOS[i];
        if (e.piso === piso && porZona[e.zona]) porZona[e.zona].push(e);
      }
      function grid(arr) {
        arr.sort(function (a, b) { return a.num - b.num; });
        var h = '';
        for (var k = 0; k < arr.length; k++) {
          var es = arr[k];
          // Solo los disponibles son seleccionables y muestran informacion;
          // de los ocupados el invitado no ve nada.
          if (es.estado === 'disponible') {
            h += '<div class="espacio disponible" data-id="' + esc(es.id) + '" title="' + esc(es.id) + ' - disponible"><span class="pq-num">' + es.num + '</span></div>';
          } else {
            var exp = es.reserva ? '<span class="pq-overdue"></span><span class="pq-exp" data-inicio="' + esc(es.reserva.inicio) + '" data-fin="' + esc(es.reserva.fin) + '"><i></i></span>' : '';
            h += '<div class="espacio ' + esc(es.estado) + '"><span class="pq-num">' + es.num + '</span>' + exp + '</div>';
          }
        }
        return h;
      }
      $('#pq-croquis').innerHTML =
        '<div class="pq-piso">' +
          '<div class="pq-zona"><h3>Zona A &middot; Piso ' + piso + '</h3><div class="pq-grid">' + grid(porZona.A) + '</div></div>' +
          '<div class="pq-calle"><span>ENTRADA</span><span class="pq-calle-label">CALLE</span></div>' +
          '<div class="pq-zona"><h3>Zona B &middot; Piso ' + piso + '</h3><div class="pq-grid">' + grid(porZona.B) + '</div></div>' +
        '</div>';
      var libres = 0, total = 0;
      for (var t = 0; t < ESPACIOS.length; t++) {
        if (ESPACIOS[t].piso !== piso) continue;
        total++;
        if (ESPACIOS[t].estado === 'disponible') libres++;
      }
      $('#pq-stats').textContent = libres + '/' + total + ' libres en piso ' + piso;
      var tabs = document.querySelectorAll('.pq-tab');
      for (var b = 0; b < tabs.length; b++) {
        tabs[b].classList.toggle('active', Number(tabs[b].getAttribute('data-piso')) === piso);
      }
      tickExpiracion();
    }

    function tickExpiracion() {
      var bars = document.querySelectorAll('.pq-exp');
      for (var i = 0; i < bars.length; i++) {
        var bar = bars[i];
        var fill = bar.querySelector('i');
        var inicio = new Date(bar.getAttribute('data-inicio')).getTime();
        var fin = new Date(bar.getAttribute('data-fin')).getTime();
        var total = Math.max(1, fin - inicio);
        var left = fin - Date.now();
        var pct = Math.max(0, Math.min(1, left / total));
        fill.style.width = (pct * 100) + '%';
        fill.classList.toggle('medio', pct > 0.2 && pct <= 0.5);
        fill.classList.toggle('bajo', pct > 0 && pct <= 0.2);
        fill.classList.toggle('vencido', left <= 0);
        var overdue = bar.parentElement.querySelector('.pq-overdue');
        if (overdue) overdue.textContent = left <= 0 ? 'vencido' : '';
      }
    }

    function refresh() {
      return api('GET', '/estado').then(function (j) {
        if (!j.ok) return;
        ESPACIOS = j.espacios;
        renderCroquis();
      });
    }

    function showErr(msg) {
      var e = $('#pq-err');
      e.style.display = msg ? 'block' : 'none';
      e.textContent = msg || '';
    }

    // Formulario de espacio: modal en desktop, reemplaza el contenido en mobile
    var formBack = $('#pq-form-back');
    var formCard = $('#pq-form');
    function abrirForm(esp) {
      formCard.innerHTML =
        '<div class="pq-form-head"><h3>' + esc(esp.id) + '</h3>' +
          '<button class="pq-x" type="button" data-cerrar aria-label="Cerrar">&times;</button></div>' +
        '<p class="pq-form-sub">Disponible &middot; Piso ' + esp.piso + ' &middot; Zona ' + esc(esp.zona) +
          ' &middot; Tarifa &#8353;' + TARIFA + '/hora</p>' +
        '<label for="pq-f-placa">Placa del vehiculo</label>' +
        '<input id="pq-f-placa" maxlength="12" placeholder="ABC-123" autocomplete="off">' +
        '<label for="pq-f-dur">Tiempo estimado</label>' +
        '<select id="pq-f-dur">' +
          '<option value="30">30 minutos</option>' +
          '<option value="60" selected>1 hora</option>' +
          '<option value="120">2 horas</option>' +
          '<option value="240">4 horas</option>' +
          '<option value="480">8 horas</option>' +
        '</select>' +
        '<label for="pq-f-email">Correo para recibir el QR</label>' +
        '<input id="pq-f-email" type="email" maxlength="120" placeholder="correo@ejemplo.com" autocomplete="email">' +
        '<div class="pq-form-actions">' +
          '<button class="btn" type="button" data-confirmar="' + esc(esp.id) + '">Tomar espacio</button>' +
          '<button class="btn ghost" type="button" data-cerrar>Volver</button>' +
        '</div>' +
        '<div class="err" id="pq-f-err"></div>';
      formBack.classList.add('open');
      document.body.classList.add('pq-form-open');
      $('#pq-f-placa').focus();
    }
    function cerrarForm() {
      formBack.classList.remove('open');
      document.body.classList.remove('pq-form-open');
      formCard.innerHTML = '';
    }
    function ferr(msg) {
      var e = $('#pq-f-err');
      if (e) { e.style.display = 'block'; e.textContent = msg; }
    }
    formBack.addEventListener('click', function (ev) { if (ev.target === formBack) cerrarForm(); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') cerrarForm(); });

    var payBack = $('#pq-pay-back');
    var payModal = $('#pq-pay-modal');
    function showPayMsg(text, ok) {
      var msg = $('#pq-pay-msg');
      msg.className = ok ? 'ok' : 'err';
      msg.textContent = text;
    }
    function cerrarPago() {
      payBack.classList.remove('open');
      payModal.innerHTML = '';
    }
    function abrirPago(info) {
      reservaActual = info;
      payModal.innerHTML =
        '<div class="pq-pay-head"><h3>Pagar parqueo</h3>' +
          '<button class="pq-pay-x" type="button" data-pay-close aria-label="Cerrar">&times;</button></div>' +
        '<div class="pq-pay-summary">' +
          '<div>Espacio <strong>' + esc(info.espacioId) + '</strong> &middot; Placa <strong>' + esc(info.placa) + '</strong></div>' +
          '<div>Tiempo cobrado: <strong>' + info.horas + 'h</strong></div>' +
          '<div>Total: <strong>' + money(info.monto) + '</strong></div>' +
          '<div>Recibo a: <strong>' + esc(info.correo) + '</strong></div>' +
        '</div>' +
        '<label for="pq-pay-name">Nombre en la tarjeta</label>' +
        '<input id="pq-pay-name" autocomplete="cc-name" placeholder="Nombre completo">' +
        '<label for="pq-pay-card">Numero de tarjeta</label>' +
        '<input id="pq-pay-card" inputmode="numeric" autocomplete="cc-number" maxlength="23" placeholder="4111 1111 1111 1111">' +
        '<div class="pq-pay-row">' +
          '<div><label for="pq-pay-exp">Expira</label><input id="pq-pay-exp" autocomplete="cc-exp" maxlength="5" placeholder="MM/AA"></div>' +
          '<div><label for="pq-pay-cvv">CVV</label><input id="pq-pay-cvv" inputmode="numeric" autocomplete="cc-csc" maxlength="4" placeholder="123"></div>' +
        '</div>' +
        '<div class="pq-form-actions">' +
          '<button class="btn" type="button" id="pq-pay-submit">Pagar ' + money(info.monto) + '</button>' +
          '<button class="btn ghost" type="button" data-pay-close>Cancelar</button>' +
        '</div>' +
        '<div id="pq-pay-msg"></div>';
      payBack.classList.add('open');
      $('#pq-pay-name').focus();
    }
    payBack.addEventListener('click', function (ev) { if (ev.target === payBack || ev.target.closest('[data-pay-close]')) cerrarPago(); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') cerrarPago(); });
    document.addEventListener('input', function (ev) {
      if (ev.target && ev.target.id === 'pq-pay-exp') {
        var v = ev.target.value.replace(/\\D/g, '').slice(0, 4);
        ev.target.value = v.length > 2 ? v.slice(0, 2) + '/' + v.slice(2) : v;
      }
    });

    document.addEventListener('click', function (ev) {
      var tab = ev.target.closest('.pq-tab[data-piso]');
      if (tab) { piso = Number(tab.getAttribute('data-piso')); renderCroquis(); return; }
      var espacioEl = ev.target.closest('.espacio.disponible');
      if (espacioEl) {
        var id = espacioEl.getAttribute('data-id');
        for (var i = 0; i < ESPACIOS.length; i++) {
          if (ESPACIOS[i].id === id) { abrirForm(ESPACIOS[i]); break; }
        }
        return;
      }
      if (ev.target.closest('[data-cerrar]')) { cerrarForm(); return; }
      var conf = ev.target.closest('[data-confirmar]');
      if (conf) {
        var espacioId = conf.getAttribute('data-confirmar');
        var placa = ($('#pq-f-placa').value || '').trim().toUpperCase();
        var dur = Number($('#pq-f-dur').value);
        var email = ($('#pq-f-email').value || '').trim();
        if (!placa) { ferr('Ingresa la placa del vehiculo.'); return; }
        if (!email) { ferr('Ingresa un correo para enviar el QR.'); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { ferr('Ingresa un correo valido.'); return; }
        api('POST', '/ocupar', { espacioId: espacioId, placa: placa, duracion: dur, email: email }).then(function (j) {
          if (!j.ok) { ferr(j.error); return; }
          var envioTxt = j.sesion.emailSent
            ? 'QR enviado a ' + esc(j.sesion.correo) + '.'
            : 'No se pudo enviar el correo ahora. Puedes descargar el QR aqui mismo.';
          formCard.innerHTML =
            '<div class="pq-form-head"><h3>Espacio tomado</h3>' +
              '<button class="pq-x" type="button" data-cerrar aria-label="Cerrar">&times;</button></div>' +
            '<div class="pq-ok"><strong>' + esc(j.sesion.espacioId) + '</strong> &middot; Placa ' + esc(j.sesion.placa) + '<br>' +
              'Ingreso: ' + fmtFecha(j.sesion.inicio) + '<br>' +
              envioTxt + '</div>' +
            '<div id="pq-form-qr"></div>' +
            '<div class="pq-form-code">' + esc(j.sesion.qrData) + '</div>' +
            '<div class="pq-form-actions">' +
              '<button class="btn ghost" type="button" data-descargar-qr>Descargar QR</button>' +
              '<button class="btn" type="button" data-cerrar>Listo</button>' +
            '</div>';
          if (window.QRCode) {
            new QRCode($('#pq-form-qr'), { text: j.sesion.qrData, width: 148, height: 148 });
          } else {
            $('#pq-form-qr').textContent = j.sesion.qrData;
          }
          formCard.setAttribute('data-qr-code', j.sesion.codigo);
          refresh();
        });
        return;
      }
      if (ev.target.closest('[data-descargar-qr]')) {
        var cont = $('#pq-form-qr');
        if (!cont) return;
        var canvas = cont.querySelector('canvas');
        var img = cont.querySelector('img');
        var url = canvas ? canvas.toDataURL('image/png') : (img ? img.src : null);
        if (!url) return;
        var a = document.createElement('a');
        a.href = url;
        a.download = (formCard.getAttribute('data-qr-code') || 'CSH-QR') + '.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }
    });

    $('#pq-consultar').addEventListener('click', function () {
      var placa = ($('#pq-placa').value || '').trim().toUpperCase();
      showErr('');
      $('#pq-detalle').style.display = 'none';
      $('#pq-recibo').style.display = 'none';
      if (!placa) { showErr('Ingresa la placa del vehiculo.'); return; }
      api('POST', '/consulta', { placa: placa }).then(function (j) {
        if (!j.ok) { showErr(j.error); return; }
        reservaActual = j.info;
        var rec = $('#pq-recibo');
        rec.style.display = 'block';
        rec.innerHTML = '<strong>Reserva encontrada</strong>' +
          '<div class="pq-reserva-grid">' +
            '<div><span>Espacio</span>' + esc(j.info.espacioId) + '</div>' +
            '<div><span>Estado</span>' + esc(j.info.estado).toUpperCase() + '</div>' +
            '<div><span>Placa</span>' + esc(j.info.placa) + '</div>' +
            '<div><span>Correo</span>' + esc(j.info.correo) + '</div>' +
            '<div><span>Desde</span>' + fmtFecha(j.info.inicio) + '</div>' +
            '<div><span>Hasta</span>' + fmtFecha(j.info.fin) + '</div>' +
          '</div>' +
          '<div class="pq-total"><span>Total a pagar<br><small>' + j.info.horas + 'h a ' + money(j.info.tarifa) + '/h</small></span><strong>' + money(j.info.monto) + '</strong></div>' +
          '<button class="btn" type="button" id="pq-pagar">Pagar parqueo</button>' +
          '<button class="btn ghost" type="button" id="pq-reenviar" data-placa="' + esc(j.info.placa) + '">Reenviar correo</button>' +
          '<p id="pq-reenvio-msg" class="pq-ok-msg"></p>' +
          '<p class="pq-security-note">Por seguridad, el codigo de reserva y el QR solo se muestran dentro del area autenticada.</p>';
        $('#pq-pagar').addEventListener('click', function () {
          if (!reservaActual) return;
          if (reservaActual.correo === 'Sin correo asociado') {
            showErr('No se puede pagar sin correo asociado para enviar el recibo.');
            return;
          }
          abrirPago(reservaActual);
        });
        $('#pq-reenviar').addEventListener('click', function () {
          var btn = this;
          btn.disabled = true;
          btn.textContent = 'Reenviando...';
          api('POST', '/reenviar', { placa: btn.getAttribute('data-placa') }).then(function (r) {
            btn.disabled = false;
            btn.textContent = 'Reenviar correo';
            if (!r.ok) { showErr(r.error); return; }
            var msg = $('#pq-reenvio-msg');
            msg.textContent = 'Correo reenviado a ' + r.correo + '.';
            msg.style.display = 'block';
          });
        });
      });
    });

    document.addEventListener('click', function (ev) {
      var submit = ev.target.closest('#pq-pay-submit');
      if (!submit || !reservaActual) return;
      var pago = {
        name: ($('#pq-pay-name').value || '').trim(),
        cardNumber: ($('#pq-pay-card').value || '').trim(),
        exp: ($('#pq-pay-exp').value || '').trim(),
        cvv: ($('#pq-pay-cvv').value || '').trim(),
      };
      submit.disabled = true;
      submit.textContent = 'Procesando...';
      api('POST', '/pagar', { placa: reservaActual.placa, pago: pago }).then(function (j) {
        submit.disabled = false;
        submit.textContent = 'Pagar ' + money(reservaActual.monto).replace(/&#8353;/, '₡');
        if (!j.ok) { showPayMsg(j.error || 'No se pudo realizar la transaccion.', false); return; }
        showPayMsg('Pago exitoso. Recibo enviado a ' + j.recibo.correo + '. Transaccion ' + j.recibo.transaccion + '.', true);
        $('#pq-recibo').innerHTML =
          '<strong>Pago registrado</strong>' +
          '<div class="pq-total"><span>Transaccion<br><small>' + esc(j.recibo.transaccion) + '</small></span><strong>' + money(j.recibo.monto) + '</strong></div>' +
          '<p class="pq-security-note">El espacio quedo liberado y el recibo fue enviado a ' + esc(j.recibo.correo) + '.</p>';
        refresh();
      });
    });

    refresh();
    setInterval(tickExpiracion, 1000);
    setInterval(refresh, 60000);
  })();
  </script>
</body>
</html>`;
}

function parkingModuleHtml(user) {
  const me = JSON.stringify({
    id: user.id,
    name: user.name,
    parkingRole: user.parkingRole || 'invitado',
  });
  return `<section class="workspace pq-workspace">
  <style>
    .pq-workspace { max-width:1280px; --verde:#16a34a; --naranja:#ea580c; --rojo:#d62828; }
    .pq-banner { display:none; align-items:center; justify-content:space-between; gap:22px; flex-wrap:wrap;
      border:1px solid rgba(201,169,97,.45); border-radius:6px; background:var(--surface);
      padding:16px 22px; margin-bottom:24px; }
    .pq-banner.overdue { border-color:var(--rojo); animation:pq-pulse 1.2s ease-in-out infinite; }
    @keyframes pq-pulse { 0%,100% { background:var(--surface); } 50% { background:rgba(214,40,40,.22); } }
    .pq-dash-main { display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
    .pq-dash-esp { font-family:Impact, Haettenschweiler, sans-serif; font-size:30px; letter-spacing:.02em; }
    .pq-dash-placa { color:var(--muted); font-size:14px; }
    .pq-dash-estado { font-size:11px; letter-spacing:.14em; padding:4px 10px; border-radius:999px; border:1px solid; }
    .pq-dash-estado.reservado { color:var(--naranja); border-color:rgba(234,88,12,.55); background:rgba(234,88,12,.12); }
    .pq-dash-estado.ocupado { color:#ff8d8d; border-color:rgba(214,40,40,.55); background:rgba(214,40,40,.14); }
    .pq-dash-timer { text-align:center; }
    .pq-dash-timer small { display:block; color:var(--muted); font-size:11px; letter-spacing:.14em; text-transform:uppercase; margin-bottom:2px; }
    .pq-dash-timer strong { font-size:30px; font-variant-numeric:tabular-nums; }
    .pq-dash-actions { display:flex; gap:10px; flex-wrap:wrap; }
    .pq-bar { flex-basis:100%; height:7px; border-radius:999px; background:rgba(247,241,223,.12); overflow:hidden; }
    .pq-bar i { display:block; height:100%; width:100%; border-radius:999px; background:var(--verde);
      transition:width 1s linear, background .4s ease; }
    .pq-bar i.medio { background:var(--naranja); }
    .pq-bar i.bajo { background:var(--rojo); }
    .pq-btn { min-height:38px; border-radius:4px; border:1px solid var(--red); background:var(--red);
      color:#fff; font-size:13px; font-weight:700; padding:0 14px; cursor:pointer; font-family:inherit; }
    .pq-btn:hover { background:#b91d1d; }
    .pq-btn.ghost { background:transparent; border-color:var(--line); color:var(--paper); font-weight:500; }
    .pq-btn.ghost:hover { background:var(--surface-2); }
    .pq-btn.danger { background:transparent; border-color:rgba(214,40,40,.6); color:#ff9d9d; }
    .pq-btn.danger:hover { background:rgba(214,40,40,.16); }
    .pq-toolbar { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:18px; }
    .pq-tabs { display:flex; gap:8px; }
    .pq-tab { min-height:38px; padding:0 18px; border-radius:4px; border:1px solid var(--line);
      background:var(--surface); color:var(--muted); font-size:13px; font-weight:700; cursor:pointer; font-family:inherit; }
    .pq-tab.active { border-color:var(--gold); color:var(--paper); background:rgba(201,169,97,.12); }
    .pq-leyenda { display:flex; gap:16px; color:var(--muted); font-size:12px; flex-wrap:wrap; align-items:center; }
    .pq-leyenda span { display:inline-flex; align-items:center; gap:6px; }
    .pq-leyenda i { width:12px; height:12px; border-radius:3px; display:inline-block; }
    .pq-piso { display:grid; grid-template-columns:1fr 84px 1fr; gap:16px; }
    .pq-zona { border:1px solid var(--line); border-radius:6px; background:var(--surface); padding:14px; min-width:0; }
    .pq-zona h3 { margin:0 0 12px; font-size:12px; letter-spacing:.16em; text-transform:uppercase; color:var(--gold); }
    .pq-grid { display:grid; grid-template-columns:repeat(10, 1fr); gap:4px; }
    .espacio { position:relative; overflow:hidden; aspect-ratio:1; border-radius:3px; display:grid; place-items:center;
      font-size:10px; font-weight:600; color:rgba(255,255,255,.92); cursor:pointer; user-select:none; }
    .espacio .pq-num { position:relative; z-index:1; }
    .espacio.disponible { background:rgba(22,163,74,.72); }
    .espacio.disponible:hover { background:var(--verde); }
    .espacio.reservado { background:rgba(234,88,12,.85); }
    .espacio.ocupado { background:rgba(214,40,40,.88); }
    .espacio:hover { outline:2px solid var(--gold); z-index:1; }
    .espacio.mio { outline:2px solid var(--gold); box-shadow:0 0 10px rgba(201,169,97,.75); z-index:1; }
    #pq-croquis.solo-disp .espacio.reservado, #pq-croquis.solo-disp .espacio.ocupado { opacity:.16; }
    .pq-badge { position:absolute; top:-7px; right:-5px; background:var(--rojo); color:#fff; font-size:8px;
      line-height:1; padding:2px 3px; border-radius:3px; font-variant-numeric:tabular-nums; z-index:2;
      box-shadow:0 2px 6px rgba(0,0,0,.45); }
    .pq-badge:empty { display:none; }
    .pq-exp { position:absolute; left:3px; right:3px; bottom:3px; height:4px; border-radius:999px;
      background:rgba(5,4,3,.45); overflow:hidden; }
    .pq-exp i { display:block; width:100%; height:100%; background:#7ee2a0; border-radius:999px;
      transition:width 1s linear, background .25s ease; }
    .pq-exp i.medio { background:#facc15; }
    .pq-exp i.bajo { background:#fff; }
    .pq-exp i.vencido { background:#111; width:100%; }
    .pq-calle { border:1px dashed rgba(201,169,97,.4); border-radius:6px; display:flex; flex-direction:column;
      align-items:center; justify-content:center; gap:18px; color:var(--muted); font-size:11px; letter-spacing:.18em; }
    .pq-calle-label { writing-mode:vertical-rl; text-orientation:upright; letter-spacing:.4em; }
    #pq-tooltip { position:fixed; display:none; z-index:70; max-width:240px; background:#181310;
      border:1px solid rgba(201,169,97,.5); border-radius:4px; padding:10px 12px; font-size:12px;
      line-height:1.55; color:var(--paper); pointer-events:none; box-shadow:0 14px 34px rgba(0,0,0,.5); }
    #pq-modal-back { position:fixed; inset:0; z-index:80; display:none; place-items:center;
      background:rgba(5,4,3,.72); padding:18px; }
    #pq-modal-back.open { display:grid; }
    .pq-modal { width:min(420px, 100%); background:var(--surface-2); border:1px solid rgba(201,169,97,.4);
      border-radius:6px; padding:22px; max-height:calc(100vh - 36px); overflow:auto; }
    .pq-modal-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:6px; }
    .pq-modal-head h3 { margin:0; font-family:Impact, Haettenschweiler, sans-serif; font-size:26px; text-transform:uppercase; }
    .pq-x { border:0; background:transparent; color:var(--muted); font-size:24px; cursor:pointer; line-height:1; }
    .pq-x:hover { color:var(--paper); }
    .pq-modal-sub { margin:0 0 6px; color:var(--muted); font-size:13px; }
    .pq-modal label { display:block; font-size:11px; color:var(--gold); letter-spacing:.14em; text-transform:uppercase; margin:14px 0 6px; }
    .pq-modal input, .pq-modal select { width:100%; min-height:42px; border:1px solid var(--line); border-radius:4px;
      background:#100d0b; color:var(--paper); padding:0 12px; font-size:14px; outline:none; font-family:inherit; }
    .pq-modal input:focus, .pq-modal select:focus { border-color:var(--gold); }
    .pq-modal-actions { display:flex; gap:10px; flex-wrap:wrap; margin-top:18px; }
    .pq-info { margin:10px 0 0; display:grid; gap:6px; font-size:13px; }
    .pq-info span { color:var(--muted); }
    #pq-modal-err { display:none; margin-top:14px; border:1px solid rgba(214,40,40,.5); background:rgba(214,40,40,.12);
      color:#ffd0d0; padding:10px 12px; border-radius:4px; font-size:13px; }
    #pq-qr { width:196px; margin:16px auto 8px; background:#fff; padding:8px; border-radius:4px; }
    #pq-qr img, #pq-qr canvas { display:block; margin:0 auto; }
    .pq-codigo { text-align:center; margin:6px 0 0; font-size:15px; letter-spacing:.18em; color:var(--gold); }
    .pq-eventos { margin-top:34px; }
    .pq-evt-head { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:12px; }
    .pq-eventos h2 { margin:0; font-family:Impact, Haettenschweiler, sans-serif; font-size:26px; text-transform:uppercase; }
    #pq-evt-placa { min-height:40px; width:min(260px, 100%); border:1px solid var(--line); border-radius:4px;
      background:#100d0b; color:var(--paper); padding:0 12px; font-size:13px; outline:none; font-family:inherit; }
    #pq-evt-placa:focus { border-color:var(--gold); }
    .pq-tag { font-size:11px; padding:3px 8px; border-radius:999px; border:1px solid var(--line); color:var(--muted); text-transform:capitalize; white-space:nowrap; }
    .pq-tag.reserva { color:var(--gold); border-color:rgba(201,169,97,.45); }
    .pq-tag.entrada { color:#7ee2a0; border-color:rgba(22,163,74,.5); }
    .pq-tag.salida { color:#9ecbff; border-color:rgba(80,140,220,.5); }
    .pq-tag.cancelacion { color:#ff9d9d; border-color:rgba(214,40,40,.5); }
    .pq-tag.extension { color:var(--naranja); border-color:rgba(234,88,12,.5); }
    .pq-tag.envio { color:#b7a6ff; border-color:rgba(140,120,220,.5); }
    .pq-tag.pago { color:#6ee7b7; border-color:rgba(16,185,129,.5); }
    .pq-empty { color:var(--muted); text-align:center; }
    #pq-evt-more { margin-top:14px; }
    @media (max-width:980px) {
      .pq-piso { grid-template-columns:1fr; }
      .pq-calle { min-height:56px; flex-direction:row; }
      .pq-calle-label { writing-mode:horizontal-tb; text-orientation:mixed; }
    }
  </style>
  <div class="page-head">
    <div>
      <p>Zonas y reservas</p>
      <h1>Gestion de parqueo</h1>
    </div>
    <span class="build">400 espacios &middot; 2 pisos</span>
  </div>
  <div id="pq-dash" class="pq-banner"></div>
  <div class="pq-toolbar">
    <div class="pq-tabs">
      <button class="pq-tab active" type="button" data-piso="1">Piso 1</button>
      <button class="pq-tab" type="button" data-piso="2">Piso 2</button>
      <button class="pq-tab" type="button" id="pq-solo-disp">Solo disponibles</button>
    </div>
    <div class="pq-leyenda">
      <span><i style="background:#16a34a"></i> Disponible</span>
      <span><i style="background:#ea580c"></i> Reservado</span>
      <span><i style="background:#d62828"></i> Ocupado</span>
      <span id="pq-stats"></span>
    </div>
  </div>
  <div id="pq-croquis"><p style="color:var(--muted)">Cargando croquis...</p></div>
  <div class="pq-eventos">
    <div class="pq-evt-head">
      <h2>Log de eventos</h2>
      <input id="pq-evt-placa" placeholder="Buscar por placa..." autocomplete="off" maxlength="12">
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Fecha/Hora</th><th>Tipo</th><th>Espacio</th><th>Placa</th><th>Usuario</th><th>Notas</th></tr></thead>
        <tbody id="pq-evt-body"></tbody>
      </table>
    </div>
    <button id="pq-evt-more" class="pq-btn ghost" type="button" style="display:none">Cargar mas</button>
  </div>
  <div id="pq-tooltip"></div>
  <div id="pq-modal-back"><div class="pq-modal" id="pq-modal"></div></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
  <script>
  (function () {
    var API = '/admin/api/parqueo';
    var ME = ${me};
    var STATE = { espacios: [], reservas: [] };
    var piso = 1;
    var evtOffset = 0;
    var EVT_LIMIT = 50;
    var evtPlaca = '';
    var primeraCarga = true;
    var qrActual = null;

    function $(sel) { return document.querySelector(sel); }
    function esc(v) {
      return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function fmtDur(ms) {
      var neg = ms < 0;
      ms = Math.abs(ms);
      var h = Math.floor(ms / 3600000);
      var m = Math.floor((ms % 3600000) / 60000);
      var s = Math.floor((ms % 60000) / 1000);
      return (neg ? '-' : '') + pad(h) + ':' + pad(m) + ':' + pad(s);
    }
    function fmtHora(iso) { var d = new Date(iso); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
    function fmtFecha(iso) {
      var d = new Date(iso);
      return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' +
        pad(d.getHours()) + ':' + pad(d.getMinutes());
    }
    function api(method, ruta, body) {
      return fetch(API + ruta, {
        method: method,
        headers: { 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      }).then(function (r) { return r.json(); })
        .catch(function () { return { ok: false, error: 'Error de red' }; });
    }
    function findEsp(id) {
      for (var i = 0; i < STATE.espacios.length; i++) {
        if (STATE.espacios[i].id === id) return STATE.espacios[i];
      }
      return null;
    }
    function reservaDe(esp) {
      if (!esp || !esp.reservaId) return null;
      for (var i = 0; i < STATE.reservas.length; i++) {
        if (STATE.reservas[i].id === esp.reservaId) return STATE.reservas[i];
      }
      return null;
    }
    function miReserva() {
      for (var i = 0; i < STATE.reservas.length; i++) {
        var r = STATE.reservas[i];
        if (r.userId === ME.id && (r.estado === 'reservado' || r.estado === 'ocupado')) return r;
      }
      return null;
    }

    function refresh() {
      return api('GET', '/estado').then(function (j) {
        if (!j.ok) return;
        STATE.espacios = j.espacios;
        STATE.reservas = j.reservas;
        // Prioriza la reserva del usuario: abre el croquis en su piso.
        if (primeraCarga) {
          primeraCarga = false;
          var mia = miReserva();
          if (mia) {
            var e = findEsp(mia.espacioId);
            if (e) piso = e.piso;
          }
        }
        renderDash();
        renderCroquis();
      });
    }

    function renderDash() {
      var el = $('#pq-dash');
      // El dashboard personal es para socios e invitados; el admin gestiona desde el croquis.
      var r = ME.parkingRole === 'admin' ? null : miReserva();
      if (!r) { el.style.display = 'none'; el.classList.remove('overdue'); el.innerHTML = ''; return; }
      el.style.display = 'flex';
      el.innerHTML =
        '<div class="pq-dash-main">' +
          '<span class="pq-dash-esp">' + esc(r.espacioId) + '</span>' +
          '<span class="pq-dash-placa">Placa ' + esc(r.placa) + '</span>' +
          '<span class="pq-dash-estado ' + esc(r.estado) + '">' + esc(r.estado).toUpperCase() + '</span>' +
        '</div>' +
        '<div class="pq-dash-timer"><small>Tiempo restante</small>' +
          '<strong id="pq-dash-count" data-fin="' + esc(r.fin) + '">--:--:--</strong></div>' +
        '<div class="pq-dash-actions">' +
          '<button class="pq-btn" type="button" data-act="extender" data-id="' + esc(r.id) + '">Extender +30 min</button>' +
          '<button class="pq-btn ghost" type="button" data-act="cancelar" data-id="' + esc(r.id) + '">Cancelar</button>' +
        '</div>' +
        '<div class="pq-bar"><i id="pq-dash-bar" data-inicio="' + esc(r.inicio) + '" data-fin="' + esc(r.fin) + '"></i></div>';
      tick();
    }

    function renderCroquis() {
      var porZona = { A: [], B: [] };
      for (var i = 0; i < STATE.espacios.length; i++) {
        var e = STATE.espacios[i];
        if (e.piso === piso && porZona[e.zona]) porZona[e.zona].push(e);
      }
      function grid(arr) {
        arr.sort(function (a, b) { return a.num - b.num; });
        var h = '';
        for (var k = 0; k < arr.length; k++) {
          var es = arr[k];
          var r = reservaDe(es);
          var badge = r ? '<span class="pq-badge" data-fin="' + esc(r.fin) + '"></span>' : '';
          var exp = r ? '<span class="pq-exp" data-inicio="' + esc(r.inicio) + '" data-fin="' + esc(r.fin) + '"><i></i></span>' : '';
          var mio = r && r.userId === ME.id ? ' mio' : '';
          h += '<div class="espacio ' + esc(es.estado) + mio + '" data-id="' + esc(es.id) + '"><span class="pq-num">' + es.num + '</span>' + badge + exp + '</div>';
        }
        return h;
      }
      $('#pq-croquis').innerHTML =
        '<div class="pq-piso">' +
          '<div class="pq-zona"><h3>Zona A &middot; Piso ' + piso + '</h3><div class="pq-grid">' + grid(porZona.A) + '</div></div>' +
          '<div class="pq-calle"><span>ENTRADA</span><span class="pq-calle-label">CALLE</span></div>' +
          '<div class="pq-zona"><h3>Zona B &middot; Piso ' + piso + '</h3><div class="pq-grid">' + grid(porZona.B) + '</div></div>' +
        '</div>';
      var libres = 0, total = 0;
      for (var t = 0; t < STATE.espacios.length; t++) {
        if (STATE.espacios[t].piso !== piso) continue;
        total++;
        if (STATE.espacios[t].estado === 'disponible') libres++;
      }
      $('#pq-stats').textContent = libres + '/' + total + ' libres en piso ' + piso;
      var tabs = document.querySelectorAll('.pq-tab');
      for (var b = 0; b < tabs.length; b++) {
        tabs[b].classList.toggle('active', Number(tabs[b].getAttribute('data-piso')) === piso);
      }
      tick();
    }

    function tick() {
      var c = $('#pq-dash-count');
      if (c) {
        var ms = new Date(c.getAttribute('data-fin')).getTime() - Date.now();
        c.textContent = fmtDur(ms);
        $('#pq-dash').classList.toggle('overdue', ms < 0);
      }
      var bar = $('#pq-dash-bar');
      if (bar) {
        var ini = new Date(bar.getAttribute('data-inicio')).getTime();
        var fin = new Date(bar.getAttribute('data-fin')).getTime();
        var pct = fin > ini ? (fin - Date.now()) / (fin - ini) : 0;
        pct = Math.max(0, Math.min(1, pct));
        bar.style.width = (pct * 100) + '%';
        bar.classList.toggle('bajo', pct <= 0.2);
        bar.classList.toggle('medio', pct > 0.2 && pct <= 0.5);
      }
      var badges = document.querySelectorAll('.pq-badge');
      for (var i = 0; i < badges.length; i++) {
        var left = new Date(badges[i].getAttribute('data-fin')).getTime() - Date.now();
        badges[i].textContent = left < 0 ? fmtDur(left).slice(0, 6) : '';
      }
      var expBars = document.querySelectorAll('.pq-exp');
      for (var x = 0; x < expBars.length; x++) {
        var exp = expBars[x];
        var fill = exp.querySelector('i');
        var start = new Date(exp.getAttribute('data-inicio')).getTime();
        var end = new Date(exp.getAttribute('data-fin')).getTime();
        var total = Math.max(1, end - start);
        var remaining = end - Date.now();
        var width = Math.max(0, Math.min(1, remaining / total));
        fill.style.width = (width * 100) + '%';
        fill.classList.toggle('medio', width > 0.2 && width <= 0.5);
        fill.classList.toggle('bajo', width > 0 && width <= 0.2);
        fill.classList.toggle('vencido', remaining <= 0);
      }
    }

    // Tooltip flotante compartido
    var tip = $('#pq-tooltip');
    $('#pq-croquis').addEventListener('mouseover', function (ev) {
      var el = ev.target.closest('.espacio');
      if (!el) { tip.style.display = 'none'; return; }
      var e = findEsp(el.getAttribute('data-id'));
      if (!e) return;
      var r = reservaDe(e);
      var h = '<strong>' + esc(e.id) + '</strong><br>Estado: ' + esc(e.estado);
      if (r) {
        h += '<br>Placa: ' + esc(r.placa) +
          '<br>Usuario: ' + esc(r.userName) + ' (' + esc(r.rol) + ')' +
          '<br>Desde: ' + fmtHora(r.inicio) + ' &middot; Hasta: ' + fmtHora(r.fin) +
          '<br>Codigo: ' + esc(r.codigo);
      }
      tip.innerHTML = h;
      tip.style.display = 'block';
      var rect = el.getBoundingClientRect();
      var top = rect.bottom + 8;
      if (top + tip.offsetHeight > window.innerHeight - 10) top = rect.top - tip.offsetHeight - 8;
      tip.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - tip.offsetWidth - 10)) + 'px';
      tip.style.top = top + 'px';
    });
    $('#pq-croquis').addEventListener('mouseleave', function () { tip.style.display = 'none'; });

    // Modal
    var modalBack = $('#pq-modal-back');
    var modal = $('#pq-modal');
    function showModal(html) {
      modal.innerHTML = html + '<div id="pq-modal-err"></div>';
      modalBack.classList.add('open');
    }
    function hideModal() { modalBack.classList.remove('open'); modal.innerHTML = ''; }
    function modalError(msg) {
      var e = $('#pq-modal-err');
      if (e) { e.style.display = 'block'; e.textContent = msg || 'Error inesperado'; }
      else alert(msg || 'Error inesperado');
    }
    modalBack.addEventListener('click', function (ev) { if (ev.target === modalBack) hideModal(); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') hideModal(); });

    function headHtml(titulo) {
      return '<div class="pq-modal-head"><h3>' + esc(titulo) + '</h3>' +
        '<button class="pq-x" type="button" data-act="cerrar" aria-label="Cerrar">&times;</button></div>';
    }

    function openModal(id) {
      var e = findEsp(id);
      if (!e) return;
      var r = reservaDe(e);
      var h = headHtml(e.id);
      if (e.estado === 'disponible') {
        h += '<p class="pq-modal-sub">Disponible &middot; Piso ' + e.piso + ' &middot; Zona ' + esc(e.zona) + '</p>' +
          '<label for="pq-placa">Placa</label>' +
          '<input id="pq-placa" maxlength="12" placeholder="ABC-123" autocomplete="off">' +
          '<label for="pq-dur">Duracion</label>' +
          '<select id="pq-dur">' +
            '<option value="30">30 minutos</option>' +
            '<option value="60" selected>1 hora</option>' +
            '<option value="120">2 horas</option>' +
            '<option value="240">4 horas</option>' +
            '<option value="480">8 horas</option>' +
          '</select>' +
          '<div class="pq-modal-actions">' +
            '<button class="pq-btn" type="button" data-act="reservar" data-id="' + esc(e.id) + '">Reservar</button>' +
          '</div>';
      } else if (r) {
        var mio = r.userId === ME.id;
        var admin = ME.parkingRole === 'admin';
        h += '<p class="pq-modal-sub">' + esc(r.estado).toUpperCase() + ' &middot; Piso ' + e.piso + ' &middot; Zona ' + esc(e.zona) + '</p>' +
          '<div class="pq-info">' +
            '<div><span>Placa:</span> ' + esc(r.placa) + '</div>' +
            '<div><span>Usuario:</span> ' + esc(r.userName) + ' (' + esc(r.rol) + ')</div>' +
            '<div><span>Desde:</span> ' + fmtFecha(r.inicio) + '</div>' +
            '<div><span>Hasta:</span> ' + fmtFecha(r.fin) + '</div>' +
            '<div><span>Codigo:</span> ' + esc(r.codigo) + '</div>' +
          '</div>';
        var btns = '';
        if (admin) {
          if (r.estado === 'reservado') {
            btns += '<button class="pq-btn" type="button" data-act="ocupar" data-id="' + esc(r.id) + '">Marcar ocupado</button>';
          }
          btns += '<button class="pq-btn ghost" type="button" data-act="extender" data-id="' + esc(r.id) + '">Extender +30</button>';
          btns += '<button class="pq-btn danger" type="button" data-act="liberar" data-id="' + esc(e.id) + '">Liberar forzado</button>';
        } else if (mio) {
          btns += '<button class="pq-btn ghost" type="button" data-act="extender" data-id="' + esc(r.id) + '">Extender +30</button>';
          btns += '<button class="pq-btn danger" type="button" data-act="cancelar" data-id="' + esc(r.id) + '">Cancelar reserva</button>';
        }
        if (btns) h += '<div class="pq-modal-actions">' + btns + '</div>';
      } else {
        h += '<p class="pq-modal-sub">Sin informacion de reserva.</p>';
      }
      showModal(h);
      var placa = $('#pq-placa');
      if (placa) placa.focus();
    }

    function showQr(r) {
      qrActual = r;
      showModal(
        headHtml('Reserva confirmada') +
        '<p class="pq-modal-sub">' + esc(r.espacioId) + ' &middot; Placa ' + esc(r.placa) +
          ' &middot; Hasta ' + fmtFecha(r.fin) + '</p>' +
        '<div id="pq-qr"></div>' +
        '<p class="pq-codigo">' + esc(r.codigo) + '</p>' +
        '<p class="pq-modal-sub" style="text-align:center;margin-top:10px">Presenta este codigo QR en el acceso del parqueo.</p>' +
        '<div class="pq-modal-actions" style="justify-content:center">' +
          '<button class="pq-btn ghost" type="button" data-act="qr-descargar">Descargar QR</button>' +
        '</div>' +
        '<div id="pq-qr-envio" style="display:none">' +
          '<label for="pq-qr-email">Correo para enviar el QR</label>' +
          '<input id="pq-qr-email" type="email" placeholder="correo@ejemplo.com" autocomplete="email" maxlength="120">' +
          '<div class="pq-modal-actions">' +
            '<button class="pq-btn" type="button" data-act="qr-enviar">Enviar y descargar</button>' +
          '</div>' +
        '</div>' +
        '<p id="pq-qr-msg" class="pq-modal-sub" style="display:none;text-align:center;color:#7ee2a0;margin-top:14px"></p>'
      );
      if (window.QRCode) {
        new QRCode($('#pq-qr'), { text: r.qrData, width: 180, height: 180 });
      } else {
        $('#pq-qr').innerHTML = '<p style="color:#333;font-size:12px;text-align:center;word-break:break-all">' +
          esc(r.qrData) + '</p>';
      }
    }

    function descargarQr() {
      if (!qrActual) return;
      var cont = $('#pq-qr');
      if (!cont) return;
      var canvas = cont.querySelector('canvas');
      var img = cont.querySelector('img');
      var url = canvas ? canvas.toDataURL('image/png') : (img ? img.src : null);
      if (!url) return;
      var a = document.createElement('a');
      a.href = url;
      a.download = qrActual.codigo + '.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }

    function despuesDeAccion(j) {
      if (!j.ok) { modalError(j.error); return; }
      hideModal();
      refresh();
      cargarEventos(true);
    }

    document.addEventListener('click', function (ev) {
      var tab = ev.target.closest('.pq-tab[data-piso]');
      if (tab) { piso = Number(tab.getAttribute('data-piso')); renderCroquis(); return; }
      var espacio = ev.target.closest('.espacio');
      if (espacio) { tip.style.display = 'none'; openModal(espacio.getAttribute('data-id')); return; }
      var btn = ev.target.closest('[data-act]');
      if (!btn) return;
      var act = btn.getAttribute('data-act');
      var id = btn.getAttribute('data-id');
      if (act === 'cerrar') { hideModal(); return; }
      if (act === 'reservar') {
        var placa = ($('#pq-placa').value || '').trim().toUpperCase();
        var dur = Number($('#pq-dur').value);
        if (!placa) { modalError('Ingresa la placa del vehiculo.'); return; }
        api('POST', '/reservar', { espacioId: id, placa: placa, duracion: dur }).then(function (j) {
          if (!j.ok) { modalError(j.error); return; }
          showQr(j.reserva);
          refresh();
          cargarEventos(true);
        });
        return;
      }
      if (act === 'qr-descargar') {
        btn.style.display = 'none';
        var envio = $('#pq-qr-envio');
        if (envio) { envio.style.display = 'block'; $('#pq-qr-email').focus(); }
        return;
      }
      if (act === 'qr-enviar') {
        var email = ($('#pq-qr-email').value || '').trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { modalError('Ingresa un correo valido.'); return; }
        api('POST', '/enviar-qr', { reservaId: qrActual ? qrActual.id : '', email: email }).then(function (j) {
          if (!j.ok) { modalError(j.error); return; }
          descargarQr();
          $('#pq-qr-envio').style.display = 'none';
          var msg = $('#pq-qr-msg');
          msg.textContent = 'QR descargado y enviado a ' + j.email + '.';
          msg.style.display = 'block';
          cargarEventos(true);
        });
        return;
      }
      if (act === 'ocupar') { api('POST', '/ocupar', { reservaId: id }).then(despuesDeAccion); return; }
      if (act === 'extender') { api('POST', '/extender', { reservaId: id, minutos: 30 }).then(despuesDeAccion); return; }
      if (act === 'liberar') { api('POST', '/liberar', { espacioId: id }).then(despuesDeAccion); return; }
      if (act === 'cancelar') { api('DELETE', '/reserva/' + encodeURIComponent(id)).then(despuesDeAccion); return; }
    });

    function cargarEventos(reset) {
      if (reset) evtOffset = 0;
      var ruta = '/eventos?limit=' + EVT_LIMIT + '&offset=' + evtOffset;
      if (evtPlaca) ruta += '&placa=' + encodeURIComponent(evtPlaca);
      api('GET', ruta).then(function (j) {
        if (!j.ok) return;
        var filas = '';
        for (var i = 0; i < j.eventos.length; i++) {
          var e = j.eventos[i];
          filas += '<tr>' +
            '<td>' + fmtFecha(e.timestamp) + '</td>' +
            '<td><span class="pq-tag ' + esc(e.tipo) + '">' + esc(e.tipo) + '</span></td>' +
            '<td>' + esc(e.espacioId) + '</td>' +
            '<td>' + esc(e.placa) + '</td>' +
            '<td>' + esc(e.userName) + '</td>' +
            '<td>' + esc(e.notas) + '</td>' +
          '</tr>';
        }
        var tb = $('#pq-evt-body');
        if (reset) tb.innerHTML = filas;
        else tb.insertAdjacentHTML('beforeend', filas);
        evtOffset += j.eventos.length;
        if (j.total === 0) {
          tb.innerHTML = '<tr><td colspan="6" class="pq-empty">' +
            (evtPlaca ? 'Sin eventos para la placa "' + esc(evtPlaca) + '".' : 'Sin eventos registrados.') +
            '</td></tr>';
        }
        $('#pq-evt-more').style.display = evtOffset < j.total ? 'inline-flex' : 'none';
      });
    }
    $('#pq-evt-more').addEventListener('click', function () { cargarEventos(false); });

    var placaTimer = null;
    $('#pq-evt-placa').addEventListener('input', function () {
      clearTimeout(placaTimer);
      var v = this.value.trim().toUpperCase();
      placaTimer = setTimeout(function () {
        if (v === evtPlaca) return;
        evtPlaca = v;
        cargarEventos(true);
      }, 300);
    });

    $('#pq-solo-disp').addEventListener('click', function () {
      this.classList.toggle('active');
      $('#pq-croquis').classList.toggle('solo-disp', this.classList.contains('active'));
    });

    refresh();
    cargarEventos(true);
    setInterval(tick, 1000);
    setInterval(refresh, 60000);
  })();
  </script>
</section>`;
}

function adminModulePanel(activeModule, user) {
  if (activeModule.path === '/admin/parqueo') return parkingModuleHtml(user);
  const users = activeModule.path === '/admin/usuarios' ? adminUsersTable() : '';
  return `<section class="workspace">
    <div class="page-head">
      <div>
        <p>${escapeHtml(activeModule.eyebrow)}</p>
        <h1>${escapeHtml(activeModule.label)}</h1>
      </div>
      <span class="build">Bajo construccion</span>
    </div>
    <div class="notice">
      La pantalla ya esta reservada dentro del modulo administrativo. Las acciones reales se conectaran cuando la base de datos final este definida.
    </div>
    ${users}
    <div class="empty-state">
      <img src="${ADMIN_LOGO_PATH}" alt="Escudo Club Sport Herediano">
      <h2>Modulo en desarrollo</h2>
      <p>Pronto incluira busqueda, alta, edicion, permisos y reportes segun corresponda.</p>
    </div>
  </section>`;
}

function adminPage({ user, path: activePath }) {
  const normalizedPath = activePath === '/admin/' ? '/admin' : activePath;
  const activeModule = ADMIN_MODULES.find((mod) => mod.path === normalizedPath);
  const content = activeModule ? adminModulePanel(activeModule, user) : adminOverview();
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Administracion CSH</title>
<style>
  :root {
    --bg:#0a0908; --surface:#13100e; --surface-2:#1c1713; --paper:#f7f1df;
    --muted:#aa9d84; --gold:#c9a961; --red:#d62828; --line:rgba(247,241,223,.12);
  }
  * { box-sizing:border-box; }
  body { margin:0; min-height:100vh; background:var(--bg); color:var(--paper);
    font-family:Inter, Manrope, system-ui, -apple-system, Segoe UI, sans-serif; }
  .admin-shell { min-height:100vh; display:grid; grid-template-columns:280px 1fr; }
  aside { border-right:1px solid var(--line); background:#0e0c0a; padding:26px 18px; display:flex; flex-direction:column; gap:28px; }
  .brand { display:flex; align-items:center; gap:12px; color:var(--paper); text-decoration:none; }
  .brand-mark { width:42px; height:46px; display:block; object-fit:contain; filter:drop-shadow(0 8px 14px rgba(0,0,0,.35)); }
  .brand-copy strong { display:block; font-size:13px; letter-spacing:.16em; text-transform:uppercase; }
  .brand-copy span { display:block; color:var(--muted); font-size:12px; margin-top:2px; }
  nav { display:flex; flex-direction:column; gap:6px; }
  .nav-link { display:flex; flex-direction:column; gap:3px; color:var(--muted); text-decoration:none;
    padding:12px 13px; border-radius:6px; transition:background .16s ease, color .16s ease, transform .16s ease; }
  .nav-main { display:flex; align-items:center; gap:10px; min-width:0; }
  .nav-main span:last-child { font-size:14px; color:inherit; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .nav-icon { width:25px; height:25px; flex:0 0 25px; border-radius:5px; display:grid; place-items:center;
    color:var(--gold); background:rgba(201,169,97,.08); border:1px solid rgba(201,169,97,.22); }
  .nav-icon svg { width:15px; height:15px; display:block; }
  .nav-link small { color:#716957; font-size:11px; margin-left:35px; }
  .nav-link:hover, .nav-link.active { background:var(--surface-2); color:var(--paper); transform:translateX(2px); }
  .nav-link:hover .nav-icon, .nav-link.active .nav-icon { background:rgba(201,169,97,.14); border-color:rgba(201,169,97,.46); }
  .nav-link.active { box-shadow:inset 3px 0 0 var(--gold); }
  main { min-width:0; }
  .topbar { height:72px; border-bottom:1px solid var(--line); display:flex; align-items:center;
    justify-content:space-between; gap:16px; padding:0 28px; background:rgba(10,9,8,.84); position:sticky; top:0; z-index:2; }
  .topbar p { margin:0; color:var(--muted); font-size:12px; }
  .topbar strong { display:block; font-size:14px; margin-top:2px; }
  .top-actions { display:flex; align-items:center; gap:10px; flex-wrap:wrap; justify-content:flex-end; }
  .btn { min-height:38px; display:inline-flex; align-items:center; justify-content:center; border-radius:4px;
    border:1px solid var(--line); color:var(--paper); text-decoration:none; padding:0 13px; font-size:13px; }
  .btn.primary { background:var(--red); border-color:var(--red); color:white; }
  .workspace { padding:34px 28px 48px; max-width:1180px; }
  .page-head { display:flex; align-items:flex-end; justify-content:space-between; gap:18px; margin-bottom:20px; }
  .page-head p { margin:0 0 8px; color:var(--gold); letter-spacing:.16em; text-transform:uppercase; font-size:11px; }
  h1 { margin:0; font-family:Impact, Haettenschweiler, sans-serif; text-transform:uppercase; font-size:clamp(34px, 5vw, 58px); line-height:.92; letter-spacing:0; }
  .build, .state { display:inline-flex; align-items:center; min-height:28px; border-radius:999px; padding:0 11px;
    color:var(--gold); border:1px solid rgba(201,169,97,.42); background:rgba(201,169,97,.08); font-size:12px; white-space:nowrap; }
  .notice { border-left:3px solid var(--gold); background:rgba(247,241,223,.05); color:var(--muted);
    padding:14px 16px; margin-bottom:24px; max-width:820px; line-height:1.55; }
  .module-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(230px, 1fr)); gap:12px; }
  .module { min-height:170px; display:flex; flex-direction:column; justify-content:space-between; gap:18px;
    background:var(--surface); border:1px solid var(--line); border-radius:6px; padding:18px;
    color:var(--paper); text-decoration:none; transition:transform .16s ease, border-color .16s ease, background .16s ease; }
  .module:hover { transform:translateY(-2px); border-color:rgba(201,169,97,.55); background:#19140f; }
  .module-top { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
  .module-icon { width:46px; height:46px; border-radius:6px; display:grid; place-items:center; flex:0 0 46px;
    color:var(--gold); border:1px solid rgba(201,169,97,.38); background:rgba(201,169,97,.08);
    transition:background .16s ease, border-color .16s ease, transform .16s ease; }
  .module-icon svg { width:24px; height:24px; display:block; }
  .module:hover .module-icon { background:rgba(214,40,40,.14); border-color:rgba(201,169,97,.62); transform:translateY(-1px); }
  .module-eyebrow { color:var(--muted); font-size:12px; line-height:1.35; text-align:right; max-width:150px; }
  .module-body { display:flex; flex-direction:column; gap:18px; }
  .module strong { font-size:18px; line-height:1.15; }
  .module em { font-style:normal; color:var(--gold); font-size:12px; }
  .empty-state { margin-top:24px; min-height:280px; border:1px dashed rgba(201,169,97,.36);
    display:grid; place-items:center; text-align:center; padding:36px; background:linear-gradient(145deg, rgba(214,40,40,.08), rgba(201,169,97,.04)); }
  .empty-state img { width:64px; height:auto; display:block; margin:0 auto 18px; filter:drop-shadow(0 10px 18px rgba(0,0,0,.35)); }
  .empty-state h2 { margin:0 0 8px; font-size:22px; }
  .empty-state p { margin:0; color:var(--muted); max-width:520px; line-height:1.5; }
  .table-wrap { overflow:auto; border:1px solid var(--line); border-radius:6px; background:var(--surface); margin:22px 0; }
  table { width:100%; border-collapse:collapse; min-width:720px; }
  th, td { text-align:left; padding:14px 16px; border-bottom:1px solid var(--line); font-size:14px; }
  th { color:var(--gold); font-size:11px; letter-spacing:.14em; text-transform:uppercase; background:#100d0b; }
  td { color:var(--paper); }
  tr:last-child td { border-bottom:0; }
  @media (max-width:860px) {
    .admin-shell { grid-template-columns:1fr; }
    aside { position:static; border-right:0; border-bottom:1px solid var(--line); }
    nav { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); }
    .topbar { height:auto; min-height:72px; align-items:flex-start; padding:18px; flex-direction:column; }
    .top-actions { justify-content:flex-start; }
    .workspace { padding:28px 18px 38px; }
    .page-head { align-items:flex-start; flex-direction:column; }
  }
</style>
</head>
<body>
  <div class="admin-shell">
    <aside>
      <a class="brand" href="/admin">
        <img class="brand-mark" src="${ADMIN_LOGO_PATH}" alt="Escudo Club Sport Herediano">
        <span class="brand-copy"><strong>Herediano</strong><span>Admin demo</span></span>
      </a>
      ${adminNav(normalizedPath)}
    </aside>
    <main>
      <header class="topbar">
        <div>
          <p>Sesion administrativa</p>
          <strong>${escapeHtml(user.name)} · ${escapeHtml(user.role)}</strong>
        </div>
        <div class="top-actions">
          <a class="btn" href="/">Ver sitio</a>
          <a class="btn primary" href="/admin/logout">Salir</a>
        </div>
      </header>
      ${content}
    </main>
  </div>
</body>
</html>`;
}

function sendHtml(res, status, html, extraHeaders = {}) {
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    ...extraHeaders,
  });
  res.end(html);
}

// ── Proxy / caché ───────────────────────────────────────────────────────────
function rewrite(buf, ct) {
  if (!isText(ct)) return buf;
  let s = buf.toString('utf8');
  s = s.split('https://www.herediano.com').join('');
  s = s.split('https://herediano.com').join('');
  s = s.split('http://www.herediano.com').join('');
  return Buffer.from(s, 'utf8');
}

function decorateSiteHtml(buf, ct) {
  if (!/text\/html/i.test(ct || '')) return buf;
  let s = buf.toString('utf8');
  if (s.includes('csh-admin-signin')) return buf;

  const style = `<style id="csh-admin-nav-style">
    .csh-admin-signin{font-family:Oswald,sans-serif;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--csh-paper,#f7f1df);text-decoration:none;border:1px solid rgba(201,169,97,.45);background:rgba(201,169,97,.08);height:38px;padding:0 14px;display:inline-flex;align-items:center;justify-content:center;border-radius:2px;white-space:nowrap;transition:background 160ms ease,border-color 160ms ease,color 160ms ease}
    .csh-admin-signin-nav{background:#D62828;border-color:#D62828;color:#fff;padding:0 16px}
    .csh-admin-signin:hover{background:rgba(214,40,40,.24);border-color:rgba(214,40,40,.7);color:#fff}
    .csh-admin-signin-nav:hover{background:#b91d1d;border-color:#b91d1d}
    .csh-admin-signin-mobile{display:none}
    .csh-parqueo-link{font-family:Oswald,sans-serif;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--csh-paper,#f7f1df);text-decoration:none;height:38px;padding:0 10px;display:inline-flex;align-items:center;white-space:nowrap;transition:color 160ms ease}
    .csh-parqueo-link:hover{color:#c9a961}
    .csh-parqueo-mobile{display:none}
    @media(max-width:860px){.csh-admin-signin-nav{display:none}.csh-admin-signin-mobile{display:inline-flex}.csh-parqueo-nav{display:none}.csh-parqueo-mobile{display:inline-flex}}
    @media(max-width:560px){.csh-admin-signin{height:34px;padding:0 10px;font-size:10px;letter-spacing:.12em}}
  </style>`;
  if (s.includes('</head>')) s = s.replace('</head>', `${style}</head>`);

  const navSignIn = '<a class="csh-parqueo-link csh-parqueo-nav" data-csh-parqueo="nav" href="/parqueo">Parqueo</a><a class="csh-admin-signin csh-admin-signin-nav" href="/admin/sign-in">Sign in</a>';
  const mobileSignIn = '<a class="csh-parqueo-link csh-parqueo-mobile" data-csh-parqueo="mobile" href="/parqueo">Parqueo</a><a class="csh-admin-signin csh-admin-signin-mobile" href="/admin/sign-in">Sign in</a>';
  const script = `<script id="csh-admin-nav-script">
    (() => {
      const href = '/admin/sign-in';
      const label = 'Sign in';
      const makeLink = (kind) => {
        const a = document.createElement('a');
        a.href = href;
        a.textContent = label;
        a.dataset.cshAdminSignin = kind;
        a.className = 'csh-admin-signin ' + (kind === 'nav' ? 'csh-admin-signin-nav' : 'csh-admin-signin-mobile');
        return a;
      };
      const makeParqueo = (kind) => {
        const a = document.createElement('a');
        a.href = '/parqueo';
        a.textContent = 'Parqueo';
        a.dataset.cshParqueo = kind;
        a.className = 'csh-parqueo-link ' + (kind === 'nav' ? 'csh-parqueo-nav' : 'csh-parqueo-mobile');
        return a;
      };
      const ensure = () => {
        const header = document.querySelector('header');
        if (!header) return;
        const nav = header.querySelector('nav.csh-nav-desktop, nav');
        if (nav && !nav.querySelector('[data-csh-parqueo="nav"]')) {
          nav.appendChild(makeParqueo('nav'));
        }
        if (nav && !nav.querySelector('[data-csh-admin-signin="nav"]')) {
          nav.appendChild(makeLink('nav'));
        }
        const actions = Array.from(header.querySelectorAll('div')).find((el) => {
          const style = el.getAttribute('style') || '';
          return style.includes('margin-left:auto') && style.includes('display:flex');
        });
        if (actions && !actions.querySelector('[data-csh-admin-signin="mobile"]')) {
          actions.insertBefore(makeLink('mobile'), actions.firstChild);
        }
        if (actions && !actions.querySelector('[data-csh-parqueo="mobile"]')) {
          actions.insertBefore(makeParqueo('mobile'), actions.firstChild);
        }
      };
      ensure();
      document.addEventListener('DOMContentLoaded', ensure);
      window.addEventListener('load', ensure);
      let scheduled = false;
      new MutationObserver(() => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => { scheduled = false; ensure(); });
      }).observe(document.documentElement, { childList: true, subtree: true });
    })();
  </script>`;
  const navClose = '</nav><div style="margin-left:auto';
  const passline = '<a href="https://www.passline.com/sitio/11954967-herediano"';
  if (s.includes(navClose)) {
    s = s.replace(navClose, `${navSignIn}</nav><div style="margin-left:auto`);
  } else if (s.includes(passline)) {
    s = s.replace(passline, `${navSignIn}${passline}`);
  }

  if (s.includes(passline)) {
    s = s.replace(passline, `${mobileSignIn}${passline}`);
  } else if (s.includes('</header>')) {
    s = s.replace('</header>', `${mobileSignIn}</header>`);
  }
  if (s.includes('</body>')) s = s.replace('</body>', `${script}</body>`);
  return Buffer.from(s, 'utf8');
}

function readCache(key) {
  const dataPath = path.join(CACHE_DIR, key);
  const metaPath = dataPath + '.meta';
  if (fs.existsSync(dataPath) && fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      return { body: fs.readFileSync(dataPath), meta };
    } catch (_) { return null; }
  }
  return null;
}

function writeCache(key, body, meta) {
  const dataPath = path.join(CACHE_DIR, key);
  fs.writeFileSync(dataPath, body);
  fs.writeFileSync(dataPath + '.meta', JSON.stringify(meta));
}

async function fetchOrigin(reqUrl) {
  const target = ORIGIN + reqUrl;
  const r = await fetch(target, {
    headers: { 'user-agent': UA, 'accept': '*/*' },
    redirect: 'follow',
  });
  const ct = r.headers.get('content-type') || 'application/octet-stream';
  let body = Buffer.from(await r.arrayBuffer());
  body = rewrite(body, ct);
  return { body, meta: { status: r.status, ct } };
}

async function serveAdminLogo(req, res) {
  if (req.method !== 'GET') { res.writeHead(405); return res.end('Metodo no permitido'); }
  const key = keyFor(SITE_LOGO_PATH);
  let entry = readCache(key);
  if (!entry) {
    try {
      const fresh = await fetchOrigin(SITE_LOGO_PATH);
      writeCache(key, fresh.body, fresh.meta);
      entry = { body: fresh.body, meta: fresh.meta };
    } catch (e) {
      console.error('ERR   ' + SITE_LOGO_PATH + ' :: ' + e.message);
      res.writeHead(502); return res.end('Error al obtener escudo');
    }
  }
  res.writeHead(entry.meta.status || 200, {
    'content-type': entry.meta.ct || 'image/png',
    'cache-control': 'public, max-age=86400',
  });
  res.end(entry.body);
}

async function serveProxy(req, res) {
  if (req.method !== 'GET') { res.writeHead(405); return res.end('Método no permitido'); }
  const reqUrl = req.url;
  const key = keyFor(reqUrl);

  let entry = readCache(key);
  if (!entry) {
    try {
      const fresh = await fetchOrigin(reqUrl);
      writeCache(key, fresh.body, fresh.meta);
      entry = { body: fresh.body, meta: fresh.meta };
      console.log('MISS  ' + reqUrl);
    } catch (e) {
      console.error('ERR   ' + reqUrl + ' :: ' + e.message);
      res.writeHead(502); return res.end('Error al obtener del origen');
    }
  } else {
    console.log('HIT   ' + reqUrl);
  }

  const { body, meta } = entry;
  const responseBody = decorateSiteHtml(body, meta.ct);
  const isHtml = /text\/html/i.test(meta.ct || '');
  const headers = {
    'content-type': meta.ct,
    'cache-control': isHtml ? 'no-store, max-age=0' : 'public, max-age=3600',
  };
  if (isHtml) headers.pragma = 'no-cache';
  const ae = req.headers['accept-encoding'] || '';
  if (/gzip/.test(ae) && isText(meta.ct)) {
    const gz = zlib.gzipSync(responseBody);
    headers['content-encoding'] = 'gzip';
    res.writeHead(meta.status || 200, headers);
    return res.end(gz);
  }
  res.writeHead(meta.status || 200, headers);
  res.end(responseBody);
}

// ── Servidor ────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0];
  const requestUrl = new URL(req.url, 'http://local');

  if (urlPath === ADMIN_LOGO_PATH) {
    return serveAdminLogo(req, res);
  }

  // Rutas de autenticación
  if (urlPath === '/__login') {
    const next = safeNext(requestUrl.searchParams.get('next'));
    if (req.method === 'GET') return sendHtml(res, 200, loginPage({ next }));
    if (req.method === 'POST') {
      const body = await readBody(req);
      const form = new URLSearchParams(body);
      if (checkCreds(form.get('usuario') || '', form.get('clave') || '')) {
        res.writeHead(302, { 'set-cookie': sessionCookie(req), location: next });
        return res.end();
      }
      return sendHtml(res, 401, loginPage({
        error: 'Usuario o contraseña incorrectos.',
        next,
      }));
    }
    res.writeHead(405); return res.end();
  }
  if (urlPath === '/__logout') {
    res.writeHead(302, {
      'set-cookie': clearSessionCookie(req),
      location: '/__login',
    });
    return res.end();
  }

  if (urlPath === '/admin/sign-in') {
    const next = safeAdminNext(requestUrl.searchParams.get('next'));
    const adminUser = validAdminToken(parseCookies(req.headers.cookie)[ADMIN_COOKIE]);
    if (req.method === 'GET') {
      if (adminUser) {
        res.writeHead(302, { location: next });
        return res.end();
      }
      return sendHtml(res, 200, adminLoginPage({ next }));
    }
    if (req.method === 'POST') {
      const body = await readBody(req);
      const form = new URLSearchParams(body);
      const user = findAdminUser(form.get('usuario') || '', form.get('clave') || '');
      if (user) {
        res.writeHead(302, { 'set-cookie': adminSessionCookie(req, user), location: next });
        return res.end();
      }
      return sendHtml(res, 401, adminLoginPage({
        error: 'Usuario o contrasena incorrectos.',
        next,
      }));
    }
    res.writeHead(405); return res.end();
  }

  if (urlPath === '/admin/logout') {
    res.writeHead(302, {
      'set-cookie': clearAdminSessionCookie(req),
      location: '/admin/sign-in',
    });
    return res.end();
  }

  if (urlPath.startsWith(ADMIN_USERS_API)) {
    const user = validAdminToken(parseCookies(req.headers.cookie)[ADMIN_COOKIE]);
    if (!user) return sendJson(res, 401, { ok: false, error: 'No autenticado' });
    return handleAdminUsersApi(req, res, urlPath, user);
  }

  if (urlPath.startsWith(PARQUEO_API)) {
    const user = validAdminToken(parseCookies(req.headers.cookie)[ADMIN_COOKIE]);
    if (!user) return sendJson(res, 401, { ok: false, error: 'No autenticado' });
    return handleParqueoApi(req, res, urlPath, requestUrl, user);
  }

  if (urlPath === '/admin' || urlPath.startsWith('/admin/')) {
    if (req.method !== 'GET') { res.writeHead(405); return res.end('Metodo no permitido'); }
    const user = validAdminToken(parseCookies(req.headers.cookie)[ADMIN_COOKIE]);
    if (!user) {
      const next = encodeURIComponent(req.url || '/admin');
      res.writeHead(302, { location: `/admin/sign-in?next=${next}`, 'cache-control': 'no-store' });
      return res.end();
    }
    return sendHtml(res, 200, adminPage({ user, path: urlPath }));
  }

  // Parqueo publico: unico modulo accesible para el invitado anonimo, sin
  // login del sitio. Solo consulta disponibilidad y paga (no reserva).
  if (urlPath === '/parqueo') {
    if (req.method !== 'GET') { res.writeHead(405); return res.end('Metodo no permitido'); }
    return sendHtml(res, 200, parqueoPublicoHtml());
  }
  if (urlPath.startsWith(PARQUEO_API_PUBLICA)) {
    return handleParqueoPublico(req, res, urlPath, requestUrl);
  }

  // Loopback (warm.js) o sesión válida -> sirve el sitio
  const authed = isLoopback(req) || validToken(parseCookies(req.headers.cookie)[COOKIE]);
  if (!authed) {
    const next = encodeURIComponent(req.url || '/');
    res.writeHead(302, { location: `/__login?next=${next}`, 'cache-control': 'no-store' });
    return res.end();
  }

  return serveProxy(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Réplica herediano (con login) corriendo en http://${HOST}:${PORT}`);
});
