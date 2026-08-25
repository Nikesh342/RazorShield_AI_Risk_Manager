import { describe, expect, it } from "vitest";
import { parseCsv, scoreTransactions, toScoredCsv } from "./riskScoring";

describe("RazorShield risk scoring", () => {
  const row = { step: 100, type: "TRANSFER" as const, amount: 25000, oldbalanceOrg: 50000, newbalanceOrig: 25000, oldbalanceDest: 10000, newbalanceDest: 35000 };

  it("parses the seven required PaySim fields", () => {
    const rows = parseCsv("step,type,amount,oldbalanceOrg,newbalanceOrig,oldbalanceDest,newbalanceDest\n100,TRANSFER,25000,50000,25000,10000,35000");
    expect(rows).toEqual([row]);
  });

  it("rejects CSV files missing required fields", () => {
    expect(() => parseCsv("step,type\n100,TRANSFER")).toThrow("Missing required PaySim fields");
  });

  it("scores through the real server-side model and produces a downloadable CSV", async () => {
    const [assessment] = await scoreTransactions([row]);
    expect(assessment.decision).toMatch(/APPROVE|VERIFY|REVIEW/);
    expect(assessment.risk_score).toBeGreaterThanOrEqual(0);
    expect(assessment.risk_score).toBeLessThanOrEqual(100);
    expect(toScoredCsv([row], [assessment])).toContain("risk_score");
  }, 30_000);
});
