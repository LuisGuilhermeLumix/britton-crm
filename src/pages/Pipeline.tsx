import { useMemo, useState, type DragEvent } from 'react';
import { LeadCard } from '../components/LeadCard';
import { LeadDrawer } from '../components/LeadDrawer';
import { Checkbox } from '../components/Checkbox';
import { CardSkeleton } from '../components/Skeleton';
import { BOARD_STAGES } from '../lib/constants';
import { matchesTags, type TagFilter } from '../lib/filters';
import type { LeadRow, Stage } from '../lib/types';
import { useData } from '../providers/DataProvider';
import { useToast } from '../providers/ToastProvider';

export function Pipeline() {
  const { leads, loadingLeads, leadsLoaded, setStage } = useData();
  const toast = useToast();

  const [tags, setTags] = useState<TagFilter>({ solar: false, twoStory: false });
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<Stage | null>(null);
  const [savingIds, setSavingIds] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  /** do_not_call never appears on the board. */
  const boardLeads = useMemo(
    () => leads.filter((lead) => lead.stage !== 'do_not_call' && matchesTags(lead, tags)),
    [leads, tags],
  );

  const columns = useMemo(
    () =>
      BOARD_STAGES.map((stage) => ({
        ...stage,
        leads: boardLeads.filter((lead) => lead.stage === stage.key),
      })),
    [boardLeads],
  );

  const total = boardLeads.length;
  const onBoard = leads.filter((lead) => lead.stage !== 'do_not_call').length;
  const tagsActive = tags.solar || tags.twoStory;
  const showSkeletons = loadingLeads && !leadsLoaded;
  const openLead = openId ? leads.find((lead) => lead.id === openId) ?? null : null;

  function handleDragStart(event: DragEvent<HTMLDivElement>, lead: LeadRow) {
    setDraggingId(lead.id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', lead.id);
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>, stage: Stage) {
    event.preventDefault();
    setDropTarget(null);
    const id = draggingId || event.dataTransfer.getData('text/plain');
    setDraggingId(null);
    if (!id) return;

    const lead = leads.find((item) => item.id === id);
    if (!lead || lead.stage === stage) return;

    // The card moves immediately; DataProvider reverts it if the write fails.
    setSavingIds((current) => [...current, id]);
    const ok = await setStage(id, stage);
    setSavingIds((current) => current.filter((item) => item !== id));
    if (ok) toast.success(`Moved to ${BOARD_STAGES.find((s) => s.key === stage)?.label ?? stage}`);
  }

  return (
    <>
      <section className="page-header">
        <h2>Pipeline</h2>
        <p>Drag a card to change status.</p>
      </section>

      <section className="pipeline-top">
        <div className="pipeline-filters">
          <div className="filter-group">
            <span className="group-label">Type</span>
            <div className="pill-row">
              <Checkbox
                label="Solar"
                checked={tags.solar}
                onChange={(next) => setTags((current) => ({ ...current, solar: next }))}
              />
              <Checkbox
                label="Two-story"
                checked={tags.twoStory}
                onChange={(next) => setTags((current) => ({ ...current, twoStory: next }))}
              />
            </div>
          </div>
        </div>

        <div className="distribution-bar">
          {total > 0 &&
            columns.map((column) => (
              <div
                key={column.key}
                className="distribution-segment"
                style={{ flex: column.leads.length, background: column.color }}
              />
            ))}
        </div>
        <div className="distribution-legend">
          {columns.map((column) => (
            <div className="legend-item" key={column.key}>
              <span className="status-dot" style={{ background: column.color }} />
              <span>{column.label}</span>
              <span className="mono">{column.leads.length}</span>
            </div>
          ))}
        </div>
        {tagsActive && !showSkeletons && (
          <p className="text-small">
            Showing {total} of {onBoard} leads.
          </p>
        )}
      </section>

      <section className="kanban-wrap">
        <div className="kanban-columns">
          {columns.map((column) => (
            <div
              key={column.key}
              className={`kanban-column${dropTarget === column.key ? ' drop-target' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDropTarget(column.key);
              }}
              onDragLeave={() => setDropTarget((current) => (current === column.key ? null : current))}
              onDrop={(event) => void handleDrop(event, column.key)}
            >
              <div className="column-header">
                <div className="column-title">
                  <span className="status-dot" style={{ background: column.color }} />
                  {column.label}
                </div>
                <div className="column-count">{column.leads.length}</div>
              </div>
              <div className="column-body">
                {showSkeletons ? (
                  Array.from({ length: 3 }).map((_, index) => <CardSkeleton key={index} />)
                ) : column.leads.length ? (
                  column.leads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      dragging={draggingId === lead.id}
                      saving={savingIds.includes(lead.id)}
                      onOpen={(item) => setOpenId(item.id)}
                      onDragStart={handleDragStart}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDropTarget(null);
                      }}
                    />
                  ))
                ) : (
                  <div className="empty-state">
                    {leads.length === 0
                      ? 'No leads yet — pull your first batch.'
                      : tagsActive
                        ? 'No leads match these filters.'
                        : 'No leads here.'}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {openLead && <LeadDrawer lead={openLead} onClose={() => setOpenId(null)} />}
    </>
  );
}
