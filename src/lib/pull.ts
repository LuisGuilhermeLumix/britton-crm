import { POLL_INTERVAL_MS, POLL_TIMEOUT_MS } from './constants';
import { errorMessage, supabase } from './supabase';
import type { PullResponse, PullRow } from './types';

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

/**
 * Polls ut_v_pulls until the row for this pull shows up with leads > 0.
 * Resolves with the row, or throws on timeout.
 */
export async function waitForPull(
  pullId: string,
  options: { signal?: AbortSignal; onTick?: (elapsedMs: number) => void } = {},
): Promise<PullRow> {
  const startedAt = Date.now();

  for (;;) {
    if (options.signal?.aborted) throw new Error('Cancelled');

    const { data, error } = await supabase
      .from('ut_v_pulls')
      .select('*')
      .eq('pull_id', pullId)
      .maybeSingle();

    if (error) throw error;
    if (data && (data as PullRow).leads > 0) return data as PullRow;

    const elapsed = Date.now() - startedAt;
    options.onTick?.(elapsed);
    if (elapsed > POLL_TIMEOUT_MS) {
      throw new Error(
        'The pull is taking longer than five minutes. It may still finish — check Recent pulls in a moment.',
      );
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}
