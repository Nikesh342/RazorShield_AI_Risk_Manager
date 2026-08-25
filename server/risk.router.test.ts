import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const ctx: TrpcContext = {
  user: undefined,
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: { clearCookie: () => undefined } as TrpcContext["res"],
};

const validInput = { step: 100, type: "TRANSFER" as const, amount: 25000, oldbalanceOrg: 50000, newbalanceOrig: 25000, oldbalanceDest: 10000, newbalanceDest: 35000 };
const csv = "step,type,amount,oldbalanceOrg,newbalanceOrig,oldbalanceDest,newbalanceDest\n100,TRANSFER,25000,50000,25000,10000,35000";

describe("risk router", () => {
  it("returns verified training metadata", async () => {
    const result = await appRouter.createCaller(ctx).risk.metadata();
    expect(result.dataset).toBe("PS_20174392719_1491204439457_log.csv");
    expect(result.metrics.roc_auc).toBeGreaterThan(0.99);
  });

  it("assesses through the real model", async () => {
    const result = await appRouter.createCaller(ctx).risk.assess(validInput);
    expect(result.fraud_probability).toBeGreaterThanOrEqual(0);
    expect(result.fraud_probability).toBeLessThanOrEqual(1);
    expect(result.reasons.length).toBeGreaterThan(0);
  }, 30_000);

  it("scores a batch and returns downloadable CSV content", async () => {
    const result = await appRouter.createCaller(ctx).risk.batch({ csv });
    expect(result.count).toBe(1);
    expect(result.csv).toContain("risk_score");
  }, 30_000);

  it("rejects a batch larger than 5,000 rows", async () => {
    const rows = Array.from({ length: 5001 }, (_, i) => `100,TRANSFER,25000,50000,25000,10000,35000`).join("\n");
    await expect(appRouter.createCaller(ctx).risk.batch({ csv: `step,type,amount,oldbalanceOrg,newbalanceOrig,oldbalanceDest,newbalanceDest\n${rows}` })).rejects.toThrow("5,000 rows");
  });
});
