import type { DateFilterKey } from './constants';
import type { LeadRow } from './types';
import { addDays, endOfDay, parseYMD, startOfDay } from './format';

export interface TagFilter {
  solar: boolean;
  twoStory: boolean;
  dnc: boolean;
  litigator: boolean;
}

export const NO_TAGS: TagFilter = { solar: false, twoStory: false, dnc: false, litigator: false };

export function anyTagActive(tags: TagFilter): boolean {
  return tags.solar || tags.twoStory || tags.dnc || tags.litigator;
}

export interface CustomRange {
  start: string;
  end: string;
}

/** Inclusive [start, end] for a date-filter pill, in local time. */
export function dateRange(key: DateFilterKey, custom?: CustomRange): [Date, Date] {
  const now = new Date();
  switch (key) {
    case 'today':
      return [startOfDay(now), endOfDay(now)];
    case 'yesterday':
      return [startOfDay(addDays(now, -1)), endOfDay(addDays(now, -1))];
    case '7':
      return [startOfDay(addDays(now, -6)), endOfDay(now)];
    case '30':
      return [startOfDay(addDays(now, -29)), endOfDay(now)];
    case 'month':
      return [startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)), endOfDay(now)];
    case 'custom': {
      const start = (custom && parseYMD(custom.start)) || addDays(now, -14);
      const end = (custom && parseYMD(custom.end)) || now;
      return [startOfDay(start), endOfDay(end)];
    }
    default:
      return [startOfDay(addDays(now, -29)), endOfDay(now)];
  }
}

export function hasSolar(lead: LeadRow): boolean {
  return lead.solar === 'solar';
}

export function isTwoStory(lead: LeadRow): boolean {
  return lead.stories === 'two-story';
}

export function isDnc(lead: LeadRow): boolean {
  return lead.phone_dnc === true;
}

export function isLitigator(lead: LeadRow): boolean {
  return lead.is_litigator === true;
}

export function isDeceased(lead: LeadRow): boolean {
  return lead.is_deceased === true;
}

/**
 * No box = everything. One box = that tag. Several boxes = AND, not OR.
 */
export function matchesTags(lead: LeadRow, tags: TagFilter): boolean {
  if (tags.solar && !hasSolar(lead)) return false;
  if (tags.twoStory && !isTwoStory(lead)) return false;
  if (tags.dnc && !isDnc(lead)) return false;
  if (tags.litigator && !isLitigator(lead)) return false;
  return true;
}

export function inRange(iso: string, start: Date, end: Date): boolean {
  const date = new Date(iso);
  return date >= start && date <= end;
}

/** Date filter AND tag filter — the intersection of both groups. */
export function applyFilters(
  leads: LeadRow[],
  dateKey: DateFilterKey,
  custom: CustomRange,
  tags: TagFilter,
): LeadRow[] {
  const [start, end] = dateRange(dateKey, custom);
  return leads.filter((lead) => inRange(lead.pulled_at, start, end) && matchesTags(lead, tags));
}
