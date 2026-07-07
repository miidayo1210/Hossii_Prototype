import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');
const environmentsPath = join(repoRoot, 'config', 'supabase-environments.json');
const linkedRefPath = join(repoRoot, 'supabase', '.temp', 'project-ref');

export function loadSupabaseEnvironments() {
  const raw = readFileSync(environmentsPath, 'utf8');
  return JSON.parse(raw);
}

export function readLinkedProjectRef() {
  if (!existsSync(linkedRefPath)) {
    throw new Error(`Linked project ref not found: ${linkedRefPath}`);
  }
  return readFileSync(linkedRefPath, 'utf8').trim();
}

export function getEnvironmentByName(name) {
  const environments = loadSupabaseEnvironments();
  const entry = environments[name];
  if (!entry?.projectRef) {
    throw new Error(`Unknown Supabase environment: ${name}`);
  }
  return { name, ...entry };
}

export function assertLinkedTarget(expectedEnvironmentName) {
  const expected = getEnvironmentByName(expectedEnvironmentName);
  const linkedRef = readLinkedProjectRef();

  if (linkedRef !== expected.projectRef) {
    console.error(
      `[supabase-target] Expected ${expectedEnvironmentName} (${expected.projectRef}), but CLI is linked to ${linkedRef}.`,
    );
    process.exit(1);
  }

  return { linkedRef, expected };
}

export function isProductionRef(projectRef) {
  const productionRef = getEnvironmentByName('production').projectRef;
  return projectRef === productionRef;
}

export function isDevelopmentRef(projectRef) {
  const developmentRef = getEnvironmentByName('development').projectRef;
  return projectRef === developmentRef;
}

export const PRODUCTION_CONFIRM_VALUE = 'wzyoddyvfjkagqpnjejo';
