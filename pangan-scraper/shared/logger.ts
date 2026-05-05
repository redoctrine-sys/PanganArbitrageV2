import { getClient } from "./supabase";
import type { ScrapeRunResult } from "./types";

export async function startRun(source: string, metadata?: Record<string, unknown>): Promise<string> {
  const sb = getClient();
  const { data, error } = await sb
    .from("scrape_runs")
    .insert({ source, status: "running", metadata: metadata ?? null })
    .select("id")
    .single();
  if (error) throw new Error(`startRun failed: ${error.message}`);
  return data.id as string;
}

export async function finishRun(runId: string, result: ScrapeRunResult): Promise<void> {
  const sb = getClient();
  const { error } = await sb
    .from("scrape_runs")
    .update({
      finished_at: new Date().toISOString(),
      status: result.status,
      rows_scraped: result.rows_scraped,
      rows_inserted: result.rows_inserted,
      rows_updated: result.rows_updated,
      rows_skipped: result.rows_skipped,
      duration_ms: result.duration_ms,
      error_message: result.error_message ?? null,
      metadata: result.metadata ?? null,
    })
    .eq("id", runId);
  if (error) console.error(`[logger] finishRun failed: ${error.message}`);
}

export function log(...args: unknown[]): void {
  const ts = new Date().toISOString();
  console.log(`[${ts}]`, ...args);
}

export function debug(...args: unknown[]): void {
  if (process.env.DEBUG === "1") {
    const ts = new Date().toISOString();
    console.log(`[${ts}] [DEBUG]`, ...args);
  }
}
