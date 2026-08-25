import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { parseCsv, scoreTransactions, toScoredCsv, type TransactionInput } from "./riskScoring";
import { z } from "zod";

const transactionSchema = z.object({
  step: z.number().min(0),
  type: z.enum(["PAYMENT", "TRANSFER", "CASH_OUT", "DEBIT", "CASH_IN"]),
  amount: z.number().min(0),
  oldbalanceOrg: z.number().min(0),
  newbalanceOrig: z.number().min(0),
  oldbalanceDest: z.number().min(0),
  newbalanceDest: z.number().min(0),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  risk: router({
    metadata: publicProcedure.query(async () => {
      const { getModelMetadata } = await import("./riskScoring");
      return getModelMetadata();
    }),
    assess: publicProcedure.input(transactionSchema).mutation(async ({ input }) => {
      const [assessment] = await scoreTransactions([input]);
      return assessment;
    }),
    batch: publicProcedure.input(z.object({ csv: z.string().min(1).max(8_000_000) })).mutation(async ({ input }) => {
      const rows = parseCsv(input.csv);
      if (rows.length > 5000) throw new Error("Please upload no more than 5,000 rows at a time.");
      const assessments = await scoreTransactions(rows);
      return { csv: toScoredCsv(rows, assessments), count: rows.length, assessments };
    }),
  }),
});

export type AppRouter = typeof appRouter;
