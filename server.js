'use strict';

require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const zlib = require('zlib');
const nodemailer = require('nodemailer');
const QRCodeNode = require('qrcode');
const { Pool } = require('pg');

const ORIGIN = 'https://www.herediano.com';
const PORT = Number(process.env.PORT || 8088);
const HOST = '0.0.0.0';
const CACHE_DIR = path.join(__dirname, 'cache');
const DATA_DIR = path.join(__dirname, 'data');
const PARQUEO_FILE = path.join(DATA_DIR, 'parqueo.json');
const CUPONERA_FILE = path.join(DATA_DIR, 'cuponera.json');
const WEB_FILE = path.join(DATA_DIR, 'web.json');
const HERO_IMG_FILE = path.join(DATA_DIR, 'hero-bg.bin');
const ADMIN_LOGO_PATH = '/admin/assets/logo-shield.png';
const SITE_LOGO_PATH = '/brand/logo-shield.png';
const SECRET = process.env.HEREDIANO_SECRET || 'cambie-esta-clave-herediano-secret-2026';
const COOKIE = 'hsid';
const ADMIN_COOKIE = 'csh_admin';
const SESSION_HOURS = Number(process.env.HEREDIANO_SESSION_HOURS || 12);
const ADMIN_SESSION_HOURS = Number(process.env.HEREDIANO_ADMIN_SESSION_HOURS || 8);
const AUTH_USER = process.env.HEREDIANO_USER || 'admin';
const AUTH_PASS = process.env.HEREDIANO_PASS || 'herediano2026';
const MAIL_FROM = process.env.HEREDIANO_MAIL_FROM || '"Club Sport Herediano" <herediano@milocalhost.work>';
const MAIL_APP_URL = process.env.HEREDIANO_APP_URL || 'https://herediano.milocalhost.work';
const SMTP_HOST = process.env.HEREDIANO_SMTP_HOST || process.env.SMTP_HOST || '127.0.0.1';
const SMTP_PORT = Number(process.env.HEREDIANO_SMTP_PORT || process.env.SMTP_PORT || 1587);
const SMTP_SECURE = String(process.env.HEREDIANO_SMTP_SECURE || process.env.SMTP_SECURE || '').toLowerCase() === 'true';
const SMTP_USER = process.env.HEREDIANO_SMTP_USER || process.env.SMTP_USER || '';
const SMTP_PASS = process.env.HEREDIANO_SMTP_PASS || process.env.SMTP_PASS || '';
const TARIFA_HORA = 1000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36';

const OFFICIAL_SPONSORS = [
  { name: 'Reebok', path: '/brand/sponsors/reebok.png', cid: 'sponsor-reebok', height: 42 },
  { name: 'Taqueritos', path: '/brand/sponsors/taqueritos.png', cid: 'sponsor-taqueritos', height: 34 },
  { name: 'Hariana', path: '/brand/sponsors/hariana.png', cid: 'sponsor-hariana', height: 34 },
  { name: 'Transcomer British International', path: '/brand/sponsors/transcomer.png', cid: 'sponsor-transcomer', height: 34 },
  { name: 'Electrolit', path: '/brand/sponsors/electrolit.png', cid: 'sponsor-electrolit', height: 34 },
  { name: 'Chery', path: '/brand/sponsors/chery.png', cid: 'sponsor-chery', height: 34 },
  { name: 'Solo Cracks', path: '/brand/partner-solocracks.png', cid: 'sponsor-solocracks', height: 34 },
];

const ADMIN_USERS = [
  { id: 'u-001', name: 'Administrador CSH', username: process.env.HEREDIANO_ADMIN_USER || 'admin', email: process.env.HEREDIANO_ADMIN_EMAIL || 'admin@herediano.com', password: process.env.HEREDIANO_ADMIN_PASS || AUTH_PASS, role: 'Super admin', area: 'Administracion', status: 'Activo', parkingRole: 'admin', couponRole: 'admin' },
  { id: 'u-002', name: 'Operaciones Estadio', username: 'operaciones', email: 'operaciones@herediano.com', password: 'operaciones1921', role: 'Operador', area: 'Parqueo', status: 'Demo', parkingRole: 'admin', couponRole: 'socio' },
  { id: 'u-003', name: 'Comercial CSH', username: 'comercial', email: 'comercial@herediano.com', password: 'comercial1921', role: 'Patrocinador', area: 'Patrocinadores', status: 'Demo', parkingRole: 'socio', couponRole: 'patrocinador', sponsor: 'Reebok' },
  { id: 'u-004', name: 'Socio Demo', username: 'socio1', email: 'socio1@herediano.com', password: 'socio1921', role: 'Socio', area: 'Socios', status: 'Demo', parkingRole: 'socio', couponRole: 'socio' },
];

fs.mkdirSync(CACHE_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });
const USE_DB = Boolean(process.env.DATABASE_URL);
const pool = USE_DB ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function safeEqual(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  return left.length === right.length && crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
}
function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}
function isHttps(req) {
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  return proto === 'https' || req.secure;
}
function sign(exp) {
  return crypto.createHmac('sha256', SECRET).update(String(exp)).digest('hex');
}
function makeToken() {
  const exp = Date.now() + SESSION_HOURS * 3600 * 1000;
  return `${exp}.${sign(exp)}`;
}
function validToken(tok) {
  if (!tok || !tok.includes('.')) return false;
  const [expStr, mac] = tok.split('.');
  const exp = Number(expStr);
  if (!exp || exp < Date.now()) return false;
  const good = sign(exp);
  return mac.length === good.length && crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(good));
}
function adminSign(exp, userId) {
  return crypto.createHmac('sha256', SECRET).update(`admin:${exp}:${userId}`).digest('hex');
}
function makeAdminToken(user) {
  const exp = Date.now() + ADMIN_SESSION_HOURS * 3600 * 1000;
  return `${exp}.${user.id}.${adminSign(exp, user.id)}`;
}
function validAdminToken(tok) {
  if (!tok || tok.split('.').length !== 3) return null;
  const [expStr, userId, mac] = tok.split('.');
  const exp = Number(expStr);
  if (!exp || exp < Date.now()) return null;
  const user = ADMIN_USERS.find((u) => u.id === userId);
  if (!user) return null;
  const good = adminSign(exp, userId);
  return mac.length === good.length && crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(good)) ? user : null;
}
function cookieAttrs(req, name, value, maxAge, pathValue) {
  const attrs = [`${name}=${value}`, 'HttpOnly', `Path=${pathValue}`, 'SameSite=Lax', `Max-Age=${maxAge}`];
  if (isHttps(req)) attrs.push('Secure');
  return attrs.join('; ');
}
function safeNext(value, prefix = '/') {
  const next = String(value || prefix);
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\') || /[\r\n]/.test(next)) return prefix;
  return next;
}
function findAdminUser(login, password) {
  const needle = String(login || '').trim().toLowerCase();
  return ADMIN_USERS.find((u) => (u.username.toLowerCase() === needle || u.email.toLowerCase() === needle) && safeEqual(password, u.password)) || null;
}
function requireAdmin(req, res, next) {
  const user = validAdminToken(parseCookies(req.headers.cookie)[ADMIN_COOKIE]);
  if (!user) return res.status(401).json({ ok: false, error: 'No autenticado' });
  req.adminUser = user;
  return next();
}
function canManageCoupons(user) {
  return user && (user.couponRole === 'admin' || user.couponRole === 'patrocinador');
}

