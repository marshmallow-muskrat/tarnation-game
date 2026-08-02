import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

type PackageManifest = { version?: unknown };

function currentCommit(): string {
  const fromEnvironment = process.env.VITE_COMMIT_SHA ?? process.env.GITHUB_SHA;
  if (fromEnvironment?.trim()) return fromEnvironment.trim();
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

const manifest = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as PackageManifest;
const version = typeof manifest.version === 'string' ? manifest.version : 'unknown';
const commit = currentCommit();

export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    __TARNATION_BUILD_INFO__: JSON.stringify({
      version,
      commit,
      buildId: `${version}+${commit}`,
    }),
  },
  build: {
    outDir: 'dist',
  },
  server: {
    // Honour PORT so a second dev server can run alongside the default one.
    port: Number(process.env.PORT) || 5183,
  },
});
