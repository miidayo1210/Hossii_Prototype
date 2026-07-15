import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

// セキュリティ回帰テスト:
//   過去、クライアントバンドルへ Anthropic API キーが混入していた。原因は
//   `import.meta.env` をオブジェクトごと参照した箇所があり、Vite が全 VITE_ 変数を
//   バンドルへインライン展開していたこと（他機能の秘匿値も巻き込む）。
//   本テストは、その混入経路が再発しないことを静的に保証する。

const SRC_DIR = resolve(__dirname, '..');
const REPO_ROOT = resolve(__dirname, '..', '..');

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

// // 行コメントと /* */ ブロックコメントを除去（誤検知防止）。
function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

describe('client bundle secret-leak guard', () => {
  const files = collectSourceFiles(SRC_DIR);

  it('has source files to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('never references import.meta.env as a whole object (would inline every VITE_ secret)', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const code = stripComments(readFileSync(file, 'utf8'));
      // `import.meta.env` の直後が `.識別子` でないもの（= オブジェクト全体参照）を検出
      const re = /import\.meta\.env(?!\s*\.\s*[A-Za-z_$])/g;
      if (re.test(code)) {
        offenders.push(file.replace(REPO_ROOT + '/', ''));
      }
    }
    expect(offenders, `bare import.meta.env in: ${offenders.join(', ')}`).toEqual([]);
  });

  it('does not hardcode an Anthropic key anywhere in source', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const code = readFileSync(file, 'utf8');
      if (code.includes('sk-ant-')) offenders.push(file.replace(REPO_ROOT + '/', ''));
    }
    expect(offenders, `Anthropic key literal in: ${offenders.join(', ')}`).toEqual([]);
  });

  it('does not expose a client-side Anthropic env var (VITE_ANTHROPIC_API_KEY) in source', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const code = readFileSync(file, 'utf8');
      if (code.includes('VITE_ANTHROPIC_API_KEY')) {
        offenders.push(file.replace(REPO_ROOT + '/', ''));
      }
    }
    expect(offenders, `VITE_ANTHROPIC_API_KEY referenced in: ${offenders.join(', ')}`).toEqual([]);
  });

  it('tracked .env.example carries no real Anthropic key', () => {
    const example = join(REPO_ROOT, '.env.example');
    if (!existsSync(example)) return;
    const content = readFileSync(example, 'utf8');
    expect(content.includes('sk-ant-')).toBe(false);
  });
});
