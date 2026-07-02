import 'dotenv/config';

function num(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value: string | undefined): boolean {
  return String(value || '').toLowerCase() === 'true';
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable de entorno obligatoria ausente: ${name}`);
  return value;
}

export const env = {
  PORT: num(process.env.PORT, 8088),
  HOST: '0.0.0.0',
  DATABASE_URL: requireEnv('DATABASE_URL'),
  SECRET: process.env.HEREDIANO_SECRET || 'cambie-esta-clave-herediano-secret-2026',
  SESSION_HOURS: num(process.env.HEREDIANO_SESSION_HOURS, 12),
  ADMIN_SESSION_HOURS: num(process.env.HEREDIANO_ADMIN_SESSION_HOURS, 8),
  AUTH_USER: process.env.HEREDIANO_USER || 'admin',
  AUTH_PASS: process.env.HEREDIANO_PASS || 'herediano2026',
  ADMIN_USER: process.env.HEREDIANO_ADMIN_USER || 'admin',
  ADMIN_EMAIL: process.env.HEREDIANO_ADMIN_EMAIL || 'admin@herediano.com',
  CONTACT_EMAIL: process.env.HEREDIANO_CONTACT_EMAIL || 'servicioalcliente@herediano.com',
  ADMIN_PASS: process.env.HEREDIANO_ADMIN_PASS || '',
  MAIL_FROM: process.env.HEREDIANO_MAIL_FROM || '"Club Sport Herediano" <herediano@milocalhost.work>',
  MAIL_APP_URL: process.env.HEREDIANO_APP_URL || 'https://herediano.milocalhost.work',
  SMTP_HOST: process.env.HEREDIANO_SMTP_HOST || process.env.SMTP_HOST || '127.0.0.1',
  SMTP_PORT: num(process.env.HEREDIANO_SMTP_PORT || process.env.SMTP_PORT, 1587),
  SMTP_SECURE: bool(process.env.HEREDIANO_SMTP_SECURE || process.env.SMTP_SECURE),
  SMTP_USER: process.env.HEREDIANO_SMTP_USER || process.env.SMTP_USER || '',
  SMTP_PASS: process.env.HEREDIANO_SMTP_PASS || process.env.SMTP_PASS || '',
  // Analytics: agente Claude vía el proxy api_agents del workspace.
  AGENTS_BASE_URL: process.env.AGENTS_BASE_URL || 'http://127.0.0.1:3400',
  AGENTS_API_KEY: process.env.AGENTS_API_KEY || '',
  ANALYTICS_MODEL: process.env.ANALYTICS_MODEL || 'claude-sonnet-4-6',
  // Pagos: pasarela seleccionable (hoy solo 'stripe'). La tarjeta nunca toca
  // este servidor; se cobra con Stripe Checkout (página hospedada).
  PAYMENTS_PROVIDER: process.env.HEREDIANO_PAYMENTS_PROVIDER || 'stripe',
  STRIPE_SECRET_KEY: process.env.HEREDIANO_STRIPE_SECRET_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.HEREDIANO_STRIPE_WEBHOOK_SECRET || '',
  STRIPE_CURRENCY: process.env.HEREDIANO_STRIPE_CURRENCY || 'crc',
};

// Guardrail de demo: este entorno es sandbox. Si alguien configura una llave
// de producción (sk_live_...), abortamos el arranque para no arriesgar cobros reales.
if (env.PAYMENTS_PROVIDER === 'stripe' && env.STRIPE_SECRET_KEY.startsWith('sk_live_')) {
  throw new Error('Este demo solo admite llaves de prueba de Stripe (sk_test_...). Se detectó una llave sk_live_.');
}
