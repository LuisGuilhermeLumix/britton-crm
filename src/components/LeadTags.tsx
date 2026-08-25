import type { LeadRow } from '../lib/types';
import { hasSolar, isDeceased, isDnc, isLitigator, isTwoStory } from '../lib/filters';

interface TagSpec {
  key: string;
  label: string;
  className: string;
  title: string;
}

/**
 * Compliance first, on purpose: LITIGATOR is the most consequential thing on
 * the card, so it always leads. Order is LITIGATOR → DNC → Deceased →
 * Solar → 2-story.
 */
export function leadTags(lead: LeadRow): TagSpec[] {
  const tags: TagSpec[] = [];
  if (isLitigator(lead)) {
    tags.push({
      key: 'litigator',
      label: 'LITIGATOR',
      className: 'tag-litigator',
      title: 'Known TCPA litigator — do not call',
    });
  }
  if (isDnc(lead)) {
    tags.push({
      key: 'dnc',
      label: 'DNC',
      className: 'tag-dnc',
      title: 'This number is on the federal Do Not Call list',
    });
  }
  if (isDeceased(lead)) {
    tags.push({
      key: 'deceased',
      label: 'Deceased',
      className: 'tag-deceased',
      title: 'Owner listed as deceased',
    });
  }
  if (hasSolar(lead)) {
    tags.push({ key: 'solar', label: 'Solar', className: 'tag-solar', title: 'Home has solar panels' });
  }
  if (isTwoStory(lead)) {
    tags.push({ key: 'story', label: '2-story', className: 'tag-story', title: 'Two-story home' });
  }
  return tags;
}

export function LeadTags({ lead }: { lead: LeadRow }) {
  const tags = leadTags(lead);
  if (!tags.length) return null;
  return (
    <div className="tag-row">
      {tags.map((tag) => (
        <span key={tag.key} className={`tag ${tag.className}`} title={tag.title}>
          {tag.label}
        </span>
      ))}
    </div>
  );
}
