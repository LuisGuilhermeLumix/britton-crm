import type { DragEvent } from 'react';
import type { LeadRow } from '../lib/types';
import { hasSolar, isTwoStory } from '../lib/filters';
import { phoneDisplay, shortDate, shortValue } from '../lib/format';

interface Props {
  lead: LeadRow;
  dragging: boolean;
  saving: boolean;
  onOpen: (lead: LeadRow) => void;
  onDragStart: (event: DragEvent<HTMLDivElement>, lead: LeadRow) => void;
  onDragEnd: () => void;
}

export function LeadCard({ lead, dragging, saving, onOpen, onDragStart, onDragEnd }: Props) {
  const solar = hasSolar(lead);
  const twoStory = isTwoStory(lead);
  const fullAddress = [lead.address, lead.city].filter(Boolean).join(', ');

  return (
    <div
      className={`kanban-card${dragging ? ' dragging' : ''}${saving ? ' saving' : ''}`}
      draggable={!saving}
      onDragStart={(event) => onDragStart(event, lead)}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(lead)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(lead);
        }
      }}
    >
      <div className="card-head">
        <p className="card-title">{lead.owner_name || 'Unknown owner'}</p>
        <span className="card-date">{shortDate(lead.pulled_at)}</span>
      </div>
      <p className="card-mono">{phoneDisplay(lead.phone)}</p>
      <p className="card-detail" title={fullAddress}>
        {lead.address}
        {lead.city ? ` · ${lead.city}` : ''}
      </p>
      <p className="detail-row">
        {lead.year_built && <span>{lead.year_built}</span>}
        <span>{twoStory ? '2 stories' : '1 story'}</span>
        {lead.market_value !== null && <span>{shortValue(lead.market_value)}</span>}
      </p>
      {(solar || twoStory) && (
        <div className="tag-row">
          {solar && <span className="tag tag-solar">Solar</span>}
          {twoStory && <span className="tag tag-story">2-story</span>}
        </div>
      )}
    </div>
  );
}
