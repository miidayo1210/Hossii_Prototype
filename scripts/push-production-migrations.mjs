#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  assertLinkedTarget,
  PRODUCTION_CONFIRM_VALUE,
} from './lib/supabase-target.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

assertLinkedTarget('production');

const confirm = process.env.CONFIRM_PRODUCTION;
if (confirm !== PRODUCTION_CONFIRM_VALUE) {
  console.error(
    `[db:push:prod] Refusing to push migrations to Production without CONFIRM_PRODUCTION=${PRODUCTION_CONFIRM_VALUE}`,
  );
  process.exit(1);
}

function runSupabase(args) {
  const result = spawnSync('supabase', args, {
    stdio: 'inherit',
    cwd: repoRoot,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('[db:push:prod] Running dry-run against Production...');
runSupabase(['db', 'push', '--dry-run']);

console.log('[db:push:prod] Applying migrations to Production...');
runSupabase(['db', 'push', '--yes']);

console.log('[db:push:prod] Done.');
