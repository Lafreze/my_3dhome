import { createHmac } from 'node:crypto';
import { S3Client } from '@aws-sdk/client-s3';
import { sha256, PREFIX } from './asset-policy.mjs';

export function scopedCredentials(env, endpoint, prune = false) {
  if (env.R2_SESSION_TOKEN)
    return {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      sessionToken: env.R2_SESSION_TOKEN,
    };
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  // Cloudflare's local temporary-credential protocol; signed only in this Node process.
  const claims = {
    sub: env.R2_ACCOUNT_ID,
    iss: env.R2_ACCESS_KEY_ID,
    aud: new URL(endpoint).host,
    iat: now,
    exp: now + 3600,
    bucket: env.R2_BUCKET_NAME,
    actions: [
      'GetObject',
      'HeadObject',
      'PutObject',
      'ListObjectsV2',
      ...(prune ? ['DeleteObject'] : []),
    ],
    paths: { prefixPaths: [PREFIX], objectPaths: [] },
  };
  const input = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}`;
  const jwt = `${input}.${createHmac('sha256', env.R2_SECRET_ACCESS_KEY).update(input).digest('base64url')}`;
  return {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: sha256(jwt),
    sessionToken: Buffer.from(`jwt/${jwt}`).toString('base64'),
  };
}
export function createR2Client(env = process.env, { prune = false } = {}) {
  for (const key of [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
  ])
    if (!env[key])
      throw new Error(`Missing ${key}; configure .env.r2.local or CI secrets`);
  const endpoint =
    env.R2_ENDPOINT || `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const url = new URL(endpoint);
  // Never send write credentials to an arbitrary endpoint or redirect host.
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/' ||
    !new RegExp(
      `^${env.R2_ACCOUNT_ID.replace(/[^a-zA-Z0-9]/g, '')}(\\.(eu|fedramp))?\\.r2\\.cloudflarestorage\\.com$`,
    ).test(url.hostname)
  )
    throw new Error(
      'R2_ENDPOINT must belong to the configured Cloudflare account',
    );
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(env.R2_BUCKET_NAME))
    throw new Error('Invalid R2_BUCKET_NAME');
  return new S3Client({
    region: 'auto',
    endpoint,
    forcePathStyle: true,
    maxAttempts: 3,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    credentials: async () => scopedCredentials(env, endpoint, prune),
  });
}
