import crypto from 'crypto';

const HASH_ALGORITHM = 'sha256';
const HASH_ITERATIONS = 120000;
const HASH_KEY_LENGTH = 32;
const HASH_PREFIX = 'pbkdf2';

function timingSafeTextEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_KEY_LENGTH, HASH_ALGORITHM).toString('hex');
  return `${HASH_PREFIX}$${HASH_ALGORITHM}$${HASH_ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password: unknown, storedHash: string): boolean {
  const passwordText = String(password || '');
  const parts = String(storedHash || '').split('$');
  if (parts.length !== 5 || parts[0] !== HASH_PREFIX) return timingSafeTextEqual(passwordText, String(storedHash || ''));

  const [, algorithm, iterationsText, salt, expected] = parts;
  const iterations = Number(iterationsText);
  if (algorithm !== HASH_ALGORITHM || !Number.isFinite(iterations) || iterations < 1 || !salt || !expected) return false;

  const actual = crypto.pbkdf2Sync(passwordText, salt, iterations, Buffer.from(expected, 'hex').length, algorithm).toString('hex');
  return timingSafeTextEqual(actual, expected);
}
