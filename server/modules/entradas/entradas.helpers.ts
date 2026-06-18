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
