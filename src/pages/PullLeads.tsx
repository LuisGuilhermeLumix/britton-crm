import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Checkbox } from '../components/Checkbox';
import { Skeleton } from '../components/Skeleton';
import { PRICE_PER_LEAD, QTY_STEP, QUICK_QTY } from '../lib/constants';
import { longDate, money, timeOfDay } from '../lib/format';
import {
  estimateRemainingMs,
  formatRemaining,
  getInFlightPull,
  pollPullProgress,
  pushReading,
  setInFlightPull,
  startPull,
  type PullProgress,
  type Reading,
} from '../lib/pull';
import { errorMessage } from '../lib/supabase';
import { useData } from '../providers/DataProvider';
import { useToast } from '../providers/ToastProvider';

const PHASES = [
  'Searching homes in Salt Lake City…',
  'Finding owner name and phone…',
  'Scrubbing against the Do Not Call list…',
  'Saving to your pipeline…',
];

/** The caption follows real progress rather than a timer. */
function phaseFor(pct: number): number {
  if (pct <= 0) return 0;
  if (pct < 60) return 1;
  if (pct < 100) return 2;
  return 3;
}

type Status = 'idle' | 'running' | 'failed';

interface LiveProgress {
  target: number;
  delivered: number;
  pct: number;
  /** A batch is in flight and the number hasn't moved — show the sheen. */
  working: boolean;
  remaining: string;
}

