import path from 'path';
import { env } from './env';

// Paths are resolved against the project root (process.cwd()), not __dirname,
// so they keep working after compiling server/ to dist-server/.
export const ROOT_DIR = process.cwd();
export const DATA_DIR = path.join(ROOT_DIR, 'data');
export const DIST_DIR = path.join(ROOT_DIR, 'dist');
export const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
export const CUPONERA_FILE = path.join(DATA_DIR, 'cuponera.json');
export const WEB_FILE = path.join(DATA_DIR, 'web.json');
export const HERO_IMG_FILE = path.join(DATA_DIR, 'hero-bg.bin');

export const SITE_LOGO_PATH = '/brand/logo-shield.png';
export const COOKIE = 'hsid';
export const ADMIN_COOKIE = 'csh_admin';
export const TARIFA_HORA = 1000;

export interface Sponsor {
  name: string;
  path: string;
  cid: string;
  height: number;
}

export const OFFICIAL_SPONSORS: Sponsor[] = [
  { name: 'Reebok', path: '/brand/sponsors/reebok.png', cid: 'sponsor-reebok', height: 42 },
  { name: 'Taqueritos', path: '/brand/sponsors/taqueritos.png', cid: 'sponsor-taqueritos', height: 34 },
  { name: 'Hariana', path: '/brand/sponsors/hariana.png', cid: 'sponsor-hariana', height: 34 },
  { name: 'Transcomer British International', path: '/brand/sponsors/transcomer.png', cid: 'sponsor-transcomer', height: 34 },
  { name: 'Electrolit', path: '/brand/sponsors/electrolit.png', cid: 'sponsor-electrolit', height: 34 },
  { name: 'Chery', path: '/brand/sponsors/chery.png', cid: 'sponsor-chery', height: 34 },
  { name: 'Solo Cracks', path: '/brand/partner-solocracks.png', cid: 'sponsor-solocracks', height: 34 },
];

export const SECRET = env.SECRET;
export const SESSION_HOURS = env.SESSION_HOURS;
export const ADMIN_SESSION_HOURS = env.ADMIN_SESSION_HOURS;
