// Supabase Edge Function: pull-leads
//
// The browser must never hold the n8n webhook URL or its secret — anyone could
// read them out of the bundle and burn real credit. This function sits in the
// middle: it authenticates the caller, validates the input, and only then
// forwards the request to n8n using secrets that exist solely on the server.
//
// Deploy:  supabase functions deploy pull-leads
// Secrets: supabase secrets set N8N_WEBHOOK_URL=... N8N_SECRET=... ALLOWED_ORIGIN=...

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const N8N_WEBHOOK_URL = Deno.env.get('N8N_WEBHOOK_URL') ?? '';
const N8N_SECRET = Deno.env.get('N8N_SECRET') ?? '';
/** Comma-separated list of origins allowed to call this function. */
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? '';

const MAX_COUNT = 2000;

function allowedOrigins(): string[] {
  return ALLOWED_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/** Echo the origin back only when it is on the allow-list. */
function corsHeaders(origin: string | null): Record<string, string> {
  const list = allowedOrigins();
  const allow = origin && list.includes(origin) ? origin : list[0] ?? '';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

interface PullBody {
  count?: unknown;
  solar?: unknown;
  stories?: unknown;
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('Origin');

  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(origin) });
  }
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405, origin);
  }
  if (!N8N_WEBHOOK_URL || !N8N_SECRET) {
    console.error('N8N_WEBHOOK_URL or N8N_SECRET is not configured.');
    return json({ error: 'The pull service is not configured. Contact your administrator.' }, 500, origin);
  }

  // --- authentication: a valid user session is required -------------------
  const authHeader = request.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'Not signed in.' }, 401, origin);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return json({ error: 'Your session has expired. Sign in again.' }, 401, origin);
  }

  // --- validation ----------------------------------------------------------
  let body: PullBody;
  try {
    body = (await request.json()) as PullBody;
  } catch {
    return json({ error: 'Invalid request body.' }, 400, origin);
  }

  const count = Number(body.count);
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    return json({ error: `Quantity must be a whole number between 1 and ${MAX_COUNT}.` }, 400, origin);
  }

  const solar = body.solar ?? null;
  if (solar !== null && solar !== 'solar') {
    return json({ error: "Invalid value for 'solar'." }, 400, origin);
  }

  const stories = body.stories ?? null;
  if (stories !== null && stories !== 'two-story') {
    return json({ error: "Invalid value for 'stories'." }, 400, origin);
  }

  // --- forward to n8n ------------------------------------------------------
  let response: Response;
  try {
    response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-crm-key': N8N_SECRET,
      },
      body: JSON.stringify({ count, solar, stories }),
    });
  } catch (error) {
    console.error('n8n request failed:', error);
    return json({ error: 'Could not reach the pull service. Try again in a moment.' }, 502, origin);
  }

  const text = await response.text();

  if (!response.ok) {
    console.error(`n8n responded ${response.status}: ${text}`);
    return json(
      { error: `The pull service returned an error (${response.status}). Try again in a moment.` },
      502,
      origin,
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    console.error('n8n returned non-JSON:', text);
    return json({ error: 'The pull service returned an unexpected response.' }, 502, origin);
  }

  const result = payload as { ok?: boolean; pull_id?: string; requested?: number };
  if (!result?.pull_id) {
    console.error('n8n response missing pull_id:', text);
    return json({ error: 'The pull service did not return a pull id.' }, 502, origin);
  }

  return json(
    { ok: result.ok ?? true, pull_id: result.pull_id, requested: result.requested ?? count },
    200,
    origin,
  );
});
