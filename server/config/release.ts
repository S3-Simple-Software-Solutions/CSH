import fs from 'fs';
import path from 'path';
import { ROOT_DIR } from './constants';

interface ReleaseManifest {
  version?: unknown;
  sha?: unknown;
  source?: unknown;
  deployedAt?: unknown;
  rebuiltAt?: unknown;
}

function text(value: unknown): string | null {
  const str = String(value || '').trim();
  return str || null;
}

export function getReleaseInfo() {
  const manifestPath = path.join(ROOT_DIR, 'RELEASE_MANIFEST.json');

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as ReleaseManifest;
    return {
      version: text(manifest.version) || text(process.env.CSH_RELEASE_VERSION) || 'local',
      sha: text(manifest.sha),
      source: text(manifest.source),
      deployedAt: text(manifest.deployedAt || manifest.rebuiltAt),
    };
  } catch {
    return {
      version: text(process.env.CSH_RELEASE_VERSION) || 'local',
      sha: text(process.env.GITHUB_SHA),
      source: 'runtime',
      deployedAt: null,
    };
  }
}
