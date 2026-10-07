#!/usr/bin/env node
/**
 * Removes .map files from dist/ after the build.
 *
 * vite.config.ts uses `sourcemap: 'hidden'`, so the bundles carry no
 * sourceMappingURL and no browser asks for a map. The files are still written,
 * though, and anything inside dist/ is publicly reachable once deployed - a
 * guessed filename would hand over the whole source tree.
 *
 * So the deploy pipeline builds, uploads the maps wherever they are useful,
 * then strips them. If you add an error reporter (Sentry, Rollbar), put its
 * upload step between `build` and `strip:maps` in the deploy command; until
 * then there is nothing to upload and these are pure exposure.
 */
import { readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

const DIST = 'dist';

async function collect(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await collect(full)));
    else if (entry.name.endsWith('.map')) found.push(full);
  }
  return found;
}

try {
  await stat(DIST);
} catch {
  console.error(`strip:maps - no ${DIST}/ directory; run the build first`);
  process.exit(1);
}

const maps = await collect(DIST);
let bytes = 0;
for (const file of maps) {
  bytes += (await stat(file)).size;
  await rm(file);
}

console.log(
  maps.length
    ? `strip:maps - removed ${maps.length} source map(s), ${(bytes / 1024 / 1024).toFixed(1)} MB`
    : 'strip:maps - no source maps found, nothing to do',
);
