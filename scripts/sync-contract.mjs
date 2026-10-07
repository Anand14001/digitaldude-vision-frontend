/**
 * Copies the API's generated contract into this project.
 *
 * The two projects are deliberately separate, so this is a one-way file copy
 * rather than a package dependency: run the API's `npm run emit:contract`, then
 * this, and the UI type-checks against the current API enums and permissions.
 *
 *   node scripts/sync-contract.mjs [pathToApiProject]
 */
import fs from 'node:fs';
import path from 'node:path';

const apiRoot =
  process.argv[2] ??
  process.env.API_PROJECT_PATH ??
  path.resolve(process.cwd(), '..', 'digital-dude-api');

const source = path.join(apiRoot, 'contract', 'contract.ts');
const target = path.resolve(process.cwd(), 'src', 'types', 'contract.ts');

if (!fs.existsSync(source)) {
  console.error(
    `\nCould not find ${source}\n` +
      `Run "npm run emit:contract" in the API project first, or pass its path:\n` +
      `  node scripts/sync-contract.mjs ../path/to/digital-dude-api\n`,
  );
  process.exit(1);
}

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);

const lines = fs.readFileSync(target, 'utf8').split('\n').length;
console.log(`Contract synced to src/types/contract.ts (${lines} lines)`);
