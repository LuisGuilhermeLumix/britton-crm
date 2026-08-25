/** Stage values exactly as stored in the ut_leads enum. */
export type Stage =
  | 'new'
  | 'calling'
  | 'talked'
  | 'appointment'
  | 'won'
  | 'lost'
  | 'do_not_call';

export type StoriesValue = 'two-story' | 'one-story' | null;
export type SolarValue = 'solar' | 'no-solar' | null;

/** One entry in the ut_leads.notes jsonb array. */
export interface LeadNote {
  id: string;
  body: string;
  created_at: string;
}

/** One entry in the ut_v_leads.extra_phones jsonb array. */
export interface ExtraPhone {
  phone: string;
  type?: string | null;
  dnc?: boolean | null;
  last_seen?: string | null;
  score?: number | null;
}

/** A row of the ut_v_leads view. */
export interface LeadRow {
  id: string;
  parcel_id: string | null;
  owner_name: string | null;
  phone: string | null;
  phone_type: string | null;
  phone_last_seen: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  sqft: number | null;
  market_value: number | null;
  year_built: number | null;
  stories: StoriesValue;
  solar: SolarValue;
  solar_permit_date: string | null;
  /* Compliance flags. DNC leads are delivered now, not discarded — the
     caller decides, so these have to be visible. */
  phone_dnc: boolean | null;
  is_litigator: boolean | null;
  is_deceased: boolean | null;
  extra_phones: ExtraPhone[] | null;
  extra_emails: string[] | null;
  stage: Stage;
  call_attempts: number | null;
  last_contacted_at: string | null;
  notes: LeadNote[] | null;
  pull_id: string | null;
  pulled_at: string;
}

/** A row of the ut_v_pulls view. `cost_usd` is the internal cost — never shown. */
export interface PullRow {
  pull_id: string;
  pulled_at: string;
  leads: number;
  cost_usd: number | null;
}

/** Response returned by the pull-leads Edge Function (proxied from n8n). */
export interface PullResponse {
  ok: boolean;
  pull_id: string;
  requested: number;
}

/** Only the columns the app is allowed to write back to ut_leads. */
export interface LeadUpdate {
  stage?: Stage;
  notes?: LeadNote[];
  call_attempts?: number;
  last_contacted_at?: string;
}
