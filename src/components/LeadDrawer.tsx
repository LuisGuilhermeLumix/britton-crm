import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Phone, PhoneOff } from 'lucide-react';
import type { LeadRow, Stage } from '../lib/types';
import { BOARD_STAGES, DO_NOT_CALL, stageMeta } from '../lib/constants';
import { hasSolar, isDeceased, isDnc, isLitigator, isTwoStory } from '../lib/filters';
import { longDate, phoneDisplay, phoneHref, shortValue } from '../lib/format';
import { useData } from '../providers/DataProvider';
import { useToast } from '../providers/ToastProvider';
import { OtherNumbers } from './OtherNumbers';
import { ContactEmails } from './ContactEmails';

interface Props {
  lead: LeadRow;
  onClose: () => void;
}

export function LeadDrawer({ lead, onClose }: Props) {
  const { setStage, addNote, logCall } = useData();
  const toast = useToast();
  const [noteText, setNoteText] = useState('');
  const [busy, setBusy] = useState<'stage' | 'note' | 'call' | null>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const notes = Array.isArray(lead.notes) ? lead.notes : [];
  const meta = stageMeta(lead.stage);

  // Litigator outranks DNC — if both are set, only the graver one is shown.
  const warning = isLitigator(lead)
    ? 'Known TCPA litigator. Calling this number carries legal risk.'
    : isDnc(lead)
      ? 'This number is on the federal Do Not Call list.'
      : null;

  async function handleStage(stage: Stage) {
    if (busy || stage === lead.stage) return;
    setBusy('stage');
    const ok = await setStage(lead.id, stage);
    setBusy(null);
    if (ok) {
      toast.success(`Moved to ${stageMeta(stage).label}`);
      // do_not_call leaves the board entirely, so close the drawer with it.
      onClose();
    }
  }

  async function handleNote() {
    const body = noteText.trim();
    if (!body || busy) return;
    setBusy('note');
    const ok = await addNote(lead.id, body);
    setBusy(null);
    if (ok) {
      setNoteText('');
      toast.success('Note saved');
    }
  }

  async function handleLogCall() {
    if (busy) return;
    setBusy('call');
    const ok = await logCall(lead.id);
    setBusy(null);
    if (ok) toast.success('Call logged');
  }

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer" role="dialog" aria-label="Lead details">
        <div className="drawer-header">
          <h3 className="drawer-title">{lead.owner_name || 'Unknown owner'}</h3>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="drawer-contact">
          {warning && (
            <div className="lead-warning" role="alert">
              <AlertTriangle size={15} aria-hidden="true" />
              <span>{warning}</span>
            </div>
          )}

          {lead.phone ? (
            <a className="drawer-phone" href={phoneHref(lead.phone)}>
              <Phone size={14} aria-hidden="true" />
              {phoneDisplay(lead.phone)}
            </a>
          ) : (
            <p className="drawer-phone">No phone on file</p>
          )}

          <p className="drawer-status">
            <span className="status-dot" style={{ background: meta.color }} />
            {meta.label}
            {isDeceased(lead) && <span className="tag tag-deceased">Deceased</span>}
          </p>

          <OtherNumbers phones={lead.extra_phones} />
          <ContactEmails email={lead.email} extras={lead.extra_emails} />
        </div>

        <div className="action-grid">
          {BOARD_STAGES.map((stage) => (
            <button
              key={stage.key}
              type="button"
              className={`action-btn${lead.stage === stage.key ? ' current' : ''}`}
              disabled={busy !== null}
              onClick={() => handleStage(stage.key)}
            >
              {stage.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button type="button" className="btn-secondary" disabled={busy !== null} onClick={handleLogCall}>
            {busy === 'call' ? <Loader2 size={14} className="spin" aria-hidden="true" /> : <Phone size={14} aria-hidden="true" />}
            Log call
          </button>
          <button
            type="button"
            className="btn-secondary action-btn danger"
            style={{ height: 40, fontSize: 13 }}
            disabled={busy !== null}
            onClick={() => handleStage(DO_NOT_CALL.key)}
          >
            <PhoneOff size={14} aria-hidden="true" />
            Do not call
          </button>
        </div>

        <div className="drawer-block">
          <h4 className="section-title">The home</h4>
          <div className="drawer-field">
            <strong>Address</strong>
            <span>{lead.address || '—'}</span>
          </div>
          <div className="drawer-field">
            <strong>City</strong>
            <span>
              {[lead.city, lead.state, lead.zip].filter(Boolean).join(', ') || '—'}
            </span>
          </div>
          <div className="drawer-field">
            <strong>Year built</strong>
            <span>{lead.year_built ?? '—'}</span>
          </div>
          <div className="drawer-field">
            <strong>Size</strong>
            <span>{lead.sqft ? `${lead.sqft.toLocaleString('en-US')} sqft` : '—'}</span>
          </div>
          <div className="drawer-field">
            <strong>Stories</strong>
            <span>{isTwoStory(lead) ? 2 : 1}</span>
          </div>
          <div className="drawer-field">
            <strong>Market value</strong>
            <span>{shortValue(lead.market_value)}</span>
          </div>
          <div className="drawer-field">
            <strong>Solar panels</strong>
            <span>{hasSolar(lead) ? 'Yes' : 'No'}</span>
          </div>
          <div className="drawer-field">
            <strong>Pulled</strong>
            <span>{longDate(lead.pulled_at)}</span>
          </div>
          <div className="drawer-field">
            <strong>Call attempts</strong>
            <span>{lead.call_attempts ?? 0}</span>
          </div>
          <div className="drawer-field">
            <strong>Last contacted</strong>
            <span>{lead.last_contacted_at ? longDate(lead.last_contacted_at) : 'Never'}</span>
          </div>
        </div>

        <div className="drawer-block">
          <h4 className="section-title">Notes</h4>
          <textarea
            value={noteText}
            placeholder="Add a note about this lead…"
            onChange={(event) => setNoteText(event.target.value)}
          />
          <button type="button" className="btn-primary" disabled={!noteText.trim() || busy !== null} onClick={handleNote}>
            {busy === 'note' && <Loader2 size={14} className="spin" aria-hidden="true" />}
            Save note
          </button>
          <div className="drawer-notes">
            {notes.length ? (
              notes.map((note) => (
                <div className="note-item" key={note.id}>
                  <div className="note-date">{longDate(note.created_at)}</div>
                  <div>{note.body}</div>
                </div>
              ))
            ) : (
              <div className="empty-state">No notes yet.</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
