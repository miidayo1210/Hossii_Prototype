#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { assertLinkedTarget } from './lib/supabase-target.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

assertLinkedTarget('development');

function runSupabase(args) {
  const result = spawnSync('supabase', args, {
    stdio: 'inherit',
    cwd: repoRoot,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('[db:push:dev] Running dry-run...');
runSupabase(['db', 'push', '--dry-run']);

console.log('[db:push:dev] Applying migrations to Development...');
runSupabase(['db', 'push', '--yes']);

console.log('[db:push:dev] Done.');
