import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

type CompileInput = {
  latex: string;
  timeoutMs: number;
  tempRootDir: string;
};

type CompileResult = {
  pdfBuffer: Buffer;
  compileOutput: string;
};

export class CompileError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode = 400, code = "compile_failed") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

async function runLatexMk(workingDir: string, timeoutMs: number): Promise<string> {
  return await new Promise((resolve, reject) => {
    const args = [
      "-pdf",
      "-interaction=nonstopmode",
      "-halt-on-error",
      "-file-line-error",
      "-no-shell-escape",
      "input.tex"
    ];

    const proc = spawn("latexmk", args, { cwd: workingDir, stdio: ["ignore", "pipe", "pipe"] });

    let output = "";
    proc.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });

    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new CompileError("LaTeX compile timed out", 504, "compile_timeout"));
    }, timeoutMs);

    proc.once("error", (err) => {
      clearTimeout(timer);
      reject(new CompileError(`Unable to run latexmk: ${err.message}`, 500, "compiler_unavailable"));
    });

    proc.once("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(output);
        return;
      }
      reject(new CompileError(`LaTeX compilation failed`, 422, "compile_failed"));
    });
  });
}

export async function compileLatexToPdf(input: CompileInput): Promise<CompileResult> {
  const baseDir = input.tempRootDir || os.tmpdir();
  const workspace = await mkdtemp(path.join(baseDir, "compile-"));

  try {
    const texPath = path.join(workspace, "input.tex");
    const pdfPath = path.join(workspace, "input.pdf");

    await writeFile(texPath, input.latex, "utf8");
    const compileOutput = await runLatexMk(workspace, input.timeoutMs);

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await readFile(pdfPath);
    } catch {
      throw new CompileError("PDF artifact missing after compile", 500, "missing_artifact");
    }

    return { pdfBuffer, compileOutput };
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}
