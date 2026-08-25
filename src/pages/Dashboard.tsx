import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TagFilters } from '../components/TagFilters';
import { DateFilter, defaultDateFilter, type DateFilterValue } from '../components/DateFilter';
import { StatCard } from '../components/StatCard';
import { StatCardSkeleton, Skeleton, TableSkeleton } from '../components/Skeleton';
import { PRICE_PER_LEAD, stageMeta } from '../lib/constants';
import { anyTagActive, applyFilters, dateRange, hasSolar, isDnc, NO_TAGS, type TagFilter } from '../lib/filters';
import { dateTime, money, phoneDisplay, shortDate, ymd } from '../lib/format';
import type { LeadRow } from '../lib/types';
import { useData } from '../providers/DataProvider';

interface TrendPoint {
  key: string;
  label: string;
  count: number;
}

/** One bucket per day across the selected range. */
function buildTrend(leads: LeadRow[], start: Date, end: Date): TrendPoint[] {
  const days: TrendPoint[] = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const limit = new Date(end);
  limit.setHours(0, 0, 0, 0);

  let guard = 0;
  while (cursor <= limit && guard < 400) {
    const key = ymd(cursor);
    days.push({ key, label: shortDate(cursor), count: 0 });
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }

  const index = new Map(days.map((day) => [day.key, day]));
  for (const lead of leads) {
    const day = index.get(ymd(new Date(lead.pulled_at)));
    if (day) day.count += 1;
  }
  return days;
}

interface TooltipShape {
  active?: boolean;
  payload?: { payload: TrendPoint }[];
}

function ChartTooltip({ active, payload }: TooltipShape) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <div className="tip-date">{point.label}</div>
      <div className="tip-value">
        {point.count} {point.count === 1 ? 'lead' : 'leads'}
      </div>
      <div className="tip-cost">{money(point.count * PRICE_PER_LEAD)}</div>
    </div>
  );
}

export function Dashboard() {
  const { leads, loadingLeads, leadsLoaded } = useData();

  const [date, setDate] = useState<DateFilterValue>(() => defaultDateFilter('30'));
  const [tags, setTags] = useState<TagFilter>(NO_TAGS);

  const filtered = useMemo(
    () => applyFilters(leads, date.key, date.custom, tags),
    [leads, date, tags],
  );

  const trend = useMemo(() => {
    const [start, end] = dateRange(date.key, date.custom);
    return buildTrend(filtered, start, end);
  }, [filtered, date]);

  const total = filtered.length;
  const toCall = filtered.filter((lead) => lead.stage === 'new' || lead.stage === 'calling').length;
  const appointments = filtered.filter((lead) => lead.stage === 'appointment' || lead.stage === 'won').length;
  const bookingRate = total ? Math.round((appointments / total) * 100) : 0;
  const solarCount = filtered.filter(hasSolar).length;
  const solarPct = total ? Math.round((solarCount / total) * 100) : 0;
  const dncCount = filtered.filter(isDnc).length;
  const dncPct = total ? Math.round((dncCount / total) * 100) : 0;
  const recent = filtered.slice(0, 8);

  const tagsActive = anyTagActive(tags);
  const showSkeletons = loadingLeads && !leadsLoaded;
  // Max 7 readable ticks, as in the demo.
  const tickInterval = Math.max(0, Math.ceil(trend.length / 7) - 1);

  return (
    <>
      <section className="page-header">
        <h2>Dashboard</h2>
        <p>How the lead operation is doing.</p>
      </section>

      <section className="filter-bar">
        <DateFilter value={date} onChange={setDate} />

        <div className="filter-sep" />

        <TagFilters
          value={tags}
          onChange={setTags}
          hint={tagsActive && !showSkeletons ? `${total} of ${leads.length} leads match` : undefined}
        />
      </section>

      <section className="stats-grid">
        {showSkeletons ? (
          Array.from({ length: 4 }).map((_, index) => <StatCardSkeleton key={index} />)
        ) : (
          <>
            <StatCard title="Leads pulled" value={total} help="in the selected period" />
            <StatCard title="To call" value={toCall} help="not contacted and calling" />
            <StatCard title="Appointments booked" value={appointments} help="booked and done" />
            <StatCard title="Booking rate" value={`${bookingRate}%`} help="appointments out of leads pulled" />
          </>
        )}
      </section>

      <section className="info-strip">
        <div className="info-item">
          <span className="label">Cost per lead</span>
          <span className="value">$0.40</span>
        </div>
        <div className="info-item">
          <span className="label">Spend in period</span>
          <span className="value">{showSkeletons ? '—' : money(total * PRICE_PER_LEAD)}</span>
        </div>
        <div className="info-item">
          <span className="label">Homes with solar</span>
          <span className="value">
            {showSkeletons ? '—' : `${solarCount} (${solarPct}%)`}
          </span>
        </div>
        <div className="info-item">
          <span className="label">On Do Not Call</span>
          <span className="value">{showSkeletons ? '—' : `${dncCount} (${dncPct}%)`}</span>
        </div>
      </section>

      <section className="chart-card">
        <div className="section-title">Leads pulled per day</div>
        <div className="chart-holder">
          {showSkeletons ? (
            <Skeleton height="280px" />
          ) : total === 0 ? (
            <div className="empty-state">Nothing to chart for this selection.</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trend} margin={{ top: 12, right: 16, bottom: 8, left: 16 }}>
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" vertical={false} />
                <XAxis
                  dataKey="label"
                  interval={tickInterval}
                  tick={{ fill: 'var(--text-3)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={8}
                />
                <YAxis hide domain={[0, 'dataMax']} />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ stroke: 'var(--border-hi)', strokeWidth: 1 }}
                />
                <Area
                  type="linear"
                  dataKey="count"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  fill="url(#chartGradient)"
                  dot={trend.length <= 31 ? { r: 3, fill: 'var(--accent)', strokeWidth: 0 } : false}
                  activeDot={{ r: 5, fill: 'var(--accent)', stroke: 'var(--bg)', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="card">
        <div className="section-title" style={{ marginBottom: 16 }}>
          Recent leads
        </div>
        {showSkeletons ? (
          <TableSkeleton />
        ) : recent.length ? (
          <div className="table-scroll">
            <table className="table-full">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Address</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((lead) => {
                  const meta = stageMeta(lead.stage);
                  const address = [lead.address, lead.city].filter(Boolean).join(', ');
                  return (
                    <tr key={lead.id}>
                      <td className="text-mono" style={{ color: 'var(--text-2)' }}>
                        {dateTime(lead.pulled_at)}
                      </td>
                      <td>{lead.owner_name || 'Unknown owner'}</td>
                      <td className="text-mono">{phoneDisplay(lead.phone)}</td>
                      <td>
                        <span className="truncate-cell" title={address}>
                          {address}
                        </span>
                      </td>
                      <td>
                        <span className="status-row">
                          <span className="status-dot" style={{ background: meta.color }} />
                          {meta.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            {leads.length === 0 ? 'No leads yet — pull your first batch.' : 'No leads match these filters.'}
          </div>
        )}
      </section>
    </>
  );
}
