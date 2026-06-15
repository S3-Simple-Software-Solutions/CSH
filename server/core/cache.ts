import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { CACHE_DIR, ORIGIN, UA } from '../config/constants';

export interface CacheMeta {
  status: number;
  ct: string;
}

export interface CacheEntry {
  body: Buffer;
  meta: CacheMeta;
}

fs.mkdirSync(CACHE_DIR, { recursive: true });

export function keyFor(url: string): string {
  return crypto.createHash('sha1').update(url).digest('hex');
}

function readCache(key: string): CacheEntry | null {
  const dataPath = path.join(CACHE_DIR, key);
  const metaPath = `${dataPath}.meta`;
  if (!fs.existsSync(dataPath) || !fs.existsSync(metaPath)) return null;
  try {
    return { body: fs.readFileSync(dataPath), meta: JSON.parse(fs.readFileSync(metaPath, 'utf8')) };
  } catch {
    return null;
  }
}

function writeCache(key: string, body: Buffer, meta: CacheMeta): void {
  const dataPath = path.join(CACHE_DIR, key);
  fs.writeFileSync(dataPath, body);
  fs.writeFileSync(`${dataPath}.meta`, JSON.stringify(meta));
}

export function rewrite(buf: Buffer, ct: string | undefined): Buffer {
  if (!/text\/|javascript|json|xml|svg/i.test(ct || '')) return buf;
  return Buffer.from(
    buf
      .toString('utf8')
      .split('https://www.herediano.com')
      .join('')
      .split('https://herediano.com')
      .join('')
      .split('http://www.herediano.com')
      .join(''),
    'utf8',
  );
}

export async function fetchOrigin(reqUrl: string): Promise<CacheEntry> {
  const response = await fetch(ORIGIN + reqUrl, { headers: { 'user-agent': UA, accept: '*/*' }, redirect: 'follow' });
  const ct = response.headers.get('content-type') || 'application/octet-stream';
  return { body: rewrite(Buffer.from(await response.arrayBuffer()), ct), meta: { status: response.status, ct } };
}

export async function getCachedAsset(reqPath: string): Promise<CacheEntry> {
  const key = keyFor(reqPath);
  let entry = readCache(key);
  if (!entry) {
    const fresh = await fetchOrigin(reqPath);
    writeCache(key, fresh.body, fresh.meta);
    entry = { body: fresh.body, meta: fresh.meta };
  }
  return entry;
}
