import type { Stage } from './types';

/**
 * Price shown to the client, in USD. The single source of truth: every figure
 * on screen is `quantity × PRICE_PER_LEAD`, never ut_v_pulls.cost_usd, which is
 * the supplier cost and must not surface in the UI.
 */
export const PRICE_PER_LEAD = 0.2;

export const QUICK_QTY = [25, 50, 100, 250];
export const QTY_STEP = 25;

/** Polling for a pull to land in ut_v_pulls. */
export const POLL_INTERVAL_MS = 2000;
export const POLL_TIMEOUT_MS = 5 * 60 * 1000;

export interface StageMeta {
  key: Stage;
  label: string;
  color: string;
}

/** The six board columns, in order. `do_not_call` is deliberately absent. */
export const BOARD_STAGES: StageMeta[] = [
  { key: 'new', label: 'Not contacted', color: '#6B7280' },
  { key: 'calling', label: 'Calling', color: '#F59E0B' },
  { key: 'talked', label: 'Talked', color: '#3B82F6' },
  { key: 'appointment', label: 'Booked', color: '#A855F7' },
  { key: 'won', label: 'Done', color: '#22C55E' },
  { key: 'lost', label: 'Not interested', color: '#EF4444' },
];

export const DO_NOT_CALL: StageMeta = { key: 'do_not_call', label: 'Do not call', color: '#3F3F46' };

const ALL_STAGES: StageMeta[] = [...BOARD_STAGES, DO_NOT_CALL];

export function stageMeta(stage: Stage | string): StageMeta {
  return ALL_STAGES.find((s) => s.key === stage) ?? { key: 'new', label: String(stage), color: '#6B7280' };
}

export type PageKey = 'pull' | 'dashboard' | 'pipeline';

export const PAGES: { key: PageKey; label: string }[] = [
  { key: 'pull', label: 'Pull Leads' },
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'pipeline', label: 'Pipeline' },
];

export type DateFilterKey = 'today' | 'yesterday' | '7' | '30' | 'month' | 'custom';

export const DATE_FILTERS: { key: DateFilterKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7', label: '7 days' },
  { key: '30', label: '30 days' },
  { key: 'month', label: 'This month' },
  { key: 'custom', label: 'Custom' },
];
