/**
 * Checks that every deep link the API puts in a notification or email resolves
 * to a route this app defines.
 *
 *   npm run check:links
 *
 * A notification that lands on "page not found" is worse than no notification,
 * and nothing else catches it: the link is a string in one codebase and the
 * route is JSX in another, so neither compiler can see the mismatch.
 */
import fs from 'node:fs';
import path from 'node:path';

const apiRoot =
  process.argv[2] ??
  process.env.API_PROJECT_PATH ??
  path.resolve(process.cwd(), '..', 'digital-dude-api');

const apiSrc = path.join(apiRoot, 'src');
if (!fs.existsSync(apiSrc)) {
  console.error(`\nCannot find the API source at ${apiSrc}\n`);
  process.exit(1);
}

// ---- every link the API hands to a person -------------------------------
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : full.endsWith('.ts') ? [full] : [];
  });
}

const links = new Set();
for (const file of walk(apiSrc)) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/link:\s*[`'"]([^`'"]+)[`'"]/g)) {
    links.add(match[1]);
  }
  // ctaUrl values are built from an origin plus a path.
  for (const match of source.matchAll(/webOrigins\[0\] \?\? ''\}(\/[A-Za-z0-9/_-]+)/g)) {
    links.add(match[1]);
  }
}

// ---- every route the SPA defines ----------------------------------------
const appSource = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');
const routes = [...appSource.matchAll(/path="([^"]+)"/g)].map((match) => match[1]);

// Nested routes sit under "/" for staff and "/portal" for clients.
const portalRoutes = ['', 'projects/:id', 'approvals', 'approvals/:id', 'files', 'team'];
const absolute = new Set();
for (const route of routes) {
  if (route.startsWith('/')) absolute.add(route);
  else if (route !== '*') {
    absolute.add(`/${route}`);
    if (portalRoutes.includes(route)) absolute.add(`/portal/${route}`);
  }
}
// The portal's own children are declared relative inside its parent route.
for (const route of portalRoutes) absolute.add(route ? `/portal/${route}` : '/portal');

/** Turns a route pattern into a matcher, treating :params as one segment. */
function matches(link, pattern) {
  const linkParts = link.split('/').filter(Boolean);
  const patternParts = pattern.split('/').filter(Boolean);
  if (pattern.endsWith('/*')) {
    const base = patternParts.slice(0, -1);
    return base.every((part, index) => part === linkParts[index]);
  }
  if (linkParts.length !== patternParts.length) return false;
  return patternParts.every(
    (part, index) => part.startsWith(':') || part === linkParts[index],
  );
}

// A link carrying a template expression stands for one path segment.
const normalise = (link) => link.replace(/\$\{[^}]+\}/g, ':id');

const broken = [];
for (const link of [...links].sort()) {
  const normalised = normalise(link);
  const hit = [...absolute].some((pattern) => matches(normalised, pattern));
  console.log(`${hit ? 'ok  ' : 'FAIL'} ${link}`);
  if (!hit) broken.push(link);
}

console.log(`\n${links.size - broken.length}/${links.size} deep links resolve`);
if (broken.length) {
  console.log('\nThese would land on "page not found":');
  for (const link of broken) console.log(`  ${link}`);
  console.log('\nAdd a route in src/App.tsx, or change the link in the API.\n');
  process.exit(1);
}
