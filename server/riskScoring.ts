import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type TransactionInput = {
  step: number;
  type: string;
  amount: number;
  oldbalanceOrg: number;
  newbalanceOrig: number;
  oldbalanceDest: number;
  newbalanceDest: number;
};

export type Assessment = {
  risk_score: number;
  fraud_probability: number;
  decision: "APPROVE" | "VERIFY" | "REVIEW";
  reasons: string[];
  recommended_action: string;
  generated_at: string;
};

const ROOT = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(ROOT, "model_assets");

export async function getModelMetadata() {
  return JSON.parse(await readFile(join(ASSETS, "metadata.json"), "utf8"));
}

export function parseCsv(csv: string): TransactionInput[] {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error("CSV must include a header and at least one data row.");
  const headers = lines[0].split(",").map((value) => value.trim());
  const required = ["step", "type", "amount", "oldbalanceOrg", "newbalanceOrig", "oldbalanceDest", "newbalanceDest"];
  const missing = required.filter((field) => !headers.includes(field));
  if (missing.length) throw new Error(`Missing required PaySim fields: ${missing.join(", ")}`);

  return lines.slice(1).map((line, index) => {
    const values = line.split(",");
    const row = Object.fromEntries(headers.map((header, i) => [header, values[i]?.trim() ?? ""]));
    const numeric = (field: string) => {
      const value = Number(row[field]);
      if (!Number.isFinite(value)) throw new Error(`Invalid ${field} value on row ${index + 2}.`);
      return value;
    };
    return {
      step: numeric("step"),
      type: row.type,
      amount: numeric("amount"),
      oldbalanceOrg: numeric("oldbalanceOrg"),
      newbalanceOrig: numeric("newbalanceOrig"),
      oldbalanceDest: numeric("oldbalanceDest"),
      newbalanceDest: numeric("newbalanceDest"),
    };
  });
}

export function toScoredCsv(rows: TransactionInput[], assessments: Assessment[]) {
  const headers = ["step", "type", "amount", "oldbalanceOrg", "newbalanceOrig", "oldbalanceDest", "newbalanceDest", "risk_score", "decision", "recommended_action"];
  const escape = (value: unknown) => `"${String(value).replaceAll('"', '""')}"`;
  const lines = rows.map((row, i) => [
    row.step, row.type, row.amount, row.oldbalanceOrg, row.newbalanceOrig, row.oldbalanceDest, row.newbalanceDest,
    assessments[i].risk_score, assessments[i].decision, assessments[i].recommended_action,
  ].map(escape).join(","));
  return [headers.join(","), ...lines].join("\n");
}

export async function scoreTransactions(rows: TransactionInput[]): Promise<Assessment[]> {
  return new Promise((resolve, reject) => {
    const python = process.env.PYTHON_BIN || "python3";
    const child = spawn(python, [join(ASSETS, "model_runner.py")], { cwd: ASSETS });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", (error) => reject(new Error(`Model runtime unavailable: ${error.message}`)));
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(stderr || `Model runtime exited with code ${code}`));
      try {
        resolve(JSON.parse(stdout).results as Assessment[]);
      } catch {
        reject(new Error("Model runtime returned invalid output."));
      }
    });
    child.stdin.end(JSON.stringify({ rows }));
  });
}
