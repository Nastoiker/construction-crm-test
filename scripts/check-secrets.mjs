import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Buffer } from 'node:buffer';

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const suspiciousPaths = tracked.filter(
  (path) => /(^|\/)\.env($|\.)/.test(path) && !path.endsWith('.example'),
);
function walk(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walk(join(path, entry.name))
      : [join(path, entry.name)],
  );
}
const failures = [...suspiciousPaths];
for (const path of [...tracked, ...walk('dist')]) {
  const text = readFileSync(path, 'utf8');
  if (
    /sb_secret_[\w-]{15,}|sbp_[\w]{20,}|gh[pousr]_[\w]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(
      text,
    )
  )
    failures.push(path);
  for (const token of text.matchAll(/eyJ[\w-]+\.([\w-]+)\.[\w-]+/g)) {
    try {
      if (
        JSON.parse(Buffer.from(token[1], 'base64url').toString()).role ===
        'service_role'
      )
        failures.push(path);
    } catch {
      /* Not a JWT. */
    }
  }
}
if (failures.length)
  throw new Error(
    `Potential secrets in files: ${[...new Set(failures)].join(', ')}`,
  );
console.log(
  `Secret scan passed: ${tracked.length} tracked files and production bundle.`,
);
