// Generación de identificadores y payload de QR (sin firma, validado por lookup en BD,
// igual que el módulo de parqueo).

export function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const ACCENTS: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u', ñ: 'n' };

export function slugify(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[áéíóúüñ]/g, (ch) => ACCENTS[ch] || ch)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

export function boletoCodigo(): string {
  return `ENT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

// Payload plano del QR: código legible + identificadores + correo del comprador.
export function qrData(codigo: string, eventoId: string, tipoId: string, email: string): string {
  return `${codigo}|${eventoId}|${tipoId}|${email}`;
}

// El escáner de puerta puede enviar el QR completo o solo el código.
export function extractCodigo(input: unknown): string {
  return String(input || '').trim().split('|')[0].trim().toUpperCase();
}

// Normaliza códigos ingresados por el usuario (descuento / promotor): sin espacios,
// mayúsculas, solo alfanumérico y guiones.
export function normalizeCodigo(input: unknown): string {
  return String(input || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

// ── Cálculo de totales del checkout ─────────────────────────────────
// Regla fijada: el cargo por servicio se calcula sobre (subtotal − descuento).

export type FeeTipo = 'pct' | 'crc' | 'ninguno';
export type DescuentoTipo = 'pct' | 'monto';

export interface FeeConfig {
  tipo: FeeTipo;
  valor: number;
}

export interface DescuentoAplicado {
  tipo: DescuentoTipo;
  valor: number;
}

export interface Totales {
  subtotal: number;
  descuento: number;
  fee: number;
  total: number;
}

export function calcularDescuento(subtotal: number, desc: DescuentoAplicado | null): number {
  if (!desc || subtotal <= 0 || desc.valor <= 0) return 0;
  const bruto = desc.tipo === 'pct' ? Math.round((subtotal * desc.valor) / 100) : Math.round(desc.valor);
  return Math.max(0, Math.min(bruto, subtotal)); // el descuento nunca supera el subtotal
}

export function calcularFee(base: number, fee: FeeConfig | null): number {
  if (!fee || fee.tipo === 'ninguno' || fee.valor <= 0 || base <= 0) return 0;
  return fee.tipo === 'pct' ? Math.round((base * fee.valor) / 100) : Math.round(fee.valor);
}

export function calcularTotales(subtotal: number, fee: FeeConfig | null, desc: DescuentoAplicado | null): Totales {
  const s = Math.max(0, Math.round(subtotal));
  const descuento = calcularDescuento(s, desc);
  const base = s - descuento;
  const feeCrc = calcularFee(base, fee);
  return { subtotal: s, descuento, fee: feeCrc, total: Math.max(0, base + feeCrc) };
}

// ── Preventa / tandas de precio ─────────────────────────────────────
// La tanda activa es la primera (por orden) vigente por fecha y con cupo
// disponible. Si ninguna aplica, el tipo vende a su precio base.

export interface TandaLike {
  nombre: string;
  precioCrc: number;
  ventaDesde: string | null;
  ventaHasta: string | null;
  cupo: number | null;
  vendidos: number;
  orden: number;
}

// ── Asientos numerados ──────────────────────────────────────────────
// Etiqueta de fila estilo hoja de cálculo: 0 → A, 25 → Z, 26 → AA.

export function filaLabel(index: number): string {
  let n = Math.max(0, Math.floor(index));
  let label = '';
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

export function asientoLabel(fila: string, numero: number): string {
  return `Fila ${fila} · Asiento ${numero}`;
}

export function tandaActiva<T extends TandaLike>(tandas: T[], now: Date = new Date()): T | null {
  const candidatas = [...tandas].sort((a, b) => a.orden - b.orden);
  for (const t of candidatas) {
    if (t.ventaDesde && new Date(t.ventaDesde) > now) continue;
    if (t.ventaHasta && new Date(t.ventaHasta) < now) continue;
    if (t.cupo != null && t.vendidos >= t.cupo) continue;
    return t;
  }
  return null;
}
