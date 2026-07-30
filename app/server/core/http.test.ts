import { describe, expect, it } from 'vitest';
import { escapeHtml, parseCookies, safeEqual, safeNext } from './http';

describe('http helpers', () => {
  it('escapes HTML-sensitive characters', () => {
    expect(escapeHtml('<script data-x="1">Tom & Jerry</script>')).toBe('&lt;script data-x=&quot;1&quot;&gt;Tom &amp; Jerry&lt;/script&gt;');
    expect(escapeHtml("Herediano's")).toBe('Herediano&#39;s');
  });

  it('parses cookie headers and decodes values', () => {
    expect(parseCookies('hsid=abc123; theme=dark%20mode; empty=')).toEqual(
      new Map([
        ['hsid', 'abc123'],
        ['theme', 'dark mode'],
        ['empty', ''],
      ]),
    );
  });

  it('parses unsafe cookie names without writing object properties', () => {
    const cookies = parseCookies('__proto__=polluted; constructor=changed; hsid=abc123');
    expect(cookies.get('__proto__')).toBe('polluted');
    expect(cookies.get('constructor')).toBe('changed');
    expect(cookies.get('hsid')).toBe('abc123');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('compares equal strings safely without accepting different lengths', () => {
    expect(safeEqual('secret', 'secret')).toBe(true);
    expect(safeEqual('secret', 'Secret')).toBe(false);
    expect(safeEqual('secret', 'secret-extra')).toBe(false);
  });

  it('keeps next redirects local to the app', () => {
    expect(safeNext('/admin/parqueo')).toBe('/admin/parqueo');
    expect(safeNext('https://evil.example/admin', '/admin')).toBe('/admin');
    expect(safeNext('//evil.example', '/admin')).toBe('/admin');
    expect(safeNext('/\\evil', '/admin')).toBe('/admin');
    expect(safeNext('/admin\nSet-Cookie:bad', '/admin')).toBe('/admin');
  });
});
