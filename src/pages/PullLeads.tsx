import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Skeleton } from '../components/Skeleton';
import { PRICE_PER_LEAD, QTY_STEP, QUICK_QTY } from '../lib/constants';
import { longDate, money, timeOfDay } from '../lib/format';
import { getInFlightPull, setInFlightPull, startPull, waitForPull } from '../lib/pull';
import { errorMessage } from '../lib/supabase';
import { useData } from '../providers/DataProvider';
import { useToast } from '../providers/ToastProvider';

const PHASES = [
  'Searching homes in Salt Lake City…',
  'Finding owner name and phone…',
  'Scrubbing against the Do Not Call list…',
  'Saving to your pipeline…',
];

type Status = 'idle' | 'running' | 'failed';

export function PullLeads() {
  const { pulls, loadingPulls, refreshAll, refreshPulls } = useData();
  const toast = useToast();

  const [qty, setQty] = useState<number | null>(50);
  const [status, setStatus] = useState<Status>('idle');
  const [phase, setPhase] = useState(0);
  const [progress, setProgress] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);

  const resumed = useRef(false);

  const count = qty ?? 0;
  const cost = count * PRICE_PER_LEAD;

  /** Walks the phase captions while we wait on n8n. */
  useEffect(() => {
    if (status !== 'running') return;
    const timer = window.setInterval(() => {
      setPhase((current) => Math.min(PHASES.length - 1, current + 1));
      // Creeps toward 90% — the last jump happens when the pull actually lands.
      setProgress((current) => Math.min(90, current + 22));
    }, 2200);
    return () => window.clearInterval(timer);
  }, [status]);

  /** Waits for a pull that has already been handed to n8n. */
  const awaitPull = useCallback(
    async (pullId: string, requested: number) => {
      setInFlightPull({ pullId, count: requested });
      try {
        const row = await waitForPull(pullId);
        setProgress(100);
        // Price the client sees is always leads × PRICE_PER_LEAD, never the
        // view's cost_usd.
        toast.success(`${row.leads} leads pulled · ${money(row.leads * PRICE_PER_LEAD)}`);

        // Refresh Recent pulls and invalidate the leads cache the other pages read.
        await refreshAll();
        setStatus('idle');
        setProgress(0);
      } catch (error) {
        const message = errorMessage(error, 'The pull could not be completed.');
        setFailure(message);
        setStatus('failed');
        toast.error(message);
        // The pull may have partially landed; make sure history is current.
        void refreshPulls();
      } finally {
        setInFlightPull(null);
      }
    },
    [refreshAll, refreshPulls, toast],
  );

  /** Reattach to a pull that was still running when we navigated away. */
  useEffect(() => {
    if (resumed.current) return;
    resumed.current = true;
    const active = getInFlightPull();
    if (!active) return;
    setQty(active.count);
    setStatus('running');
    setProgress(40);
    void awaitPull(active.pullId, active.count);
  }, [awaitPull]);

  async function handlePull() {
    if (!count || status === 'running' || getInFlightPull()) return;

    setStatus('running');
    setFailure(null);
    setPhase(0);
    setProgress(8);

    let response;
    try {
      // Pulls are always random now. The fields stay in the payload so the
      // n8n side keeps working unchanged if filters ever come back.
      response = await startPull({ count, solar: null, stories: null });
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

  return (
    <>
      <section className="page-header">
        <h2>Pull Leads</h2>
        <p>Homeowners in Salt Lake City, with name and phone number already verified.</p>
      </section>

      <section className="card" style={{ maxWidth: 720, marginInline: 'auto', width: '100%' }}>
        {/* Last block before the divider — its margin would double up. */}
        <div className="field-group" style={{ marginBottom: 0 }}>
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

        {running && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
            <p className="text-small">{PHASES[phase]}</p>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-small" style={{ textAlign: 'right' }}>
              {count} leads requested
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
