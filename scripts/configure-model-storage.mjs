import { readFile, writeFile, chmod } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Configure only the user's existing Railway service. Never log credential values.
const scope = [
  '--project',
  'c53bedb9-fc4d-4b94-8139-ca84196431ac',
  '--service',
  'my-3dhome',
  '--environment',
  'production',
];
const existing = JSON.parse(
  execFileSync('railway', ['variable', 'list', ...scope, '--json'], {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }),
);
const r2 = parseEnv(await readFile('.env.r2.local', 'utf8'));
let local = {};
try {
  local = parseEnv(await readFile('.env.models.local', 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const key =
  existing.MODEL_ENCRYPTION_KEY ||
  local.MODEL_ENCRYPTION_KEY ||
  randomBytes(32).toString('base64');
if (Buffer.from(key, 'base64').length !== 32)
  throw Error('Invalid model encryption key');
await writeFile(
  '.env.models.local',
  `MODEL_STORAGE=r2\nMODEL_ENCRYPTION_KEY=${key}\n`,
  { mode: 0o600 },
);
await chmod('.env.models.local', 0o600);
const values = { MODEL_STORAGE: 'r2', MODEL_ENCRYPTION_KEY: key };
for (const name of [
  'R2_ACCOUNT_ID',
  'R2_BUCKET_NAME',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
]) {
  if (!r2[name]) throw Error(`Missing ${name}`);
  values[name] = r2[name];
}
if (r2.R2_ENDPOINT) values.R2_ENDPOINT = r2.R2_ENDPOINT;
for (const [name, value] of Object.entries(values)) {
  if (existing[name] === value) {
    console.log(`${name}: already configured`);
    continue;
  }
  try {
    execFileSync(
      'railway',
      ['variable', 'set', name, '--stdin', '--skip-deploys', ...scope],
      {
        input: value,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 45000,
      },
    );
  } catch {
    throw Error(`Could not configure ${name}; value omitted`);
  }
  console.log(`${name}: configured`);
}