async function query(sql, params) {
  const result = await pool.query(sql, params);
  return result.rows;
}
function readParkingData() {
  if (!fs.existsSync(PARQUEO_FILE)) {
    const initial = initParqueoJsonShape();
    writeParkingData(initial);
    return initial;
  }
  try {
    const data = JSON.parse(fs.readFileSync(PARQUEO_FILE, 'utf8'));
    return {
      espacios: Array.isArray(data.espacios) ? data.espacios : [],
      reservas: Array.isArray(data.reservas) ? data.reservas : [],
      eventos: Array.isArray(data.eventos) ? data.eventos : [],
    };
  } catch (_) {
    const initial = initParqueoJsonShape();
    writeParkingData(initial);
    return initial;
  }
}
function writeParkingData(data) {
  fs.writeFileSync(PARQUEO_FILE, `${JSON.stringify(data, null, 2)}\n`);
}
function initCuponeraJsonShape() {
  const offers = ['20% en articulo seleccionado', '2x1 en combo familiar', '15% pagando con tarjeta CSH', 'Upgrade gratis', '10% en tienda oficial', 'Bebida gratis', 'Envio sin costo'];
  const categories = ['Indumentaria', 'Alimentos', 'Finanzas', 'Hidratacion', 'Automotriz', 'Entretenimiento'];
  return {
    cupones: OFFICIAL_SPONSORS.map((s, index) => ({
      id: `CUP-${String(index + 1).padStart(3, '0')}`,
      proveedor: s.name,
      logo: s.path,
      titulo: offers[index % offers.length],
      descripcion: `Beneficio demo para socios CSH con ${s.name}.`,
      codigo: `CSH${String(s.name).replace(/\W/g, '').slice(0, 4).toUpperCase()}${10 + index}`,
      categoria: categories[index % categories.length],
      descuento: [20, 25, 15, 30, 10, 12, 18][index % 7],
      vigencia: new Date(Date.now() + (index + 14) * 86400000).toISOString(),
      estado: index === 2 ? 'retirado' : 'habilitado',
      usos: 40 + index * 9,
      limite: 120 + index * 20,
      actualizado: new Date().toISOString(),
    })),
    eventos: [],
  };
}
function readCuponeraData() {
  if (!fs.existsSync(CUPONERA_FILE)) {
    const initial = initCuponeraJsonShape();
    writeCuponeraData(initial);
    return initial;
  }
  try {
    const data = JSON.parse(fs.readFileSync(CUPONERA_FILE, 'utf8'));
    return {
      cupones: Array.isArray(data.cupones) ? data.cupones : [],
      eventos: Array.isArray(data.eventos) ? data.eventos : [],
    };
  } catch (_) {
    const initial = initCuponeraJsonShape();
    writeCuponeraData(initial);
    return initial;
  }
}
function writeCuponeraData(data) {
  fs.writeFileSync(CUPONERA_FILE, `${JSON.stringify(data, null, 2)}\n`);
}
function publicCoupon(cupon) {
  return {
    id: cupon.id,
    proveedor: cupon.proveedor,
    logo: cupon.logo,
    titulo: cupon.titulo,
    descripcion: cupon.descripcion,
    codigo: cupon.codigo,
    categoria: cupon.categoria,
    descuento: cupon.descuento,
    vigencia: cupon.vigencia,
    estado: cupon.estado,
    usos: cupon.usos,
    limite: cupon.limite,
    actualizado: cupon.actualizado,
  };
}
function couponStats(cupones) {
  const enabled = cupones.filter((c) => c.estado === 'habilitado').length;
  return { total: cupones.length, habilitados: enabled, retirados: cupones.length - enabled, usos: cupones.reduce((sum, c) => sum + Number(c.usos || 0), 0) };
}
function activeReservations(data) {
  return data.reservas.filter((r) => r.estado === 'reservado' || r.estado === 'ocupado');
}
function nextJsonReservationId(data) {
  const max = data.reservas.reduce((n, r) => Math.max(n, Number(String(r.id || '').replace(/\D/g, '')) || 0), 0);
  return `R-${String(max + 1).padStart(3, '0')}`;
}
function nextJsonEventId(data) {
  const max = data.eventos.reduce((n, e) => Math.max(n, Number(String(e.id || '').replace(/\D/g, '')) || 0), 0);
  return `E-${String(max + 1).padStart(3, '0')}`;
}
function pushJsonEvent(data, type, { espacioId, user, placa, notas }) {
  data.eventos.push({
    id: nextJsonEventId(data),
    tipo: type,
    espacioId: espacioId || '',
    userId: user ? user.id : null,
    userName: user ? user.name : '',
    placa: placa || '',
    timestamp: new Date().toISOString(),
    notas: notas || '',
  });
}
function publicSpacesFromJson(data) {
  const reservations = new Map(activeReservations(data).map((r) => [r.id, r]));
  return data.espacios
    .slice()
    .sort((a, b) => a.piso - b.piso || String(a.zona).localeCompare(String(b.zona)) || a.num - b.num)
    .map((s) => {
      const reserva = reservations.get(s.reservaId);
      return { id: s.id, piso: s.piso, zona: s.zona, num: s.num, estado: s.estado, reserva: reserva ? { inicio: reserva.inicio, fin: reserva.fin } : null };
    });
}
function getJsonActiveReservationByPlate(data, plate) {
  return activeReservations(data).filter((r) => r.placa === plate).sort((a, b) => new Date(b.inicio) - new Date(a.inicio))[0] || null;
}
function getJsonActiveReservationById(data, id) {
  return activeReservations(data).find((r) => r.id === id) || null;
}
async function initDb() {
  if (!USE_DB) {
    readParkingData();
    return;
  }
  await pool.query(`
    create table if not exists parking_spaces (
      id text primary key,
      floor integer not null,
      zone text not null,
      num integer not null,
      type text not null default 'regular',
      status text not null default 'disponible',
      reservation_id text
    );
    create table if not exists parking_reservations (
      id text primary key,
      space_id text not null references parking_spaces(id),
      user_id text,
      user_name text not null,
      plate text not null,
      role text not null,
      status text not null,
      starts_at timestamptz not null,
      ends_at timestamptz not null,
      code text not null,
      qr_data text not null,
      email_qr text,
      payment jsonb
    );
    create table if not exists parking_events (
      id bigserial primary key,
      type text not null,
      space_id text,
      user_id text,
      user_name text,
      plate text,
      notes text,
      created_at timestamptz not null default now()
    );
    create table if not exists admin_passwords (
      user_id text primary key,
      password text not null,
      updated_at timestamptz not null default now()
    );
  `);
  await applyPasswordOverrides();
  const count = Number((await query('select count(*)::int as count from parking_spaces'))[0].count);
  if (count === 0) await seedParking();
}
async function applyPasswordOverrides() {
  if (!USE_DB) return;
  const rows = await query('select user_id, password from admin_passwords');
  for (const row of rows) {
    const user = ADMIN_USERS.find((u) => u.id === row.user_id);
    if (user) user.password = row.password;
  }
}
async function setAdminUserPassword(userId, password) {
  if (!USE_DB) {
    const user = ADMIN_USERS.find((u) => u.id === userId);
    if (user) user.password = password;
    return;
  }
  await pool.query(`
    insert into admin_passwords (user_id, password, updated_at)
    values ($1, $2, now())
    on conflict (user_id) do update set password = excluded.password, updated_at = now()
  `, [userId, password]);
  const user = ADMIN_USERS.find((u) => u.id === userId);
  if (user) user.password = password;
}
function initParqueoJsonShape() {
  const espacios = [];
  for (const floor of [1, 2]) {
    for (const zone of ['A', 'B']) {
      for (let num = 1; num <= 100; num++) {
        espacios.push({ id: `P${floor}-${zone}${String(num).padStart(3, '0')}`, piso: floor, zona: zone, num, tipo: 'regular', estado: 'disponible', reservaId: null });
      }
    }
  }
  return { espacios, reservas: [], eventos: [] };
}
async function seedParking() {
  let data = initParqueoJsonShape();
  if (fs.existsSync(PARQUEO_FILE)) {
    try { data = JSON.parse(fs.readFileSync(PARQUEO_FILE, 'utf8')); }
    catch (_) {}
  }
  const client = await pool.connect();
  try {
    await client.query('begin');
    for (const e of data.espacios || []) {
      await client.query(
        'insert into parking_spaces (id, floor, zone, num, type, status, reservation_id) values ($1,$2,$3,$4,$5,$6,$7) on conflict do nothing',
        [e.id, e.piso || e.floor, e.zona || e.zone, e.num, e.tipo || e.type || 'regular', e.estado || e.status || 'disponible', e.reservaId || e.reservation_id || null],
      );
    }
    for (const r of data.reservas || []) {
      await client.query(
        `insert into parking_reservations (id, space_id, user_id, user_name, plate, role, status, starts_at, ends_at, code, qr_data, email_qr, payment)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) on conflict do nothing`,
        [r.id, r.espacioId, r.userId || null, r.userName || 'Invitado', r.placa, r.rol || 'invitado', r.estado, r.inicio, r.fin, r.codigo || `CSH-${r.id}`, r.qrData || '', r.emailQr || null, r.pago ? JSON.stringify(r.pago) : null],
      );
    }
    for (const e of data.eventos || []) {
      await client.query(
        'insert into parking_events (type, space_id, user_id, user_name, plate, notes, created_at) values ($1,$2,$3,$4,$5,$6,$7)',
        [e.tipo, e.espacioId || null, e.userId || null, e.userName || '', e.placa || '', e.notas || '', e.timestamp || new Date().toISOString()],
      );
    }
    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}
async function nextReservationId(client = pool) {
  const rows = await client.query("select coalesce(max(nullif(regexp_replace(id, '\\D', '', 'g'), '')::int), 0) + 1 as next from parking_reservations");
  return `R-${String(Number(rows.rows[0].next)).padStart(3, '0')}`;
}
async function logEvento(client, type, { espacioId, user, placa, notas }) {
  await client.query(
    'insert into parking_events (type, space_id, user_id, user_name, plate, notes) values ($1,$2,$3,$4,$5,$6)',
    [type, espacioId || '', user ? user.id : null, user ? user.name : '', placa || '', notas || ''],
  );
}
const activeWhere = "status in ('reservado','ocupado')";
function toSpace(row) {
  return { id: row.id, piso: row.floor, zona: row.zone, num: row.num, tipo: row.type, estado: row.status, reservaId: row.reservation_id };
}
function toReservation(row) {
  return {
    id: row.id, espacioId: row.space_id, userId: row.user_id, userName: row.user_name,
    placa: row.plate, rol: row.role, estado: row.status, inicio: row.starts_at.toISOString(),
    fin: row.ends_at.toISOString(), codigo: row.code, qrData: row.qr_data, emailQr: row.email_qr,
    pago: row.payment || null,
  };
}
async function getActiveReservationByPlate(plate) {
  if (!USE_DB) return getJsonActiveReservationByPlate(readParkingData(), plate);
  const rows = await query(`select * from parking_reservations where ${activeWhere} and plate = $1 order by starts_at desc limit 1`, [plate]);
  return rows[0] ? toReservation(rows[0]) : null;
}
async function getActiveReservationById(id) {
  if (!USE_DB) return getJsonActiveReservationById(readParkingData(), id);
  const rows = await query(`select * from parking_reservations where ${activeWhere} and id = $1 limit 1`, [id]);
  return rows[0] ? toReservation(rows[0]) : null;
}
function reservaEmail(reserva) {
  const owner = ADMIN_USERS.find((user) => user.id === reserva.userId);
  return String(reserva.emailQr || (owner && owner.email) || '').trim().toLowerCase();
}
function maskedReservaEmail(reserva) {
  const email = reservaEmail(reserva);
  const at = email.indexOf('@');
  if (at <= 0 || at === email.length - 1) return 'Sin correo asociado';
  return `${email.slice(0, Math.min(3, at))}***@${email.slice(at + 1)}`;
}
function montoDe(reserva) {
  const ms = Date.now() - new Date(reserva.inicio).getTime();
  const horas = Math.max(1, Math.ceil(ms / 3600000));
  return { horas, monto: horas * TARIFA_HORA };
}
function ensureReservaQrData(reserva) {
  if (!reserva.codigo) reserva.codigo = `CSH-${reserva.id}`;
  if (!reserva.qrData) reserva.qrData = `${reserva.codigo}|${reserva.espacioId}|${reserva.placa}|${reserva.fin}`;
  return reserva.qrData;
}

function keyFor(url) {
  return crypto.createHash('sha1').update(url).digest('hex');
}
function readCache(key) {
  const dataPath = path.join(CACHE_DIR, key);
  const metaPath = `${dataPath}.meta`;
  if (!fs.existsSync(dataPath) || !fs.existsSync(metaPath)) return null;
  try { return { body: fs.readFileSync(dataPath), meta: JSON.parse(fs.readFileSync(metaPath, 'utf8')) }; }
  catch (_) { return null; }
}
function writeCache(key, body, meta) {
  const dataPath = path.join(CACHE_DIR, key);
  fs.writeFileSync(dataPath, body);
  fs.writeFileSync(`${dataPath}.meta`, JSON.stringify(meta));
}
function rewrite(buf, ct) {
  if (!/text\/|javascript|json|xml|svg/i.test(ct || '')) return buf;
  return Buffer.from(buf.toString('utf8')
    .split('https://www.herediano.com').join('')
    .split('https://herediano.com').join('')
    .split('http://www.herediano.com').join(''), 'utf8');
}
async function fetchOrigin(reqUrl) {
  const response = await fetch(ORIGIN + reqUrl, { headers: { 'user-agent': UA, accept: '*/*' }, redirect: 'follow' });
  const ct = response.headers.get('content-type') || 'application/octet-stream';
  return { body: rewrite(Buffer.from(await response.arrayBuffer()), ct), meta: { status: response.status, ct } };
}
async function getCachedAsset(reqPath) {
  const key = keyFor(reqPath);
  let entry = readCache(key);
  if (!entry) {
    const fresh = await fetchOrigin(reqPath);
    writeCache(key, fresh.body, fresh.meta);
    entry = { body: fresh.body, meta: fresh.meta };
  }
  return entry;
}
async function getInlineAssetAttachment({ reqPath, cid, filename }) {
  try {
    const entry = await getCachedAsset(reqPath);
    return { filename, content: entry.body, contentType: entry.meta.ct || 'image/png', cid, contentDisposition: 'inline' };
  } catch (err) {
    console.error(`[mail] No se pudo cargar asset ${reqPath}: ${err.message}`);
    return null;
  }
}
function makeMailTransport() {
  const config = { host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_SECURE, tls: { rejectUnauthorized: false } };
  if (SMTP_USER || SMTP_PASS) config.auth = { user: SMTP_USER, pass: SMTP_PASS };
  return nodemailer.createTransport(config);
}
function fmtMailDate(iso) {
  return new Date(iso).toLocaleString('es-CR', { timeZone: 'America/Costa_Rica', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function sponsorHtml() {
  return OFFICIAL_SPONSORS.map((s) => `<span style="display:inline-block;vertical-align:middle;margin:6px 8px;padding:8px 10px;border:1px solid rgba(201,169,97,.35);border-radius:6px;background:#f7f1df"><img src="cid:${s.cid}" height="${s.height}" alt="${escapeHtml(s.name)}" style="display:block;max-width:118px;width:auto;height:${s.height}px;object-fit:contain"></span>`).join('');
}
function emailShell(title, kicker, body) {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#0a0908;padding:24px;font-family:Inter,Manrope,Arial,sans-serif;color:#f7f1df"><div style="max-width:620px;margin:0 auto;background:#13100e;border:1px solid rgba(201,169,97,.45);border-radius:8px;overflow:hidden"><div style="background:#d62828;padding:24px 28px;text-align:center"><img src="cid:csh-shield" width="72" alt="Club Sport Herediano" style="display:block;margin:0 auto 12px"><h1 style="margin:0;color:#f7f1df;font-family:Impact,'Arial Black',Arial,sans-serif;font-size:32px;letter-spacing:.04em;text-transform:uppercase">Herediano</h1><p style="margin:6px 0 0;color:#ffe7e7;font-size:13px;letter-spacing:.16em;text-transform:uppercase">${kicker}</p></div><div style="padding:28px">${body}<div style="border-top:1px solid rgba(201,169,97,.35);padding-top:18px;text-align:center"><p style="margin:0 0 10px;color:#c9a961;font-size:12px;letter-spacing:.16em;text-transform:uppercase;font-weight:800">Patrocinadores oficiales</p><div>${sponsorHtml()}</div></div></div><div style="padding:14px 28px;background:#0a0908;color:#aa9d84;text-align:center;font-size:12px">Mensaje automatico. No respondas a este correo.</div></div></body></html>`;
}
async function commonMailAttachments() {
  const shield = await getInlineAssetAttachment({ reqPath: SITE_LOGO_PATH, cid: 'csh-shield', filename: 'escudo-herediano.png' });
  const sponsors = await Promise.all(OFFICIAL_SPONSORS.map((s) => getInlineAssetAttachment({ reqPath: s.path, cid: s.cid, filename: `${s.cid}.png` })));
  return [shield, ...sponsors].filter(Boolean);
}
async function sendParkingQrEmail({ to, reserva }) {
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error('Correo invalido');
  const qrPng = await QRCodeNode.toBuffer(ensureReservaQrData(reserva), { type: 'png', width: 360, margin: 2, errorCorrectionLevel: 'M' });
  const body = `<p style="font-size:15px;line-height:1.55;margin:0 0 20px;color:#d8cdb6">Presenta este codigo QR en el acceso del parqueo. Guarda este correo hasta finalizar tu visita.</p><div style="text-align:center;margin:18px 0 22px"><img src="cid:parking-qr" width="220" alt="QR de parqueo" style="display:inline-block;background:#fff;border:8px solid #fff;border-radius:6px"></div><table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 22px;color:#f7f1df"><tr><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12);color:#c9a961;font-weight:bold">Espacio</td><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12)">${escapeHtml(reserva.espacioId)}</td></tr><tr><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12);color:#c9a961;font-weight:bold">Placa</td><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12)">${escapeHtml(reserva.placa)}</td></tr><tr><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12);color:#c9a961;font-weight:bold">Desde</td><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12)">${escapeHtml(fmtMailDate(reserva.inicio))}</td></tr><tr><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12);color:#c9a961;font-weight:bold">Hasta</td><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12)">${escapeHtml(fmtMailDate(reserva.fin))}</td></tr></table><p style="font-size:12px;color:#aa9d84;margin:20px 0 0;text-align:center">Modulo de parqueo: <a href="${MAIL_APP_URL}/parqueo" style="color:#c9a961">${MAIL_APP_URL}/parqueo</a></p>`;
  await makeMailTransport().sendMail({ from: MAIL_FROM, to, subject: `QR de parqueo ${reserva.espacioId} - Club Sport Herediano`, html: emailShell('Herediano', 'QR de parqueo', body), attachments: [{ filename: `QR-${reserva.codigo || reserva.espacioId}.png`, content: qrPng, contentType: 'image/png', cid: 'parking-qr', contentDisposition: 'inline' }, ...(await commonMailAttachments())] });
}
async function sendPaymentReceiptEmail({ to, reserva, recibo }) {
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error('Correo invalido');
  const body = `<p style="font-size:15px;line-height:1.55;margin:0 0 18px;color:#d8cdb6">Tu pago fue registrado correctamente. Gracias por visitar al Team.</p><div style="margin:0 0 18px;padding:18px;border:1px solid rgba(201,169,97,.45);border-radius:6px;text-align:center"><p style="margin:0;color:#aa9d84;font-size:12px;letter-spacing:.14em;text-transform:uppercase">Total pagado</p><p style="margin:6px 0 0;color:#c9a961;font-size:32px;font-weight:900">CRC ${recibo.monto}</p></div><table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 22px;color:#f7f1df"><tr><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12);color:#c9a961;font-weight:bold">Transaccion</td><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12)">${escapeHtml(recibo.transaccion)}</td></tr><tr><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12);color:#c9a961;font-weight:bold">Espacio</td><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12)">${escapeHtml(reserva.espacioId)}</td></tr><tr><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12);color:#c9a961;font-weight:bold">Placa</td><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12)">${escapeHtml(reserva.placa)}</td></tr><tr><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12);color:#c9a961;font-weight:bold">Tiempo cobrado</td><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12)">${recibo.horas}h</td></tr></table><p style="font-size:12px;color:#aa9d84;margin:20px 0 0;text-align:center">El espacio quedo liberado despues del pago.</p>`;
  await makeMailTransport().sendMail({ from: MAIL_FROM, to, subject: `Recibo de parqueo ${reserva.espacioId} - Club Sport Herediano`, html: emailShell('Herediano', 'Recibo de parqueo', body), attachments: await commonMailAttachments() });
}

function loginPage({ error = '', next = '/' } = {}) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Acceso | CSH</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0a0908;color:#f7f1df;font-family:Inter,system-ui,sans-serif}.card{width:min(380px,calc(100vw - 32px));border:1px solid rgba(201,169,97,.45);background:#13100e;padding:28px;border-radius:8px}.esc{width:70px;display:block;margin:0 auto 12px}h1{font-family:Impact,sans-serif;text-transform:uppercase;margin:0 0 18px;text-align:center}label{display:block;color:#c9a961;font-size:12px;text-transform:uppercase;letter-spacing:.14em;margin:14px 0 6px}input{width:100%;box-sizing:border-box;min-height:44px;background:#100d0b;color:#f7f1df;border:1px solid rgba(247,241,223,.14);border-radius:4px;padding:0 12px}button{width:100%;min-height:44px;margin-top:18px;border:0;border-radius:4px;background:#d62828;color:#fff;font-weight:800}.err{margin-top:12px;color:#ffd0d0;background:rgba(214,40,40,.12);border:1px solid rgba(214,40,40,.45);padding:10px;border-radius:4px}</style></head><body><form class="card" method="post" action="/__login?next=${encodeURIComponent(next)}"><img class="esc" src="${ADMIN_LOGO_PATH}" alt="Escudo"><h1>Herediano</h1><label>Usuario</label><input name="usuario" autofocus required><label>Contrasena</label><input name="clave" type="password" required>${error ? `<div class="err">${escapeHtml(error)}</div>` : ''}<button>Ingresar</button></form></body></html>`;
}

app.get('/api/session', (req, res) => {
  const user = validAdminToken(parseCookies(req.headers.cookie)[ADMIN_COOKIE]);
  res.json({ ok: true, user: user ? { id: user.id, name: user.name, email: user.email, role: user.role, area: user.area, status: user.status, parkingRole: user.parkingRole, couponRole: user.couponRole, sponsor: user.sponsor } : null });
});
app.get('/__login', (req, res) => res.type('html').send(loginPage({ next: safeNext(req.query.next) })));
app.post('/__login', (req, res) => {
  if (safeEqual(req.body.usuario, AUTH_USER) && safeEqual(req.body.clave, AUTH_PASS)) {
    res.setHeader('set-cookie', cookieAttrs(req, COOKIE, makeToken(), SESSION_HOURS * 3600, '/'));
    return res.redirect(safeNext(req.query.next));
  }
  return res.status(401).type('html').send(loginPage({ error: 'Usuario o contrasena incorrectos.', next: safeNext(req.query.next) }));
});
app.get('/__logout', (req, res) => {
  res.setHeader('set-cookie', cookieAttrs(req, COOKIE, '', 0, '/'));
  res.redirect('/__login');
});
app.post('/admin/sign-in', (req, res) => {
  const user = findAdminUser(req.body.usuario, req.body.clave);
  if (!user) return res.status(401).json({ ok: false, error: 'Usuario o contrasena incorrectos.' });
  // Path=/ porque la SPA valida sesion en /api/session; se limpia ademas la
  // cookie vieja con Path=/admin para que no haga sombra en rutas /admin/*.
  res.setHeader('set-cookie', [
    cookieAttrs(req, ADMIN_COOKIE, '', 0, '/admin'),
    cookieAttrs(req, ADMIN_COOKIE, makeAdminToken(user), ADMIN_SESSION_HOURS * 3600, '/'),
  ]);
  res.json({ ok: true, user: { id: user.id, name: user.name, role: user.role, parkingRole: user.parkingRole, couponRole: user.couponRole, sponsor: user.sponsor } });
});
app.post('/admin/logout', (req, res) => {
  res.setHeader('set-cookie', [
    cookieAttrs(req, ADMIN_COOKIE, '', 0, '/admin'),
    cookieAttrs(req, ADMIN_COOKIE, '', 0, '/'),
  ]);
  res.json({ ok: true });
});

app.get('/api/parqueo/publico/estado', async (_req, res, next) => {
  try {
    if (!USE_DB) {
      const data = readParkingData();
      return res.json({ ok: true, tarifa: TARIFA_HORA, espacios: publicSpacesFromJson(data) });
    }
    const rows = await query(`
      select s.*, r.starts_at, r.ends_at
      from parking_spaces s
      left join parking_reservations r on r.id = s.reservation_id and r.status in ('reservado','ocupado')
      order by s.floor, s.zone, s.num
    `);
    res.json({ ok: true, tarifa: TARIFA_HORA, espacios: rows.map((r) => ({ id: r.id, piso: r.floor, zona: r.zone, num: r.num, estado: r.status, reserva: r.starts_at ? { inicio: r.starts_at.toISOString(), fin: r.ends_at.toISOString() } : null })) });
  } catch (err) { next(err); }
});
app.post('/api/parqueo/publico/consulta', async (req, res, next) => {
  try {
    const plate = String(req.body.placa || '').trim().toUpperCase();
    if (!plate || plate.length > 12) return res.status(400).json({ ok: false, error: 'Ingresa una placa valida' });
    const reserva = await getActiveReservationByPlate(plate);
    if (!reserva) return res.status(404).json({ ok: false, error: 'No hay parqueo activo para esa placa' });
    const { horas, monto } = montoDe(reserva);
    res.json({ ok: true, info: { espacioId: reserva.espacioId, placa: reserva.placa, estado: reserva.estado, inicio: reserva.inicio, fin: reserva.fin, correo: maskedReservaEmail(reserva), horas, monto, tarifa: TARIFA_HORA } });
  } catch (err) { next(err); }
});
app.post('/api/parqueo/publico/ocupar', async (req, res, next) => {
  if (!USE_DB) {
    try {
      const data = readParkingData();
      const plate = String(req.body.placa || '').trim().toUpperCase();
      const email = String(req.body.email || '').trim().toLowerCase();
      const duration = Number(req.body.duracion);
      if (!plate || plate.length > 12) return res.status(400).json({ ok: false, error: 'Placa invalida' });
      if (!email || email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ ok: false, error: 'Correo invalido' });
      if (!Number.isFinite(duration) || duration < 15 || duration > 1440) return res.status(400).json({ ok: false, error: 'Duracion invalida (15-1440 minutos)' });
      const space = data.espacios.find((s) => s.id === req.body.espacioId);
      if (!space) return res.status(404).json({ ok: false, error: 'El espacio no existe' });
      if (space.estado !== 'disponible') return res.status(409).json({ ok: false, error: 'El espacio no esta disponible' });
      if (getJsonActiveReservationByPlate(data, plate)) return res.status(409).json({ ok: false, error: 'Esa placa ya tiene un espacio activo' });
      const id = nextJsonReservationId(data);
      const starts = new Date();
      const ends = new Date(starts.getTime() + duration * 60000);
      const code = `CSH-R-${id.slice(2).padStart(4, '0')}`;
      const qrData = `${code}|${space.id}|${plate}|${ends.toISOString()}`;
      const reserva = { id, espacioId: space.id, userId: null, userName: 'Invitado', placa: plate, rol: 'invitado', estado: 'ocupado', inicio: starts.toISOString(), fin: ends.toISOString(), codigo: code, qrData, emailQr: email };
      data.reservas.push(reserva);
      space.estado = 'ocupado';
      space.reservaId = id;
      pushJsonEvent(data, 'entrada', { espacioId: space.id, user: { id: null, name: 'Invitado' }, placa: plate, notas: `Walk-in, estimado ${duration} min, QR a ${email}` });
      writeParkingData(data);
      let emailSent = false;
      let emailError = '';
      try { await sendParkingQrEmail({ to: email, reserva }); emailSent = true; }
      catch (err) { emailError = err.message; console.error(`[mail] Error enviando QR a ${email}: ${emailError}`); }
      return res.json({ ok: true, sesion: { reservaId: id, espacioId: space.id, placa: plate, inicio: reserva.inicio, fin: reserva.fin, codigo: code, qrData, correo: maskedReservaEmail(reserva), emailSent, emailError } });
    } catch (err) { return next(err); }
  }
  const client = await pool.connect();
  try {
    const plate = String(req.body.placa || '').trim().toUpperCase();
    const email = String(req.body.email || '').trim().toLowerCase();
    const duration = Number(req.body.duracion);
    if (!plate || plate.length > 12) return res.status(400).json({ ok: false, error: 'Placa invalida' });
    if (!email || email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ ok: false, error: 'Correo invalido' });
    if (!Number.isFinite(duration) || duration < 15 || duration > 1440) return res.status(400).json({ ok: false, error: 'Duracion invalida (15-1440 minutos)' });
    await client.query('begin');
    const spaceRows = await client.query("select * from parking_spaces where id = $1 for update", [req.body.espacioId]);
    const space = spaceRows.rows[0];
    if (!space) { await client.query('rollback'); return res.status(404).json({ ok: false, error: 'El espacio no existe' }); }
    if (space.status !== 'disponible') { await client.query('rollback'); return res.status(409).json({ ok: false, error: 'El espacio no esta disponible' }); }
    const exists = await client.query(`select id from parking_reservations where ${activeWhere} and plate = $1 limit 1`, [plate]);
    if (exists.rows[0]) { await client.query('rollback'); return res.status(409).json({ ok: false, error: 'Esa placa ya tiene un espacio activo' }); }
    const id = await nextReservationId(client);
    const starts = new Date();
    const ends = new Date(starts.getTime() + duration * 60000);
    const code = `CSH-R-${id.slice(2).padStart(4, '0')}`;
    const qrData = `${code}|${space.id}|${plate}|${ends.toISOString()}`;
    await client.query(`insert into parking_reservations (id, space_id, user_id, user_name, plate, role, status, starts_at, ends_at, code, qr_data, email_qr) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [id, space.id, null, 'Invitado', plate, 'invitado', 'ocupado', starts, ends, code, qrData, email]);
    await client.query("update parking_spaces set status = 'ocupado', reservation_id = $1 where id = $2", [id, space.id]);
    await logEvento(client, 'entrada', { espacioId: space.id, user: { id: null, name: 'Invitado' }, placa: plate, notas: `Walk-in, estimado ${duration} min, QR a ${email}` });
    await client.query('commit');
    const reserva = { id, espacioId: space.id, placa: plate, inicio: starts.toISOString(), fin: ends.toISOString(), codigo: code, qrData, emailQr: email };
    let emailSent = false;
    let emailError = '';
    try { await sendParkingQrEmail({ to: email, reserva }); emailSent = true; }
    catch (err) { emailError = err.message; console.error(`[mail] Error enviando QR a ${email}: ${emailError}`); }
    res.json({ ok: true, sesion: { reservaId: id, espacioId: space.id, placa: plate, inicio: reserva.inicio, fin: reserva.fin, codigo: code, qrData, correo: maskedReservaEmail(reserva), emailSent, emailError } });
  } catch (err) {
    try { await client.query('rollback'); } catch (_) {}
    next(err);
  } finally {
    client.release();
  }
});
app.post('/api/parqueo/publico/reenviar', async (req, res, next) => {
  try {
    const plate = String(req.body.placa || '').trim().toUpperCase();
    const reserva = await getActiveReservationByPlate(plate);
    if (!reserva) return res.status(404).json({ ok: false, error: 'No hay parqueo activo para esa placa' });
    const email = reservaEmail(reserva);
    if (!email) return res.status(409).json({ ok: false, error: 'La reserva no tiene correo asociado' });
    await sendParkingQrEmail({ to: email, reserva });
    if (USE_DB) await logEvento(pool, 'envio', { espacioId: reserva.espacioId, user: { id: null, name: 'Consulta publica' }, placa: reserva.placa, notas: `Reenvio solicitado a ${maskedReservaEmail(reserva)}` });
    else {
      const data = readParkingData();
      pushJsonEvent(data, 'envio', { espacioId: reserva.espacioId, user: { id: null, name: 'Consulta publica' }, placa: reserva.placa, notas: `Reenvio solicitado a ${maskedReservaEmail(reserva)}` });
      writeParkingData(data);
    }
    res.json({ ok: true, correo: maskedReservaEmail(reserva) });
  } catch (err) { next(err); }
});
app.post('/api/parqueo/publico/pagar', async (req, res, next) => {
  if (!USE_DB) {
    try {
      const data = readParkingData();
      const plate = String(req.body.placa || '').trim().toUpperCase();
      const reserva = getJsonActiveReservationByPlate(data, plate);
      if (!reserva) return res.status(404).json({ ok: false, error: 'No hay parqueo activo para esa placa' });
      const email = reservaEmail(reserva);
      if (!email) return res.status(409).json({ ok: false, error: 'La reserva no tiene correo asociado para enviar el recibo' });
      const pago = req.body.pago || {};
      const cardNumber = String(pago.cardNumber || '').replace(/\D/g, '');
      if (String(pago.name || '').trim().length < 3) return res.status(400).json({ ok: false, error: 'Ingresa el nombre del tarjetahabiente' });
      if (cardNumber.length < 13 || cardNumber.length > 19) return res.status(400).json({ ok: false, error: 'Numero de tarjeta invalido' });
      if (!/^\d{2}\/\d{2}$/.test(String(pago.exp || '').trim())) return res.status(400).json({ ok: false, error: 'Fecha de expiracion invalida' });
      if (String(pago.cvv || '').replace(/\D/g, '').length < 3) return res.status(400).json({ ok: false, error: 'CVV invalido' });
      if (cardNumber.endsWith('0000')) return res.status(402).json({ ok: false, error: 'La transaccion fue rechazada por el emisor' });
      const { horas, monto } = montoDe(reserva);
      const recibo = { espacioId: reserva.espacioId, placa: reserva.placa, horas, monto, transaccion: `CSH-PAY-${Date.now().toString(36).toUpperCase()}`, correo: maskedReservaEmail(reserva) };
      await sendPaymentReceiptEmail({ to: email, reserva, recibo });
      reserva.estado = 'finalizada';
      reserva.pago = { transaccion: recibo.transaccion, monto, horas, timestamp: new Date().toISOString(), metodo: `****${cardNumber.slice(-4)}` };
      const space = data.espacios.find((s) => s.id === reserva.espacioId);
      if (space) { space.estado = 'disponible'; space.reservaId = null; }
      pushJsonEvent(data, 'pago', { espacioId: reserva.espacioId, user: { id: null, name: 'Invitado' }, placa: reserva.placa, notas: `CRC ${monto} (${horas}h) - ${recibo.transaccion}` });
      writeParkingData(data);
      return res.json({ ok: true, recibo });
    } catch (err) { return next(err); }
  }
  const client = await pool.connect();
  try {
    const plate = String(req.body.placa || '').trim().toUpperCase();
    const reserva = await getActiveReservationByPlate(plate);
    if (!reserva) return res.status(404).json({ ok: false, error: 'No hay parqueo activo para esa placa' });
    const email = reservaEmail(reserva);
    if (!email) return res.status(409).json({ ok: false, error: 'La reserva no tiene correo asociado para enviar el recibo' });
    const pago = req.body.pago || {};
    const cardNumber = String(pago.cardNumber || '').replace(/\D/g, '');
    if (String(pago.name || '').trim().length < 3) return res.status(400).json({ ok: false, error: 'Ingresa el nombre del tarjetahabiente' });
    if (cardNumber.length < 13 || cardNumber.length > 19) return res.status(400).json({ ok: false, error: 'Numero de tarjeta invalido' });
    if (!/^\d{2}\/\d{2}$/.test(String(pago.exp || '').trim())) return res.status(400).json({ ok: false, error: 'Fecha de expiracion invalida' });
    if (String(pago.cvv || '').replace(/\D/g, '').length < 3) return res.status(400).json({ ok: false, error: 'CVV invalido' });
    if (cardNumber.endsWith('0000')) return res.status(402).json({ ok: false, error: 'La transaccion fue rechazada por el emisor' });
    const { horas, monto } = montoDe(reserva);
    const recibo = { espacioId: reserva.espacioId, placa: reserva.placa, horas, monto, transaccion: `CSH-PAY-${Date.now().toString(36).toUpperCase()}`, correo: maskedReservaEmail(reserva) };
    await sendPaymentReceiptEmail({ to: email, reserva, recibo });
    await client.query('begin');
    await client.query("update parking_reservations set status = 'finalizada', payment = $1 where id = $2", [JSON.stringify({ transaccion: recibo.transaccion, monto, horas, timestamp: new Date().toISOString(), metodo: `****${cardNumber.slice(-4)}` }), reserva.id]);
    await client.query("update parking_spaces set status = 'disponible', reservation_id = null where id = $1", [reserva.espacioId]);
    await logEvento(client, 'pago', { espacioId: reserva.espacioId, user: { id: null, name: 'Invitado' }, placa: reserva.placa, notas: `CRC ${monto} (${horas}h) - ${recibo.transaccion}` });
    await client.query('commit');
    res.json({ ok: true, recibo });
  } catch (err) {
    try { await client.query('rollback'); } catch (_) {}
    next(err);
  } finally {
    client.release();
  }
});

app.get('/api/cuponera/publico', (_req, res) => {
  const data = readCuponeraData();
  const cupones = data.cupones.filter((c) => c.estado === 'habilitado').map(publicCoupon);
  res.json({ ok: true, cupones, stats: couponStats(data.cupones) });
});

app.get('/admin/api/parqueo/estado', requireAdmin, async (_req, res, next) => {
  try {
    if (!USE_DB) {
      const data = readParkingData();
      const espacios = data.espacios.slice().sort((a, b) => a.piso - b.piso || String(a.zona).localeCompare(String(b.zona)) || a.num - b.num);
      const reservas = activeReservations(data).slice().sort((a, b) => new Date(b.inicio) - new Date(a.inicio));
      return res.json({ ok: true, espacios, reservas });
    }
    const spaces = (await query('select * from parking_spaces order by floor, zone, num')).map(toSpace);
    const reservations = (await query(`select * from parking_reservations where ${activeWhere} order by starts_at desc`)).map(toReservation);
    res.json({ ok: true, espacios: spaces, reservas: reservations });
  } catch (err) { next(err); }
});
app.get('/admin/api/parqueo/eventos', requireAdmin, async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const plate = String(req.query.placa || '').trim().toUpperCase();
    if (!USE_DB) {
      const filtered = readParkingData().eventos.filter((e) => !plate || String(e.placa || '').toUpperCase().includes(plate));
      filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      return res.json({ ok: true, total: filtered.length, eventos: filtered.slice(offset, offset + limit) });
    }
    const where = plate ? 'where upper(plate) like $1' : '';
    const params = plate ? [`%${plate}%`, limit, offset] : [limit, offset];
    const countParams = plate ? [`%${plate}%`] : [];
    const total = Number((await query(`select count(*)::int as total from parking_events ${where}`, countParams))[0].total);
    const rows = await query(`select * from parking_events ${where} order by created_at desc limit $${plate ? 2 : 1} offset $${plate ? 3 : 2}`, params);
    res.json({ ok: true, total, eventos: rows.map((e) => ({ id: e.id, tipo: e.type, espacioId: e.space_id, userId: e.user_id, userName: e.user_name, placa: e.plate, notas: e.notes, timestamp: e.created_at.toISOString() })) });
  } catch (err) { next(err); }
});
app.post('/admin/api/parqueo/reservar', requireAdmin, async (req, res, next) => {
  if (!USE_DB) {
    try {
      const data = readParkingData();
      const user = req.adminUser;
      const isAdmin = user.parkingRole === 'admin';
      const plate = String(req.body.placa || '').trim().toUpperCase();
      const duration = Number(req.body.duracion);
      if (!plate || plate.length > 12) return res.status(400).json({ ok: false, error: 'Placa invalida' });
      if (!Number.isFinite(duration) || duration < 15 || duration > 1440) return res.status(400).json({ ok: false, error: 'Duracion invalida (15-1440 minutos)' });
      const space = data.espacios.find((s) => s.id === req.body.espacioId);
      if (!space) return res.status(404).json({ ok: false, error: 'El espacio no existe' });
      if (space.estado !== 'disponible') return res.status(409).json({ ok: false, error: 'El espacio no esta disponible' });
      if (!isAdmin && activeReservations(data).some((r) => r.userId === user.id)) return res.status(409).json({ ok: false, error: 'Ya tienes una reserva activa' });
      const id = nextJsonReservationId(data);
      const starts = new Date();
      const ends = new Date(starts.getTime() + duration * 60000);
      const code = `CSH-R-${id.slice(2).padStart(4, '0')}`;
      const qrData = `${code}|${space.id}|${plate}|${ends.toISOString()}`;
      const reserva = { id, espacioId: space.id, userId: user.id, userName: user.name, placa: plate, rol: user.parkingRole || 'socio', estado: 'reservado', inicio: starts.toISOString(), fin: ends.toISOString(), codigo: code, qrData };
      data.reservas.push(reserva);
      space.estado = 'reservado';
      space.reservaId = id;
      pushJsonEvent(data, 'reserva', { espacioId: space.id, user, placa: plate, notas: `Duracion ${duration} min` });
      writeParkingData(data);
      return res.json({ ok: true, reserva });
    } catch (err) { return next(err); }
  }
  const client = await pool.connect();
  try {
    const user = req.adminUser;
    const isAdmin = user.parkingRole === 'admin';
    const plate = String(req.body.placa || '').trim().toUpperCase();
    const duration = Number(req.body.duracion);
    if (!plate || plate.length > 12) return res.status(400).json({ ok: false, error: 'Placa invalida' });
    if (!Number.isFinite(duration) || duration < 15 || duration > 1440) return res.status(400).json({ ok: false, error: 'Duracion invalida (15-1440 minutos)' });
    await client.query('begin');
    const spaceRows = await client.query('select * from parking_spaces where id = $1 for update', [req.body.espacioId]);
    const space = spaceRows.rows[0];
    if (!space) { await client.query('rollback'); return res.status(404).json({ ok: false, error: 'El espacio no existe' }); }
    if (space.status !== 'disponible') { await client.query('rollback'); return res.status(409).json({ ok: false, error: 'El espacio no esta disponible' }); }
    if (!isAdmin) {
      const mine = await client.query(`select id from parking_reservations where ${activeWhere} and user_id = $1 limit 1`, [user.id]);
      if (mine.rows[0]) { await client.query('rollback'); return res.status(409).json({ ok: false, error: 'Ya tienes una reserva activa' }); }
    }
    const id = await nextReservationId(client);
    const starts = new Date();
    const ends = new Date(starts.getTime() + duration * 60000);
    const code = `CSH-R-${id.slice(2).padStart(4, '0')}`;
    const qrData = `${code}|${space.id}|${plate}|${ends.toISOString()}`;
    await client.query(`insert into parking_reservations (id, space_id, user_id, user_name, plate, role, status, starts_at, ends_at, code, qr_data) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [id, space.id, user.id, user.name, plate, user.parkingRole || 'socio', 'reservado', starts, ends, code, qrData]);
    await client.query("update parking_spaces set status = 'reservado', reservation_id = $1 where id = $2", [id, space.id]);
    await logEvento(client, 'reserva', { espacioId: space.id, user, placa: plate, notas: `Duracion ${duration} min` });
    await client.query('commit');
    res.json({ ok: true, reserva: { id, espacioId: space.id, userId: user.id, userName: user.name, placa: plate, rol: user.parkingRole || 'socio', estado: 'reservado', inicio: starts.toISOString(), fin: ends.toISOString(), codigo: code, qrData } });
  } catch (err) {
    try { await client.query('rollback'); } catch (_) {}
    next(err);
  } finally {
    client.release();
  }
});
app.post('/admin/api/parqueo/ocupar', requireAdmin, async (req, res, next) => {
  try {
    if (req.adminUser.parkingRole !== 'admin') return res.status(403).json({ ok: false, error: 'Solo administradores pueden marcar entradas' });
    if (!USE_DB) {
      const data = readParkingData();
      const reserva = getJsonActiveReservationById(data, req.body.reservaId);
      if (!reserva) return res.status(404).json({ ok: false, error: 'Reserva no activa' });
      if (reserva.estado === 'ocupado') return res.status(409).json({ ok: false, error: 'El espacio ya esta ocupado' });
      reserva.estado = 'ocupado';
      const space = data.espacios.find((s) => s.id === reserva.espacioId);
      if (space) space.estado = 'ocupado';
      pushJsonEvent(data, 'entrada', { espacioId: reserva.espacioId, user: req.adminUser, placa: reserva.placa });
      writeParkingData(data);
      return res.json({ ok: true });
    }
    const reserva = await getActiveReservationById(req.body.reservaId);
    if (!reserva) return res.status(404).json({ ok: false, error: 'Reserva no activa' });
    if (reserva.estado === 'ocupado') return res.status(409).json({ ok: false, error: 'El espacio ya esta ocupado' });
    await pool.query("update parking_reservations set status = 'ocupado' where id = $1", [reserva.id]);
    await pool.query("update parking_spaces set status = 'ocupado' where id = $1", [reserva.espacioId]);
    await logEvento(pool, 'entrada', { espacioId: reserva.espacioId, user: req.adminUser, placa: reserva.placa });
    res.json({ ok: true });
  } catch (err) { next(err); }
});
app.post('/admin/api/parqueo/liberar', requireAdmin, async (req, res, next) => {
  try {
    if (!USE_DB) {
      const data = readParkingData();
      const space = data.espacios.find((s) => s.id === req.body.espacioId);
      if (!space) return res.status(404).json({ ok: false, error: 'El espacio no existe' });
      const reserva = space.reservaId ? getJsonActiveReservationById(data, space.reservaId) : null;
      if (!reserva) return res.status(409).json({ ok: false, error: 'El espacio no tiene reserva activa' });
      if (reserva.userId !== req.adminUser.id && req.adminUser.parkingRole !== 'admin') return res.status(403).json({ ok: false, error: 'Sin permiso para liberar este espacio' });
      reserva.estado = 'finalizada';
      space.estado = 'disponible';
      space.reservaId = null;
      pushJsonEvent(data, 'salida', { espacioId: space.id, user: req.adminUser, placa: reserva.placa, notas: reserva.userId === req.adminUser.id ? '' : 'Liberado por admin' });
      writeParkingData(data);
      return res.json({ ok: true });
    }
    const rows = await query('select * from parking_spaces where id = $1', [req.body.espacioId]);
    const space = rows[0];
    if (!space) return res.status(404).json({ ok: false, error: 'El espacio no existe' });
    const reserva = space.reservation_id ? await getActiveReservationById(space.reservation_id) : null;
    if (!reserva) return res.status(409).json({ ok: false, error: 'El espacio no tiene reserva activa' });
    if (reserva.userId !== req.adminUser.id && req.adminUser.parkingRole !== 'admin') return res.status(403).json({ ok: false, error: 'Sin permiso para liberar este espacio' });
    await pool.query("update parking_reservations set status = 'finalizada' where id = $1", [reserva.id]);
    await pool.query("update parking_spaces set status = 'disponible', reservation_id = null where id = $1", [space.id]);
    await logEvento(pool, 'salida', { espacioId: space.id, user: req.adminUser, placa: reserva.placa, notas: reserva.userId === req.adminUser.id ? '' : 'Liberado por admin' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});
app.post('/admin/api/parqueo/extender', requireAdmin, async (req, res, next) => {
  try {
    if (!USE_DB) {
      const data = readParkingData();
      const reserva = getJsonActiveReservationById(data, req.body.reservaId);
      if (!reserva) return res.status(404).json({ ok: false, error: 'Reserva no activa' });
      if (reserva.userId !== req.adminUser.id && req.adminUser.parkingRole !== 'admin') return res.status(403).json({ ok: false, error: 'Sin permiso para extender esta reserva' });
      const minutos = Number(req.body.minutos);
      if (!Number.isFinite(minutos) || minutos < 5 || minutos > 720) return res.status(400).json({ ok: false, error: 'Minutos invalidos (5-720)' });
      const base = Math.max(new Date(reserva.fin).getTime(), Date.now());
      reserva.fin = new Date(base + minutos * 60000).toISOString();
      reserva.qrData = `${reserva.codigo}|${reserva.espacioId}|${reserva.placa}|${reserva.fin}`;
      pushJsonEvent(data, 'extension', { espacioId: reserva.espacioId, user: req.adminUser, placa: reserva.placa, notas: `+${minutos} min` });
      writeParkingData(data);
      return res.json({ ok: true });
    }
    const reserva = await getActiveReservationById(req.body.reservaId);
    if (!reserva) return res.status(404).json({ ok: false, error: 'Reserva no activa' });
    if (reserva.userId !== req.adminUser.id && req.adminUser.parkingRole !== 'admin') return res.status(403).json({ ok: false, error: 'Sin permiso para extender esta reserva' });
    const minutos = Number(req.body.minutos);
    if (!Number.isFinite(minutos) || minutos < 5 || minutos > 720) return res.status(400).json({ ok: false, error: 'Minutos invalidos (5-720)' });
    const base = Math.max(new Date(reserva.fin).getTime(), Date.now());
    const fin = new Date(base + minutos * 60000).toISOString();
    const qrData = `${reserva.codigo}|${reserva.espacioId}|${reserva.placa}|${fin}`;
    await pool.query('update parking_reservations set ends_at = $1, qr_data = $2 where id = $3', [fin, qrData, reserva.id]);
    await logEvento(pool, 'extension', { espacioId: reserva.espacioId, user: req.adminUser, placa: reserva.placa, notas: `+${minutos} min` });
    res.json({ ok: true });
  } catch (err) { next(err); }
});
app.delete('/admin/api/parqueo/reserva/:id', requireAdmin, async (req, res, next) => {
  try {
    if (!USE_DB) {
      const data = readParkingData();
      const reserva = getJsonActiveReservationById(data, req.params.id);
      if (!reserva) return res.status(404).json({ ok: false, error: 'Reserva no activa' });
      if (reserva.userId !== req.adminUser.id && req.adminUser.parkingRole !== 'admin') return res.status(403).json({ ok: false, error: 'Sin permiso para cancelar esta reserva' });
      reserva.estado = 'cancelada';
      const space = data.espacios.find((s) => s.id === reserva.espacioId);
      if (space) { space.estado = 'disponible'; space.reservaId = null; }
      pushJsonEvent(data, 'cancelacion', { espacioId: reserva.espacioId, user: req.adminUser, placa: reserva.placa, notas: reserva.userId === req.adminUser.id ? '' : 'Cancelada por admin' });
      writeParkingData(data);
      return res.json({ ok: true });
    }
    const reserva = await getActiveReservationById(req.params.id);
    if (!reserva) return res.status(404).json({ ok: false, error: 'Reserva no activa' });
    if (reserva.userId !== req.adminUser.id && req.adminUser.parkingRole !== 'admin') return res.status(403).json({ ok: false, error: 'Sin permiso para cancelar esta reserva' });
    await pool.query("update parking_reservations set status = 'cancelada' where id = $1", [reserva.id]);
    await pool.query("update parking_spaces set status = 'disponible', reservation_id = null where id = $1", [reserva.espacioId]);
    await logEvento(pool, 'cancelacion', { espacioId: reserva.espacioId, user: req.adminUser, placa: reserva.placa, notas: reserva.userId === req.adminUser.id ? '' : 'Cancelada por admin' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});
app.post('/admin/api/parqueo/enviar-qr', requireAdmin, async (req, res, next) => {
  try {
    const reserva = await getActiveReservationById(req.body.reservaId);
    if (!reserva) return res.status(404).json({ ok: false, error: 'Reserva no activa' });
    if (reserva.userId !== req.adminUser.id && req.adminUser.parkingRole !== 'admin') return res.status(403).json({ ok: false, error: 'Sin permiso sobre esta reserva' });
    const email = String(req.body.email || '').trim().toLowerCase();
    if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ ok: false, error: 'Correo invalido' });
    await sendParkingQrEmail({ to: email, reserva });
    if (USE_DB) {
      await pool.query('update parking_reservations set email_qr = $1 where id = $2', [email, reserva.id]);
      await logEvento(pool, 'envio', { espacioId: reserva.espacioId, user: req.adminUser, placa: reserva.placa, notas: `QR a ${email}` });
    } else {
      const data = readParkingData();
      const current = getJsonActiveReservationById(data, reserva.id);
      if (current) current.emailQr = email;
      pushJsonEvent(data, 'envio', { espacioId: reserva.espacioId, user: req.adminUser, placa: reserva.placa, notas: `QR a ${email}` });
      writeParkingData(data);
    }
    res.json({ ok: true, email });
  } catch (err) { next(err); }
});
app.get('/admin/api/cuponera', requireAdmin, (req, res) => {
  const data = readCuponeraData();
  const scope = req.adminUser.couponRole === 'patrocinador' ? req.adminUser.sponsor : '';
  const cupones = data.cupones
    .filter((c) => !scope || c.proveedor === scope)
    .map(publicCoupon);
  res.json({ ok: true, cupones, eventos: data.eventos.slice().reverse().slice(0, 50), stats: couponStats(cupones), role: req.adminUser.couponRole || 'socio', sponsor: scope });
});
app.post('/admin/api/cuponera/:id/estado', requireAdmin, (req, res) => {
  if (!canManageCoupons(req.adminUser)) return res.status(403).json({ ok: false, error: 'Sin permiso para administrar cupones' });
  const estado = String(req.body.estado || '');
  if (!['habilitado', 'retirado'].includes(estado)) return res.status(400).json({ ok: false, error: 'Estado invalido' });
  const data = readCuponeraData();
  const cupon = data.cupones.find((c) => c.id === req.params.id);
  if (!cupon) return res.status(404).json({ ok: false, error: 'Cupon no encontrado' });
  if (req.adminUser.couponRole === 'patrocinador' && cupon.proveedor !== req.adminUser.sponsor) return res.status(403).json({ ok: false, error: 'Solo puedes gestionar cupones de tu patrocinador' });
  cupon.estado = estado;
  cupon.actualizado = new Date().toISOString();
  data.eventos.push({ id: `CE-${Date.now().toString(36)}`, cuponId: cupon.id, proveedor: cupon.proveedor, estado, userId: req.adminUser.id, userName: req.adminUser.name, timestamp: cupon.actualizado });
  writeCuponeraData(data);
  res.json({ ok: true, cupon: publicCoupon(cupon), stats: couponStats(data.cupones) });
});
app.get('/admin/api/users', requireAdmin, (req, res) => {
  res.json({ ok: true, users: ADMIN_USERS.map((u) => ({ id: u.id, name: u.name, username: u.username, email: u.email, role: u.role, area: u.area, status: u.status, parkingRole: u.parkingRole, couponRole: u.couponRole, sponsor: u.sponsor })) });
});
app.post('/admin/api/users/password', requireAdmin, async (req, res, next) => {
  try {
    if (req.adminUser.parkingRole !== 'admin') return res.status(403).json({ ok: false, error: 'Solo administradores pueden cambiar contrasenas' });
    const target = ADMIN_USERS.find((u) => u.id === req.body.userId);
    if (!target) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    const password = String(req.body.password || '');
    if (password.length < 8 || password.length > 80) return res.status(400).json({ ok: false, error: 'La contrasena debe tener entre 8 y 80 caracteres' });
    await setAdminUserPassword(target.id, password);
    res.json({ ok: true, user: { id: target.id, name: target.name, email: target.email } });
  } catch (err) { next(err); }
});

const WEB_DEFAULTS = { kicker: 'Clausura 2026 · Campeón Nacional', title: 'Título', number: '32', sub: 'Nuestra pasión es eterna' };
function readWebData() {
  try {
    const d = JSON.parse(fs.readFileSync(WEB_FILE, 'utf8'));
    return { kicker: d.kicker || null, title: d.title || null, number: d.number || null, sub: d.sub || null, imageType: d.imageType || null, imageVersion: d.imageVersion || null };
  } catch (_) {
    return { kicker: null, title: null, number: null, sub: null, imageType: null, imageVersion: null };
  }
}
function writeWebData(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(WEB_FILE, `${JSON.stringify(data, null, 2)}\n`);
}

app.get('/admin/api/web', requireAdmin, (_req, res) => {
  res.json({ ok: true, config: readWebData(), defaults: WEB_DEFAULTS });
});
app.post('/admin/api/web', requireAdmin, (req, res) => {
  const data = readWebData();
  for (const key of ['kicker', 'title', 'number', 'sub']) {
    const value = String(req.body[key] ?? '').trim().slice(0, 120);
    data[key] = value && value !== WEB_DEFAULTS[key] ? value : null;
  }
  writeWebData(data);
  res.json({ ok: true, config: data });
});
const heroUpload = express.raw({ type: ['image/png', 'image/jpeg', 'image/webp', 'image/avif'], limit: '8mb' });
app.post('/admin/api/web/hero-imagen', requireAdmin, heroUpload, (req, res) => {
  if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ ok: false, error: 'Envia la imagen como cuerpo binario (PNG, JPG, WebP o AVIF)' });
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(HERO_IMG_FILE, req.body);
  const data = readWebData();
  data.imageType = req.headers['content-type'];
  data.imageVersion = Date.now();
  writeWebData(data);
  res.json({ ok: true, config: data });
});
app.delete('/admin/api/web/hero-imagen', requireAdmin, (_req, res) => {
  const data = readWebData();
  data.imageType = null;
  data.imageVersion = null;
  try { fs.unlinkSync(HERO_IMG_FILE); } catch (_) {}
  writeWebData(data);
  res.json({ ok: true, config: data });
});
app.get('/site-assets/hero', (_req, res) => {
  const data = readWebData();
  if (!data.imageType || !fs.existsSync(HERO_IMG_FILE)) return res.status(404).end();
  res.setHeader('cache-control', 'public, max-age=31536000, immutable');
  res.type(data.imageType).send(fs.readFileSync(HERO_IMG_FILE));
});

app.get(ADMIN_LOGO_PATH, async (_req, res, next) => {
  try {
    const entry = await getCachedAsset(SITE_LOGO_PATH);
    res.setHeader('cache-control', 'public, max-age=86400');
    res.type(entry.meta.ct || 'image/png').send(entry.body);
  } catch (err) { next(err); }
});

const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
  app.use('/assets', express.static(path.join(distDir, 'assets'), { maxAge: '1y', immutable: true }));
  app.get('/parqueo', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
  app.get('/cuponera', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
  app.get(/^\/admin(?:\/.*)?$/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

const NAV_LINKS = '<a class="csh-cuponera-link" href="/cuponera">Cuponera</a><a class="csh-parqueo-link" href="/parqueo">Parqueo</a><a class="csh-admin-signin" href="/admin">Sign in</a>';
const NAV_STYLE = '<style id="csh-nav-style">.csh-admin-signin,.csh-parqueo-link,.csh-cuponera-link{font-family:Oswald,sans-serif;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#f7f1df;text-decoration:none;margin-left:12px}.csh-admin-signin{background:#d62828;padding:10px 14px;border-radius:2px}</style>';
// El sitio es Next.js: al hidratar, React reconstruye el nav y elimina los enlaces
// inyectados en el HTML estatico, por eso el observer los re-inserta.
const NAV_SCRIPT = `<script id="csh-nav-script">(function(){var html=${JSON.stringify(NAV_LINKS)};function ensure(){if(document.querySelector('.csh-admin-signin'))return;var nav=document.querySelector('.csh-nav-desktop')||document.querySelector('nav');if(nav)nav.insertAdjacentHTML('beforeend',html);}var t;new MutationObserver(function(){clearTimeout(t);t=setTimeout(ensure,120);}).observe(document.documentElement,{childList:true,subtree:true});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensure);else ensure();})();</script>`;
// Igual que con el nav: la hidratacion de Next.js pisa los cambios estaticos,
// por eso los overrides del hero se aplican con un observer que los re-inserta.
// Los guards (comparar antes de asignar) evitan que el propio apply dispare
// el MutationObserver en bucle.
function heroOverrideScript() {
  const cfg = readWebData();
  const overrides = {
    kicker: cfg.kicker,
    title: cfg.title,
    number: cfg.number,
    sub: cfg.sub,
    image: cfg.imageVersion ? `/site-assets/hero?v=${cfg.imageVersion}` : null,
  };
  if (!overrides.kicker && !overrides.title && !overrides.number && !overrides.sub && !overrides.image) return '';
  const payload = JSON.stringify(overrides).replace(/</g, '\\u003c');
  return `<script id="csh-hero-script">(function(){var cfg=${payload};function apply(){var hs=document.querySelectorAll('h1');for(var i=0;i<hs.length;i++){var h=hs[i];var sp=h.querySelectorAll('span');if(sp.length<2)continue;if(sp[0].textContent!=='${WEB_DEFAULTS.title}'&&!sp[0].hasAttribute('data-csh'))continue;sp[0].setAttribute('data-csh','1');if(cfg.title&&sp[0].textContent!==cfg.title)sp[0].textContent=cfg.title;if(cfg.number&&sp[1].textContent!==cfg.number)sp[1].textContent=cfg.number;var eye=h.previousElementSibling;if(cfg.kicker&&eye){var t=eye.lastChild;if(t&&t.nodeType===3){if(t.nodeValue!==cfg.kicker)t.nodeValue=cfg.kicker;}else{eye.appendChild(document.createTextNode(cfg.kicker));}}var wrap=h.nextElementSibling;var p=wrap&&wrap.querySelector('p');if(cfg.sub&&p&&p.textContent!==cfg.sub)p.textContent=cfg.sub;if(cfg.image){var sec=h.closest('section')||h.parentElement;var img=(sec&&sec.querySelector('img[data-nimg]'))||document.querySelector('img[data-nimg=\\u0022fill\\u0022]');if(img&&img.getAttribute('src')!==cfg.image){img.removeAttribute('srcSet');img.removeAttribute('srcset');img.setAttribute('sizes','100vw');img.src=cfg.image;}}break;}}var t;new MutationObserver(function(){clearTimeout(t);t=setTimeout(apply,150);}).observe(document.documentElement,{childList:true,subtree:true});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);else apply();})();</script>`;
}

function decorateSiteHtml(s) {
  s = s.replace(/<a class="csh-(?:cuponera-link|parqueo-link|admin-signin)"[^>]*>[^<]*<\/a>/g, '');
  if (!s.includes('csh-nav-style')) s = s.replace('</head>', `${NAV_STYLE}${NAV_SCRIPT}</head>`);
  const hero = heroOverrideScript();
  if (hero && !s.includes('csh-hero-script')) s = s.replace('</head>', `${hero}</head>`);
  s = s.replace('</nav>', `${NAV_LINKS}</nav>`);
  return s;
}

app.use(async (req, res, next) => {
  try {
    if (req.method !== 'GET') return res.status(405).send('Metodo no permitido');
    const loopback = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
    if (!loopback && !validToken(parseCookies(req.headers.cookie)[COOKIE])) return res.redirect(`/__login?next=${encodeURIComponent(req.originalUrl || '/')}`);
    const entry = await getCachedAsset(req.originalUrl);
    let body = entry.body;
    if (/text\/html/i.test(entry.meta.ct || '')) {
      body = Buffer.from(decorateSiteHtml(body.toString('utf8')), 'utf8');
    }
    const headers = { 'content-type': entry.meta.ct || 'application/octet-stream', 'cache-control': /text\/html/i.test(entry.meta.ct || '') ? 'no-store' : 'public, max-age=3600' };
    if (/gzip/.test(req.headers['accept-encoding'] || '') && /text\/|javascript|json|xml|svg/i.test(entry.meta.ct || '')) {
      res.set({ ...headers, 'content-encoding': 'gzip' });
      return res.status(entry.meta.status || 200).send(zlib.gzipSync(body));
    }
    res.set(headers).status(entry.meta.status || 200).send(body);
  } catch (err) { next(err); }
});
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: 'Error interno' });
});

initDb().then(() => {
  const storage = USE_DB ? 'PostgreSQL' : 'JSON local';
  app.listen(PORT, HOST, () => console.log(`Herediano React + ${storage} corriendo en http://${HOST}:${PORT}`));
}).catch((err) => {
  console.error('No se pudo inicializar el almacenamiento:', err);
  process.exit(1);
});
