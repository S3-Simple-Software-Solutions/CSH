import fs from 'fs';
import { DATA_DIR, WEB_FILE, HERO_IMG_FILE } from '../../config/constants';

export interface WebConfig {
  kicker: string | null;
  title: string | null;
  number: string | null;
  sub: string | null;
  imageType: string | null;
  imageVersion: number | null;
}

export const WEB_DEFAULTS = {
  kicker: 'Clausura 2026 · Campeón Nacional',
  title: 'Campeón',
  number: '32',
  sub: 'Nuestra pasión es eterna',
};

export const HERO_DEFAULT_IMAGE = '/brand/hero/champions-bw.jpg';

export function readWebData(): WebConfig {
  try {
    const d = JSON.parse(fs.readFileSync(WEB_FILE, 'utf8'));
    return { kicker: d.kicker || null, title: d.title || null, number: d.number || null, sub: d.sub || null, imageType: d.imageType || null, imageVersion: d.imageVersion || null };
  } catch {
    return { kicker: null, title: null, number: null, sub: null, imageType: null, imageVersion: null };
  }
}

export function writeWebData(data: WebConfig): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(WEB_FILE, `${JSON.stringify(data, null, 2)}\n`);
}

export function writeHeroImage(buffer: Buffer): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(HERO_IMG_FILE, buffer);
}

export function deleteHeroImage(): void {
  try {
    fs.unlinkSync(HERO_IMG_FILE);
  } catch {
    /* noop */
  }
}

export function readHeroImage(): Buffer | null {
  if (!fs.existsSync(HERO_IMG_FILE)) return null;
  return fs.readFileSync(HERO_IMG_FILE);
}
