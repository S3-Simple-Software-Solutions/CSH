import { describe, expect, it } from 'vitest';
import { IMG_EXT, slugify } from './id';

describe('id helpers', () => {
  it('normalizes Spanish accents into URL-safe slugs', () => {
    expect(slugify('¡Nueva app del Club Sport Herediano!')).toBe('nueva-app-del-club-sport-herediano');
    expect(slugify('Niñez, fútbol y tradición')).toBe('ninez-futbol-y-tradicion');
  });

  it('trims repeated separators and limits long slugs', () => {
    const slug = slugify(`---${'campeon '.repeat(20)}---`);
    expect(slug.startsWith('campeon-campeon')).toBe(true);
    expect(slug.endsWith('-')).toBe(false);
    expect(slug.length).toBeLessThanOrEqual(80);
  });

  it('maps supported image mime types to extensions', () => {
    expect(IMG_EXT['image/jpeg']).toBe('.jpg');
    expect(IMG_EXT['image/png']).toBe('.png');
    expect(IMG_EXT['image/webp']).toBe('.webp');
    expect(IMG_EXT['image/avif']).toBe('.avif');
  });
});
