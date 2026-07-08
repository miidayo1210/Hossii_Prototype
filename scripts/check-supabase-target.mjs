#!/usr/bin/env node
import { assertLinkedTarget } from './lib/supabase-target.mjs';

const target = process.argv[2];

if (!target || !['development', 'production'].includes(target)) {
  console.error('Usage: node scripts/check-supabase-target.mjs <development|production>');
  process.exit(1);
}

const { linkedRef, expected } = assertLinkedTarget(target);
console.log(`Supabase CLI is linked to ${expected.label} (${linkedRef}).`);
