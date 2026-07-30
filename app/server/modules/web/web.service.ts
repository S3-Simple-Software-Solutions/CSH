import { ApiError } from '../../core/errors';
import {
  deleteHeroImage,
  HERO_DEFAULT_IMAGE,
  readHeroImage,
  readWebData,
  WEB_DEFAULTS,
  WebConfig,
  writeHeroImage,
  writeWebData,
} from './web.repository';

export interface PublicHero {
  kicker: string;
  title: string;
  number: string;
  sub: string;
  imageUrl: string;
}

export function resolvePublicHero(): PublicHero {
  const config = readWebData();
  return {
    kicker: config.kicker || WEB_DEFAULTS.kicker,
    title: config.title || WEB_DEFAULTS.title,
    number: config.number || WEB_DEFAULTS.number,
    sub: config.sub || WEB_DEFAULTS.sub,
    imageUrl: config.imageVersion ? `/site-assets/hero?v=${config.imageVersion}` : HERO_DEFAULT_IMAGE,
  };
}

export function getWebConfig() {
  return { config: readWebData(), defaults: WEB_DEFAULTS };
}

export function saveWebTexts(body: Record<string, unknown>): WebConfig {
  const data = readWebData();
  for (const key of ['kicker', 'title', 'number', 'sub'] as const) {
    const value = String(body[key] ?? '').trim().slice(0, 120);
    data[key] = value && value !== WEB_DEFAULTS[key] ? value : null;
  }
  writeWebData(data);
  return data;
}

export function saveHeroImage(body: unknown, contentType: string | undefined): WebConfig {
  if (!Buffer.isBuffer(body) || !body.length) throw new ApiError(400, 'Envia la imagen como cuerpo binario (PNG, JPG, WebP o AVIF)');
  writeHeroImage(body);
  const data = readWebData();
  data.imageType = contentType || null;
  data.imageVersion = Date.now();
  writeWebData(data);
  return data;
}

export function removeHeroImage(): WebConfig {
  const data = readWebData();
  data.imageType = null;
  data.imageVersion = null;
  deleteHeroImage();
  writeWebData(data);
  return data;
}

export function getHeroImage(): { imageType: string; buffer: Buffer } | null {
  const data = readWebData();
  const buffer = readHeroImage();
  if (!data.imageType || !buffer) return null;
  return { imageType: data.imageType, buffer };
}
