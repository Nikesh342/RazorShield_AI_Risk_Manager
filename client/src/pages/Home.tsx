import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { FileUp, ShieldCheck, Sparkles, Activity, ArrowUpRight, Download, AlertTriangle, CheckCircle2, Clock3 } from "lucide-react";

const defaults = { step: 100, type: "TRANSFER" as const, amount: 25000, oldbalanceOrg: 50000, newbalanceOrig: 25000, oldbalanceDest: 10000, newbalanceDest: 35000 };
const fields = [
  ["step", "Simulation hour", "number"], ["amount", "Amount", "number"], ["oldbalanceOrg", "Sender balance before", "number"],
  ["newbalanceOrig", "Sender balance after", "number"], ["oldbalanceDest", "Receiver balance before", "number"], ["newbalanceDest", "Receiver balance after", "number"],
] as const;

function decisionTone(decision?: string) {
  if (decision === "REVIEW") return "review";
  if (decision === "VERIFY") return "verify";
  return "approve";
}

export default function Home() {
  const [form, setForm] = useState(defaults);
  const [assessment, setAssessment] = useState<any>(null);
  const [csv, setCsv] = useState("");
  const [batchResult, setBatchResult] = useState<any>(null);
  const assess = trpc.risk.assess.useMutation({ onSuccess: setAssessment });
  const batch = trpc.risk.batch.useMutation({ onSuccess: setBatchResult });
  const { data: metadata, isLoading: metadataLoading } = trpc.risk.metadata.useQuery();
  const metrics = metadata?.metrics ?? {};
  const riskTone = decisionTone(assessment?.decision);
  const formattedRows = useMemo(() => Number(metadata?.rows_used ?? 0).toLocaleString(), [metadata]);

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: key === "type" ? value : Number(value) } as typeof form));
  const submitBatch = () => batch.mutate({ csv });
  const download = () => {
    if (!batchResult?.csv) return;
    const url = URL.createObjectURL(new Blob([batchResult.csv], { type: "text/csv" }));
    const link = document.createElement("a"); link.href = url; link.download = "razorshield_scored_transactions.csv"; link.click(); URL.revokeObjectURL(url);
  };

  return <div className="app-shell">
    <header className="topbar"><div className="brand"><div className="brand-mark"><ShieldCheck size={21} /></div><div><div className="brand-name">RazorShield</div><div className="brand-sub">AI risk manager</div></div></div><div className="preview-pill"><span className="pulse-dot" /> PREVIEW ENVIRONMENT</div></header>
    <main className="dashboard container">
      <section className="hero"><div><p className="eyebrow"><Sparkles size={14} /> TRANSACTION INTELLIGENCE</p><h1>See the risk<br /><span>before it moves.</span></h1><p className="hero-copy">A focused review console for explainable fraud assessments. Every decision is scored by the trained PaySim Random Forest model on the server.</p></div><div className="hero-aside"><div className="signal-orbit"><div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" /><div className="orbit-core"><Activity size={25} /></div></div><div><div className="aside-label">MODEL STATUS</div><div className="aside-value"><span className="status-dot" /> Online & ready</div><p className="aside-note">PaySim-trained · RF classifier</p></div></div></section>
      <section className="metric-grid"><Metric label="Rows used" value={metadataLoading ? "—" : formattedRows} detail="PaySim training sample" icon={<Activity size={16} />} /><Metric label="Precision" value={metrics.precision ? `${(metrics.precision * 100).toFixed(2)}%` : "—"} detail="Held-out test set" icon={<CheckCircle2 size={16} />} /><Metric label="Recall" value={metrics.recall ? `${(metrics.recall * 100).toFixed(2)}%` : "—"} detail="Held-out test set" icon={<ArrowUpRight size={16} />} /><Metric label="PR-AUC" value={metrics.pr_auc ? metrics.pr_auc.toFixed(4) : "—"} detail="Fraud ranking quality" icon={<Sparkles size={16} />} /></section>
      <Tabs defaultValue="single" className="workspace"><TabsList className="tabs-list"><TabsTrigger value="single">Single assessment</TabsTrigger><TabsTrigger value="batch">Batch scoring</TabsTrigger><TabsTrigger value="model">Model notes</TabsTrigger></TabsList>
        <TabsContent value="single" className="tab-content"><div className="workspace-grid"><Card className="form-card"><CardHeader><div className="section-kicker">01 / INPUT</div><CardTitle>Assess a transaction</CardTitle><p className="muted">Enter a transaction snapshot to generate a review decision.</p></CardHeader><CardContent><div className="type-row"><Label>Transaction type</Label><div className="type-options">{["PAYMENT", "TRANSFER", "CASH_OUT", "DEBIT", "CASH_IN"].map((type) => <button key={type} className={`type-chip ${form.type === type ? "selected" : ""}`} onClick={() => update("type", type)}>{type.replace("_", " ")}</button>)}</div></div><div className="form-grid">{fields.map(([key, label, type]) => <div className="field" key={key}><Label htmlFor={key}>{label}</Label><Input id={key} type={type} value={form[key as keyof typeof form] as number} min={0} onChange={(e) => update(key as keyof typeof form, e.target.value)} /></div>)}</div><Button className="assess-button" disabled={assess.isPending} onClick={() => assess.mutate(form)}>{assess.isPending ? "Scoring with model…" : "Assess risk"}<ArrowUpRight size={17} /></Button>{assess.error && <p className="error-text">{assess.error.message}</p>}</CardContent></Card><Card className={`result-card ${assessment ? `result-${riskTone}` : "result-empty"}`}><CardHeader><div className="section-kicker">02 / DECISION</div><CardTitle>{assessment ? "Assessment ready" : "Awaiting assessment"}</CardTitle></CardHeader><CardContent>{assessment ? <div className="result-body"><div className="decision-line"><Badge className={`decision-badge ${riskTone}`}>{assessment.decision}</Badge><span className="decision-caption">Recommended workflow</span></div><div className="score-row"><div><div className="score-label">Risk score</div><div className="score-value">{assessment.risk_score}<span>/100</span></div></div><div className="probability"><div className="score-label">Fraud probability</div><strong>{(assessment.fraud_probability * 100).toFixed(2)}%</strong></div></div><Progress value={assessment.risk_score} className={`risk-progress ${riskTone}`} /><div className="result-block"><div className="block-title">Recommended action</div><p>{assessment.recommended_action}</p></div><div className="result-block"><div className="block-title">Risk signals</div><div className="signal-list">{assessment.reasons.map((reason: string) => <div className="signal-item" key={reason}><span className="signal-bar" />{reason}</div>)}</div></div><div className="audit-line"><Clock3 size={14} /> Server-scored · {new Date(assessment.generated_at).toLocaleTimeString()}</div></div> : <div className="empty-state"><div className="empty-icon"><ShieldCheck size={24} /></div><p>Complete the fields on the left and run an assessment to see the model’s decision, score, and explanation.</p></div>}</CardContent></Card></div></TabsContent>
        <TabsContent value="batch" className="tab-content"><Card className="batch-card"><CardHeader><div className="section-kicker">BATCH / CSV</div><CardTitle>Score up to 5,000 transactions</CardTitle><p className="muted">Upload a CSV with the seven PaySim fields. The model scores each row on the server.</p></CardHeader><CardContent><label className="upload-zone"><FileUp size={24} /><span>Choose a CSV file</span><small>step · type · amount · balances</small><input type="file" accept=".csv" onChange={(e) => { const file = e.target.files?.[0]; if (file) file.text().then(setCsv); }} /></label>{csv && <div className="file-ready">CSV loaded · {csv.trim().split(/\r?\n/).length - 1} rows detected</div>}<Button className="assess-button" disabled={!csv || batch.isPending} onClick={submitBatch}>{batch.isPending ? "Scoring batch…" : "Score batch"}<ArrowUpRight size={17} /></Button>{batchResult && <div className="batch-result"><div><strong>{batchResult.count.toLocaleString()} rows scored</strong><p className="muted">Your scored file is ready to download.</p></div><Button variant="outline" onClick={download}><Download size={16} /> Download CSV</Button></div>}{batch.error && <p className="error-text">{batch.error.message}</p>}</CardContent></Card></TabsContent>
        <TabsContent value="model" className="tab-content"><Card className="notes-card"><CardHeader><div className="section-kicker">MODEL / CONTEXT</div><CardTitle>Read the signal clearly</CardTitle></CardHeader><CardContent><div className="notes-grid"><Note title="Synthetic training data" text="The model was trained on PaySim, a synthetic financial transaction dataset. It is useful for demonstrating the workflow, not for estimating live production fraud rates." /><Note title="Not connected to Razorpay" text="This preview has no payment gateway, webhook, or live transaction connection. It is a review console only." /><Note title="Held-out evaluation" text={`Evaluation uses a held-out test set of ${(metadata?.test_rows ?? 0).toLocaleString()} rows. Current ROC-AUC is ${metrics.roc_auc?.toFixed(5) ?? "—"}. Treat metrics as prototype evidence.`} /></div><Alert className="limitation-alert"><AlertTriangle size={18} /><div><AlertTitle>Prototype boundary</AlertTitle><AlertDescription>Do not use this dashboard to automatically block real payments or represent it as production fraud infrastructure.</AlertDescription></div></Alert></CardContent></Card></TabsContent>
      </Tabs>
    </main><footer className="footer container"><span>RazorShield / risk review console</span><span>Prototype only · synthetic data</span></footer>
  </div>;
}
function Metric({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) { return <Card className="metric-card"><div className="metric-icon">{icon}</div><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-detail">{detail}</div></Card>; }
function Note({ title, text }: { title: string; text: string }) { return <div className="note"><div className="note-mark" /><div><h3>{title}</h3><p>{text}</p></div></div>; }
