import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

// Capture CLI output: never print the service-role key to CI logs.
const output = execFileSync(
  process.execPath,
  ['node_modules/supabase/dist/supabase.js', 'status', '-o', 'json'],
  {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
const status = JSON.parse(output);
const url = status.API_URL;
if (!url || !['127.0.0.1', 'localhost'].includes(new URL(url).hostname))
  throw new Error('This helper is for local Supabase only.');
const managerPassword = `M!${randomBytes(18).toString('hex')}`;
const executorPassword = `E!${randomBytes(18).toString('hex')}`;
const secondPassword = `B!${randomBytes(18).toString('hex')}`;
const credentials = `MANAGER_EMAIL=manager@crm.test\nMANAGER_PASSWORD=${managerPassword}\nEXECUTOR_EMAIL=alice@crm.test\nEXECUTOR_PASSWORD=${executorPassword}\nSECOND_EXECUTOR_EMAIL=bob@crm.test\nSECOND_EXECUTOR_PASSWORD=${secondPassword}\n`;
writeFileSync(
  '.env.local',
  `VITE_SUPABASE_URL=${url}\nVITE_SUPABASE_ANON_KEY=${status.ANON_KEY}\n`,
);
writeFileSync(
  '.env.seed',
  `SUPABASE_URL=${url}\nSUPABASE_SERVICE_ROLE_KEY=${status.SERVICE_ROLE_KEY}\nSUPABASE_ANON_KEY=${status.ANON_KEY}\n${credentials}`,
);
writeFileSync(
  '.env.e2e',
  `SUPABASE_URL=${url}\nSUPABASE_ANON_KEY=${status.ANON_KEY}\n${credentials}`,
);
console.log(
  'Local environment written. Credentials: .env.e2e. Admin key stays in ignored .env.seed.',
);
