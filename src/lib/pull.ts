import { POLL_INTERVAL_MS, POLL_TIMEOUT_MS } from './constants';
import { errorMessage, supabase } from './supabase';
import type { PullResponse } from './types';

export interface PullRequest {
  count: number;
  /** 'solar' when the filter is on, null otherwise. */
  solar: 'solar' | null;
  /** 'two-story' when the filter is on, null otherwise. */
  stories: 'two-story' | null;
}

/**
 * Module-level so an in-flight pull survives navigating between pages. Without
 * it the Pull button would look idle on return and a second click would start
 * another real, billable pull.
 */
let inFlight: { pullId: string; count: number } | null = null;

export function getInFlightPull(): { pullId: string; count: number } | null {
  return inFlight;
}
export function setInFlightPull(value: { pullId: string; count: number } | null): void {
  inFlight = value;
}

/**
 * Calls the pull-leads Edge Function. The n8n URL and secret live on the
 * server — the browser only ever talks to Supabase.
 */
export async function startPull(request: PullRequest): Promise<PullResponse> {
  const { data, error } = await supabase.functions.invoke<PullResponse>('pull-leads', {
    body: request,
  });

  if (error) {
    // FunctionsHttpError carries the response body, which holds our message.
    const context = (error as { context?: Response }).context;
    let detail = '';
    if (context && typeof context.json === 'function') {
      try {
        const payload = (await context.json()) as { error?: string };
        if (typeof payload?.error === 'string') detail = payload.error;
      } catch {
        // Body wasn't JSON — fall back to the generic message below.
      }
    }
    throw new Error(detail || errorMessage(error, 'The pull service did not respond.'));
  }

  if (!data || !data.pull_id) {
    throw new Error('The pull service returned an unexpected response.');
  }
  return data;
}

/* ============================================================================
   Live progress
   ========================================================================== */

/**
 * What the UI gets from ut_pull_progress. The RPC also returns `cost_cents`
 * (supplier cost); it is deliberately absent here so nothing can render it.
 */
export interface PullProgress {
  delivered: number;
  discarded: number;
  processing: number;
  touched: number;
  running: boolean;
  startedAt: string | null;
}

function toProgress(raw: unknown): PullProgress {
  const row = (raw ?? {}) as Record<string, unknown>;
  const num = (key: string) => {
    const value = Number(row[key]);
    return Number.isFinite(value) ? value : 0;
  };
  return {
    delivered: num('delivered'),
    discarded: num('discarded'),
    processing: num('processing'),
    touched: num('touched'),
    running: row.running === true,
    startedAt: typeof row.started_at === 'string' ? row.started_at : null,
  };
}

/** Consecutive idle readings required before we call a pull finished. */
const IDLE_READINGS_TO_FINISH = 2;
/** Before any activity is seen, give n8n this long to claim the first batch. */
const STARTUP_GRACE_MS = 10_000;

/**
 * Polls ut_pull_progress every POLL_INTERVAL_MS, reporting each reading, and
 * resolves with the final state once the pull is over.
 *
 * `running` in the RPC is just "any row currently claimed", so it is false
 * both before n8n claims the first batch and in the gap between one batch
 * landing and the next being claimed. Finishing on a single idle reading
 * would therefore cut healthy pulls short. We require two consecutive idle
 * readings, and — until some activity has been observed — a startup grace
 * period, so a slow first claim is not mistaken for an empty result.
 *
 * The 5-minute timeout is a safety net only: it restarts whenever
 * `delivered` or `processing` moves, so a large, healthy pull never expires
 * just for being large.
 */
export async function pollPullProgress(
  pullId: string,
  target: number,
  onProgress: (progress: PullProgress) => void,
): Promise<PullProgress> {
  const startedAt = Date.now();
  let lastChangeAt = startedAt;
  let readings = 0;
  let idleReadings = 0;
  let sawActivity = false;
  let previous: PullProgress | null = null;

  for (;;) {
    const { data, error } = await supabase.rpc('ut_pull_progress', { p_pull_id: pullId });
    if (error) throw error;

    const progress = toProgress(data);
    readings += 1;
    onProgress(progress);

    const now = Date.now();
    if (
      !previous ||
      previous.delivered !== progress.delivered ||
      previous.processing !== progress.processing
    ) {
      lastChangeAt = now;
    }
    if (progress.running || progress.touched > 0) sawActivity = true;
    idleReadings = progress.running ? 0 : idleReadings + 1;

    const settled = readings >= 2 && (sawActivity || now - startedAt >= STARTUP_GRACE_MS);
    if (settled && !progress.running) {
      // Target reached: nothing more can arrive, no need to wait out the debounce.
      if (progress.delivered >= target) return progress;
      if (idleReadings >= IDLE_READINGS_TO_FINISH) return progress;
    }

    if (now - lastChangeAt > POLL_TIMEOUT_MS) {
      throw new Error(
        'The pull has made no progress for five minutes. It may still finish — check Recent pulls in a moment.',
      );
    }

    previous = progress;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

/* ============================================================================
   Time-remaining estimate — pure, so it can be unit tested
   ========================================================================== */

export interface Reading {
  /** ms since epoch */
  t: number;
  delivered: number;
}

/**
 * Keeps the last `max` readings where `delivered` actually changed. Leads
 * arrive in batches of ~100, so most polls repeat the previous number; keeping
 * only the distinct ones gives a rate that spans real movement instead of a
 * flat stretch, where the rate would be zero.
 */
export function pushReading(history: Reading[], reading: Reading, max = 5): Reading[] {
  const last = history[history.length - 1];
  if (last && last.delivered === reading.delivered) return history;
  return [...history, reading].slice(-max);
}

/**
 * ms until done, from the measured pace between the oldest and newest distinct
 * readings. Counts down through flat stretches by subtracting the time since
 * the last change. Returns null until two distinct readings exist — a guess
 * that early is worse than none.
 */
export function estimateRemainingMs(history: Reading[], target: number, now: number): number | null {
  if (history.length < 2) return null;
  const first = history[0];
  const last = history[history.length - 1];
  const rate = (last.delivered - first.delivered) / (last.t - first.t); // leads per ms
  if (!(rate > 0)) return null;
  const remaining = (target - last.delivered) / rate - (now - last.t);
  return Math.max(0, remaining);
}

export function formatRemaining(ms: number | null): string {
  if (ms === null) return 'estimating…';
  const seconds = ms / 1000;
  if (seconds < 10) return 'less than 10s left';
  if (seconds < 90) return `about ${Math.max(10, Math.round(seconds / 5) * 5)}s left`;
  return `about ${Math.max(2, Math.round(seconds / 60))}m left`;
}
