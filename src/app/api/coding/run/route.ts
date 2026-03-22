import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorStatus } from '@/lib/auth';
import { exec } from 'child_process';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';

// ─── Helper: promisified exec with stdin support ──────────────────────────────
function execAsync(
  cmd: string,
  opts: { timeout?: number; input?: string } = {},
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise(resolve => {
    const child = exec(
      cmd,
      { timeout: opts.timeout ?? 10_000, windowsHide: true },
      (err, stdout, stderr) => {
        resolve({
          stdout: stdout || '',
          stderr: stderr || '',
          code:   err?.code ?? 0,
        });
      },
    );
    if (opts.input && child.stdin) {
      child.stdin.write(opts.input);
      child.stdin.end();
    }
  });
}

async function ensureTmpDir(): Promise<string> {
  const dir = path.join(os.tmpdir(), 'ipl_code');
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  return dir;
}

// ─── Run C / C++ locally ──────────────────────────────────────────────────────
async function runCpp(
  code: string,
  language: 'c' | 'cpp',
  stdin: string,
): Promise<{ output: string; error: string; success: boolean }> {
  const dir  = await ensureTmpDir();
  const id   = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const ext  = language === 'cpp' ? 'cpp' : 'c';
  const src  = path.join(dir, `sol_${id}.${ext}`);
  const exe  = path.join(dir, `sol_${id}.exe`);

  try {
    await writeFile(src, code, 'utf8');

    // Compile
    const compiler = language === 'cpp' ? 'g++' : 'gcc';
    const compile  = await execAsync(
      `${compiler} "${src}" -o "${exe}" -std=c++14 -O2`,
      { timeout: 15_000 },
    );

    if (compile.code !== 0 || compile.stderr) {
      return { output: '', error: compile.stderr || 'Compilation failed', success: false };
    }

    // Execute
    const run = await execAsync(`"${exe}"`, { timeout: 10_000, input: stdin });

    return {
      output:  run.stdout.trim(),
      error:   run.stderr.trim(),
      success: run.code === 0,
    };
  } finally {
    unlink(src).catch(() => {});
    unlink(exe).catch(() => {});
  }
}

// ─── Run SQL via Python + sqlite3 (no external API) ──────────────────────────
async function runSQL(
  sqlCode: string,
): Promise<{ output: string; error: string; success: boolean }> {
  const dir    = await ensureTmpDir();
  const id     = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const pyFile = path.join(dir, `sql_${id}.py`);

  const escaped = sqlCode.replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"');

  const script = `
import sqlite3, sys
conn = sqlite3.connect(':memory:')
c = conn.cursor()
c.executescript("""
CREATE TABLE IF NOT EXISTS employees (id INT, name TEXT, salary INT, department_id INT, manager_id INT);
INSERT INTO employees VALUES (1,'Alice',70000,1,NULL),(2,'Bob',80000,1,1),(3,'Carol',90000,2,NULL),(4,'Dave',60000,2,3),(5,'Eve',75000,1,1),(6,'Frank',85000,2,3);
CREATE TABLE IF NOT EXISTS departments (id INT, name TEXT);
INSERT INTO departments VALUES (1,'Engineering'),(2,'Marketing');
CREATE TABLE IF NOT EXISTS orders (id INT, customer_id INT, amount REAL, order_date TEXT);
INSERT INTO orders VALUES (1,1,100.0,'2024-01-01'),(2,1,200.0,'2024-01-15'),(3,2,150.0,'2024-02-01'),(4,3,300.0,'2024-02-10');
CREATE TABLE IF NOT EXISTS customers (id INT, name TEXT, city TEXT);
INSERT INTO customers VALUES (1,'Alice','New York'),(2,'Bob','London'),(3,'Carol','Paris');
""")
sql = """${escaped}"""
try:
    c.execute(sql)
    rows = c.fetchall()
    if rows:
        for row in rows:
            print('  '.join(str(x) for x in row))
    else:
        print("(0 rows)")
except Exception as e:
    print(f"SQL Error: {e}", file=sys.stderr)
    sys.exit(1)
`;

  try {
    await writeFile(pyFile, script, 'utf8');

    // Try python, fallback to python3
    let result = await execAsync(`python "${pyFile}"`, { timeout: 10_000 });
    if (result.code !== 0 && result.stderr.toLowerCase().includes('not recognized')) {
      result = await execAsync(`python3 "${pyFile}"`, { timeout: 10_000 });
    }

    return {
      output:  result.stdout.trim(),
      error:   result.stderr.trim(),
      success: result.code === 0,
    };
  } finally {
    unlink(pyFile).catch(() => {});
  }
}

// ─── POST /api/coding/run ─────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    await requireAuth(['STUDENT', 'INTERVIEWER', 'ADMIN']);

    const { code, language, stdin = '' } = await request.json();

    if (!code || !language) {
      return NextResponse.json({ error: 'code and language are required' }, { status: 400 });
    }

    let result: { output: string; error: string; success: boolean };

    if (language === 'cpp' || language === 'c') {
      result = await runCpp(code, language as 'c' | 'cpp', stdin);
    } else if (language === 'sql') {
      result = await runSQL(code);
    } else {
      return NextResponse.json(
        { error: `Language "${language}" not supported. Use cpp, c, or sql.` },
        { status: 400 },
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Run code error:', error);
    return NextResponse.json(
      { error: error.message || 'Code execution failed' },
      { status: authErrorStatus(error.message) },
    );
  }
}