export function PullLeads() {
  const { pulls, loadingPulls, refreshAll, refreshPulls } = useData();
  const toast = useToast();

  const [qty, setQty] = useState<number | null>(50);
  const [solarOnly, setSolarOnly] = useState(false);
  const [twoStoryOnly, setTwoStoryOnly] = useState(false);

  const [status, setStatus] = useState<Status>('idle');
  const [live, setLive] = useState<LiveProgress | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const resumed = useRef(false);
  const history = useRef<Reading[]>([]);
  const lastPct = useRef(0);

  const count = qty ?? 0;
  const cost = count * PRICE_PER_LEAD;

  /** Folds one RPC reading into what the bar shows. */
  const onProgress = useCallback((target: number, progress: PullProgress) => {
    const now = Date.now();
    const pct = Math.min(100, Math.round((progress.delivered / Math.max(1, target)) * 100));
    history.current = pushReading(history.current, { t: now, delivered: progress.delivered });
    const working = progress.processing > 0 && pct === lastPct.current;
    lastPct.current = pct;
    setLive({
      target,
      delivered: progress.delivered,
      pct,
      working,
      remaining: formatRemaining(estimateRemainingMs(history.current, target, now)),
    });
  }, []);

  /** Waits for a pull that has already been handed to n8n. */
  const awaitPull = useCallback(
    async (pullId: string, target: number) => {
      setInFlightPull({ pullId, count: target });
      history.current = [];
      lastPct.current = 0;
      setLive({ target, delivered: 0, pct: 0, working: true, remaining: 'estimating…' });

      try {
        const final = await pollPullProgress(pullId, target, (progress) => onProgress(target, progress));
        const delivered = final.delivered;
        // Price the client sees is always leads × PRICE_PER_LEAD — never the
        // RPC's cost_cents, which is the supplier cost.
        const price = money(delivered * PRICE_PER_LEAD);

        setLive((current) => (current ? { ...current, pct: 100, working: false, remaining: '' } : current));

        if (delivered >= target) {
          toast.success(`${delivered} leads pulled · ${price}`);
        } else {
          // Partial is not a failure: the stock for this filter ran out.
          toast.warning(
            `${delivered} of ${target} leads pulled · ${price} — not enough addresses available for this filter.`,
          );
        }

        // Refresh Recent pulls and invalidate the leads cache the other pages read.
        await refreshAll();
        setStatus('idle');
        setLive(null);
      } catch (error) {
        const message = errorMessage(error, 'The pull could not be completed.');
        setFailure(message);
        setStatus('failed');
        setLive(null);
        toast.error(message);
        // The pull may have partially landed; make sure history is current.
        void refreshPulls();
      } finally {
        setInFlightPull(null);
      }
    },
    [onProgress, refreshAll, refreshPulls, toast],
  );

  /** Reattach to a pull that was still running when we navigated away. */
  useEffect(() => {
    if (resumed.current) return;
    resumed.current = true;
    const active = getInFlightPull();
    if (!active) return;
    setQty(active.count);
    setStatus('running');
    void awaitPull(active.pullId, active.count);
  }, [awaitPull]);

  async function handlePull() {
    if (!count || status === 'running' || getInFlightPull()) return;

    setStatus('running');
    setFailure(null);

    let response;
    try {
      response = await startPull({
        count,
        solar: solarOnly ? 'solar' : null,
        stories: twoStoryOnly ? 'two-story' : null,
      });
    } catch (error) {
      const message = errorMessage(error, 'The pull could not be started.');
      setFailure(message);
      setStatus('failed');
      toast.error(message);
      return;
    }

    await awaitPull(response.pull_id, response.requested || count);
  }

  function updateQty(next: number) {
    setQty(Math.max(1, next));
  }

  const running = status === 'running';
  const bothFilters = solarOnly && twoStoryOnly;

  return (
    <>
      <section className="page-header">
        <h2>Pull Leads</h2>
        <p>Homeowners in Salt Lake City, with name and phone number already verified.</p>
      </section>

      <section className="card" style={{ maxWidth: 720, marginInline: 'auto', width: '100%' }}>
        <div className="field-group">
          <p className="label-sm">Quantity</p>
          <div className="field-inline">
            <div className="stepper">
              <button
                type="button"
                className="btn-secondary"
                aria-label="Decrease quantity"
                disabled={running}
                onClick={() => updateQty(count - QTY_STEP)}
              >
                −
              </button>
              <input
                className="qty-input"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                aria-label="Quantity"
                disabled={running}
                value={qty ?? ''}
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, '');
                  setQty(digits ? parseInt(digits, 10) : null);
                }}
                onBlur={() => {
                  if (!qty) setQty(1);
                }}
              />
              <button
                type="button"
                className="btn-secondary"
                aria-label="Increase quantity"
                disabled={running}
                onClick={() => updateQty(count + QTY_STEP)}
              >
                +
              </button>
            </div>
            <div className="pill-row">
              {QUICK_QTY.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`pill${qty === value ? ' active' : ''}`}
                  disabled={running}
                  onClick={() => setQty(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <p className="text-small">Type any amount, or pick a shortcut.</p>
        </div>

        {/* Last block before the divider — its margin would double up. */}
        <div className="field-group" style={{ marginBottom: 0 }}>
          <p className="label-sm">Filters</p>
          <div className="pill-row">
            <Checkbox label="Solar only" checked={solarOnly} onChange={setSolarOnly} />
            <Checkbox label="Two-story only" checked={twoStoryOnly} onChange={setTwoStoryOnly} />
          </div>
          <p className="text-small">Leave both off to pull from every home in the territory.</p>
          {bothFilters && (
            <p className="note-amber">Fewer homes match both filters — a large pull may come back short.</p>
          )}
        </div>

        <div className="divider" />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <p className="label-sm" style={{ marginBottom: 8 }}>
              Cost of this pull
            </p>
            <div className="text-mono" style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em' }}>
              {money(cost)}
            </div>
            <p className="text-small" style={{ marginTop: 6 }}>
              {count} leads × {money(PRICE_PER_LEAD)}
            </p>
          </div>

          <button type="button" className="btn-primary" disabled={!count || running} onClick={handlePull}>
            {running && <Loader2 size={15} className="spin" aria-hidden="true" />}
            {running ? 'Pulling…' : 'Pull Leads'}
          </button>

          <p className="text-small" style={{ textAlign: 'center' }}>
            Single-family, owner-occupied homes only. Numbers scrubbed against the federal Do Not Call list.
          </p>
        </div>

        {running && live && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
            <p className="text-small">{PHASES[phaseFor(live.pct)]}</p>
            <div className="progress-row">
              <div
                className="progress-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={live.pct}
              >
                <div className={`progress-fill${live.working ? ' working' : ''}`} style={{ width: `${live.pct}%` }} />
              </div>
              <span className="progress-pct">{live.pct}%</span>
            </div>
            <p className="text-small">
              {live.delivered} of {live.target} leads
              {live.remaining ? ` · ${live.remaining}` : ''}
            </p>
          </div>
        )}

        {status === 'failed' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
            <div className="login-error">{failure}</div>
            <button type="button" className="btn-secondary" onClick={handlePull}>
              Try again
            </button>
          </div>
        )}
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720, marginInline: 'auto', width: '100%' }}>
        <h3 className="section-title">Recent pulls</h3>
        <div className="pull-list">
          {loadingPulls ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div className="pull-row" key={index}>
                <Skeleton width="180px" height="12px" />
                <Skeleton width="120px" height="12px" />
              </div>
            ))
          ) : pulls.length ? (
            pulls.map((pull) => (
              <div className="pull-row" key={pull.pull_id}>
                <span>
                  {longDate(pull.pulled_at)} · {timeOfDay(pull.pulled_at)}
                </span>
                <span className="text-mono">
                  {pull.leads} leads · {money(pull.leads * PRICE_PER_LEAD)}
                </span>
              </div>
            ))
          ) : (
            <div className="empty-state">No leads yet — pull your first batch.</div>
          )}
        </div>
      </section>
    </>
  );
}
