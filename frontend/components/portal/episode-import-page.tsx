"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Activity, ArrowLeft, Database, FileUp, WandSparkles } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/components/toast/toast-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  generateAndImportEpisodes,
  getEpisodeSeedPreview,
  importEpisodes,
  importSeedEpisodes,
} from "@/lib/api";
import type { EpisodeImportSummary, EpisodeSeedRow } from "@/lib/types";

const SEED_PAGE_SIZE = 10;

export function EpisodeImportPage() {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const [seedRows, setSeedRows] = useState<EpisodeSeedRow[]>([]);
  const [seedRowCount, setSeedRowCount] = useState(0);
  const [seedPage, setSeedPage] = useState(0);
  const [seedPreviewError, setSeedPreviewError] = useState<string | null>(null);
  const [isSeedPreviewLoading, setIsSeedPreviewLoading] = useState(true);
  const [generatedCount, setGeneratedCount] = useState(1000);
  const [isImporting, setIsImporting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<EpisodeImportSummary | null>(null);
  const [importSource, setImportSource] = useState("");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setIsSeedPreviewLoading(true);
    getEpisodeSeedPreview(token, { limit: SEED_PAGE_SIZE, offset: seedPage * SEED_PAGE_SIZE })
      .then((result) => {
        if (cancelled) return;
        setSeedRows(result.items);
        setSeedRowCount(result.total);
        setSeedPreviewError(null);
      })
      .catch((cause) => {
        if (cancelled) return;
        setSeedPreviewError(cause instanceof Error ? cause.message : "Could not load the bundled CSV preview.");
      })
      .finally(() => {
        if (!cancelled) setIsSeedPreviewLoading(false);
      });
    return () => { cancelled = true; };
  }, [seedPage, token]);

  function showImportResult(result: EpisodeImportSummary, source: string) {
    setImportSummary(result);
    setImportSource(source);
    showToast({
      kind: result.skipped_count ? "info" : "success",
      title: `${source} import complete`,
      description: `${result.imported_count} imported; ${result.skipped_count} skipped.`,
    });
  }

  async function handleSeedImport() {
    if (!token) return;
    setIsImporting(true);
    setImportError(null);
    setImportSummary(null);
    try {
      showImportResult(await importSeedEpisodes(token), "Seed CSV");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Please try again.";
      setImportError(message);
      showToast({ kind: "error", title: "Seed import failed", description: message });
    } finally {
      setIsImporting(false);
    }
  }

  async function handleGenerateImport() {
    if (!token) return;
    setIsGenerating(true);
    setImportError(null);
    setImportSummary(null);
    try {
      showImportResult(await generateAndImportEpisodes(generatedCount, token), "Generated episode");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Please try again.";
      setImportError(message);
      showToast({ kind: "error", title: "Episode generation failed", description: message });
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCsvImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem("episode-csv");
    const file = input instanceof HTMLInputElement ? input.files?.[0] : undefined;
    if (!file || !token) {
      showToast({ kind: "error", title: "Choose a CSV file", description: "Select an episode export before starting the import." });
      return;
    }

    setIsImporting(true);
    setImportError(null);
    setImportSummary(null);
    try {
      showImportResult(await importEpisodes(await file.text(), token), "Episode CSV");
      form.reset();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Please try again.";
      setImportError(message);
      showToast({ kind: "error", title: "Episode import failed", description: message });
    } finally {
      setIsImporting(false);
    }
  }

  const workspaceBase = `/${user?.role ?? "operator"}`;
  const busy = isImporting || isGenerating;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <section>
          <p className="text-sm font-medium text-brand-blue">Operations workspace</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-brand-navy sm:text-3xl">Import episodes</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-text">Preview the supplied recording export, generate clean test data, or import another CSV. Duplicate episode IDs are skipped safely.</p>
        </section>
        <Link href={`${workspaceBase}/episodes`} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-body-text transition hover:bg-page-background">
          <ArrowLeft aria-hidden="true" size={16} />
          Episode inventory
        </Link>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-col gap-4 border-b border-border sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Bundled seed CSV</CardTitle>
            <CardDescription>Preview {seedRowCount.toLocaleString()} rows from <code>seed/episodes.csv</code>, then import them into the inventory.</CardDescription>
          </div>
          <button type="button" onClick={() => void handleSeedImport()} disabled={busy || isSeedPreviewLoading || Boolean(seedPreviewError)} className="inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-blue-hover disabled:cursor-not-allowed disabled:opacity-60">
            <Database aria-hidden="true" size={16} />
            {isImporting ? "Importing seed…" : "Import seed CSV"}
          </button>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-xs">
            <thead className="bg-page-background uppercase tracking-wide text-muted-text">
              <tr>
                {[
                  "Line", "Episode", "Robot", "Task", "Recorded at", "Duration", "Operator", "Quality",
                ].map((heading) => <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {seedRows.map((row) => (
                <tr key={row.line_number} className="hover:bg-page-background/70">
                  <td className="whitespace-nowrap px-4 py-3 text-muted-text">{row.line_number}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-brand-navy">{row.episode_id || <span className="text-status-warning">Missing</span>}</td>
                  <td className="px-4 py-3 text-body-text">{row.robot_id || <span className="text-status-warning">Missing</span>}</td>
                  <td className="min-w-40 px-4 py-3 text-body-text">{row.task_name || <span className="text-status-warning">Missing</span>}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-body-text">{row.recorded_at || <span className="text-status-warning">Missing</span>}</td>
                  <td className="px-4 py-3 text-body-text">{row.duration_seconds || <span className="text-status-warning">Missing</span>}</td>
                  <td className="px-4 py-3 text-body-text">{row.operator_name || <span className="text-status-warning">Missing</span>}</td>
                  <td className="px-4 py-3 text-body-text">{row.quality || <span className="text-status-warning">Missing</span>}</td>
                </tr>
              ))}
              {!isSeedPreviewLoading && !seedPreviewError && seedRows.length === 0 ? <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-text">No seed rows to preview.</td></tr> : null}
            </tbody>
          </table>
          {isSeedPreviewLoading ? <p role="status" className="px-4 py-5 text-sm text-muted-text">Loading CSV preview…</p> : null}
          {seedPreviewError ? <p role="alert" className="border-t border-status-bad/20 bg-status-bad/5 px-4 py-4 text-sm text-status-bad">Could not load the bundled CSV: {seedPreviewError}</p> : null}
        </div>
        <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-text">Showing {seedRowCount ? seedPage * SEED_PAGE_SIZE + 1 : 0}–{Math.min((seedPage + 1) * SEED_PAGE_SIZE, seedRowCount)} of {seedRowCount.toLocaleString()} seed rows</p>
          <div className="flex justify-end gap-2">
            <button type="button" disabled={seedPage === 0 || isSeedPreviewLoading} onClick={() => setSeedPage((page) => Math.max(0, page - 1))} className="min-h-9 cursor-pointer rounded-lg border border-border px-3 text-xs font-medium text-body-text disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
            <button type="button" disabled={(seedPage + 1) * SEED_PAGE_SIZE >= seedRowCount || isSeedPreviewLoading} onClick={() => setSeedPage((page) => page + 1)} className="min-h-9 cursor-pointer rounded-lg border border-border px-3 text-xs font-medium text-body-text disabled:cursor-not-allowed disabled:opacity-50">Next</button>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Generate test episodes</CardTitle>
            <CardDescription>Run the supplied generator and import clean records. Repeated IDs are skipped safely.</CardDescription>
          </CardHeader>
          <CardContent>
            <label className="block text-sm font-medium text-brand-navy" htmlFor="generated-episode-count">Number of episodes</label>
            <input id="generated-episode-count" type="number" min={1} max={20000} step={100} value={generatedCount} onChange={(event) => setGeneratedCount(Number(event.target.value))} className="mt-2 min-h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-brand-navy outline-none focus:border-brand-blue" />
            <p className="mt-2 text-xs text-muted-text">Choose 1–20,000 rows. Larger batches can be generated from the command line.</p>
            <button type="button" onClick={() => void handleGenerateImport()} disabled={busy || generatedCount < 1 || generatedCount > 20000} className="mt-4 inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-brand-blue px-4 py-2 text-sm font-semibold text-brand-blue transition hover:bg-brand-soft-blue disabled:cursor-not-allowed disabled:opacity-50">
              <WandSparkles aria-hidden="true" size={16} />
              {isGenerating ? "Generating and importing…" : "Generate and import"}
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Import another CSV</CardTitle>
            <CardDescription>Upload a recording-system export. Re-imports are safe, and invalid or duplicate rows are reported.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(event) => void handleCsvImport(event)} className="flex h-full flex-col justify-between gap-4">
              <label className="block text-sm font-medium text-brand-navy" htmlFor="episode-csv">CSV file
                <input id="episode-csv" name="episode-csv" type="file" accept=".csv,text/csv" className="mt-2 block w-full cursor-pointer rounded-lg border border-border bg-surface px-3 py-2 text-sm text-body-text file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-brand-soft-blue file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand-blue" />
              </label>
              <button type="submit" disabled={busy} className="inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-blue-hover disabled:cursor-not-allowed disabled:opacity-60">
                {isImporting ? <Activity aria-hidden="true" className="animate-spin" size={16} /> : <FileUp aria-hidden="true" size={16} />}
                {isImporting ? "Importing episodes…" : "Import CSV"}
              </button>
            </form>
          </CardContent>
        </Card>
      </div>

      {importError ? <p role="alert" className="rounded-lg border border-status-bad/20 bg-status-bad/5 px-4 py-3 text-sm text-status-bad">Import failed: {importError}</p> : null}
      {importSummary ? (
        <Card aria-live="polite">
          <CardHeader>
            <CardTitle>{importSource} results</CardTitle>
            <CardDescription>Rows read, imported, and skipped are summarized here. You can review the resulting records in the inventory.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <ImportCount label="Rows read" value={importSummary.total_rows} tone="neutral" />
              <ImportCount label="Imported" value={importSummary.imported_count} tone="good" />
              <ImportCount label="Skipped" value={importSummary.skipped_count} tone={importSummary.skipped_count ? "warning" : "good"} />
            </div>
            {importSummary.skipped_rows.length ? (
              <div className="mt-5 overflow-hidden rounded-lg border border-border">
                <div className="border-b border-border bg-page-background px-4 py-3 text-sm font-medium text-brand-navy">Skipped rows and reasons</div>
                <div className="max-h-64 overflow-y-auto divide-y divide-border">
                  {importSummary.skipped_rows.map((issue) => <div key={`${issue.line_number}-${issue.reason}`} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-4"><span className="text-xs font-medium text-muted-text">CSV line {issue.line_number}</span><span className="break-words text-body-text">{issue.reason}</span></div>)}
                </div>
              </div>
            ) : <p className="mt-5 rounded-lg border border-status-good/20 bg-status-good/5 px-4 py-3 text-sm text-status-good">All rows imported successfully. No rows were skipped.</p>}
            <div className="mt-5">
              <Link href={`${workspaceBase}/episodes`} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-blue-hover">View episode inventory</Link>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function ImportCount({ label, value, tone }: { label: string; value: number; tone: "neutral" | "good" | "warning" }) {
  const color = tone === "good" ? "text-status-good" : tone === "warning" ? "text-status-warning" : "text-brand-navy";
  return <div className="rounded-lg border border-border bg-page-background px-4 py-3"><p className="text-[10px] font-medium uppercase tracking-wide text-muted-text">{label}</p><p className={`mt-1 text-lg font-semibold tabular-nums ${color}`}>{value.toLocaleString()}</p></div>;
}
