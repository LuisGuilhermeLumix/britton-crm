import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { errorMessage, supabase } from '../lib/supabase';
import type { LeadNote, LeadRow, LeadUpdate, PullRow, Stage } from '../lib/types';
import { useToast } from './ToastProvider';

/** Generous ceiling; the dataset is small enough to filter on the client. */
const LEADS_LIMIT = 5000;

/** crypto.randomUUID only exists in secure contexts, so keep a fallback. */
function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

interface DataApi {
  leads: LeadRow[];
  pulls: PullRow[];
  loadingLeads: boolean;
  loadingPulls: boolean;
  leadsError: string | null;
  /** True once leads have been fetched at least once. */
  leadsLoaded: boolean;
  refreshLeads: () => Promise<void>;
  refreshPulls: () => Promise<void>;
  refreshAll: () => Promise<void>;
  setStage: (id: string, stage: Stage) => Promise<boolean>;
  addNote: (id: string, body: string) => Promise<boolean>;
  logCall: (id: string) => Promise<boolean>;
}

const DataContext = createContext<DataApi | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [pulls, setPulls] = useState<PullRow[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [loadingPulls, setLoadingPulls] = useState(true);
  const [leadsLoaded, setLeadsLoaded] = useState(false);
  const [leadsError, setLeadsError] = useState<string | null>(null);

  // Mirrors `leads` so mutations can read the current row without re-creating
  // their callbacks on every fetch.
  const leadsRef = useRef<LeadRow[]>([]);
  useEffect(() => {
    leadsRef.current = leads;
  }, [leads]);

  const refreshLeads = useCallback(async () => {
    setLoadingLeads(true);
    try {
      const { data, error } = await supabase
        .from('ut_v_leads')
        .select('*')
        .order('pulled_at', { ascending: false })
        .limit(LEADS_LIMIT);
      if (error) throw error;
      setLeads((data ?? []) as LeadRow[]);
      setLeadsError(null);
    } catch (error) {
      const message = errorMessage(error, 'Could not load leads.');
      setLeadsError(message);
      toast.error(`Could not load leads — ${message}`);
    } finally {
      setLoadingLeads(false);
      setLeadsLoaded(true);
    }
  }, [toast]);

  const refreshPulls = useCallback(async () => {
    setLoadingPulls(true);
    try {
      const { data, error } = await supabase
        .from('ut_v_pulls')
        .select('*')
        .order('pulled_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      setPulls((data ?? []) as PullRow[]);
    } catch (error) {
      toast.error(`Could not load recent pulls — ${errorMessage(error)}`);
    } finally {
      setLoadingPulls(false);
    }
  }, [toast]);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshLeads(), refreshPulls()]);
  }, [refreshLeads, refreshPulls]);

  useEffect(() => {
    void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Writes to ut_leads and confirms a row actually changed — an RLS block
   * returns no error but zero rows, which would otherwise fail silently.
   */
  const writeLead = useCallback(async (id: string, patch: LeadUpdate) => {
    const { data, error } = await supabase.from('ut_leads').update(patch).eq('id', id).select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error('No row was updated. You may not have permission to change this lead.');
    }
  }, []);

  /**
   * Optimistic: patch the row locally, and put that one row back if the write
   * fails. Reverting a single row rather than the whole array keeps concurrent
   * edits from undoing each other.
   */
  const optimistic = useCallback(
    async (id: string, patch: LeadUpdate, failure: string): Promise<boolean> => {
      const previous = leadsRef.current.find((lead) => lead.id === id);
      if (!previous) return false;

      setLeads((current) => current.map((lead) => (lead.id === id ? { ...lead, ...patch } : lead)));
      try {
        await writeLead(id, patch);
        return true;
      } catch (error) {
        setLeads((current) => current.map((lead) => (lead.id === id ? previous : lead)));
        toast.error(`${failure} — ${errorMessage(error)}`);
        return false;
      }
    },
    [toast, writeLead],
  );

  const setStage = useCallback(
    (id: string, stage: Stage) => optimistic(id, { stage }, 'Could not move the lead'),
    [optimistic],
  );

  const addNote = useCallback(
    (id: string, body: string) => {
      const lead = leadsRef.current.find((item) => item.id === id);
      // Read the current array, prepend, and write the whole array back —
      // never overwrite existing notes.
      const existing: LeadNote[] = lead && Array.isArray(lead.notes) ? lead.notes : [];
      const note: LeadNote = {
        id: newId(),
        body,
        created_at: new Date().toISOString(),
      };
      return optimistic(id, { notes: [note, ...existing] }, 'Could not save the note');
    },
    [optimistic],
  );

  const logCall = useCallback(
    (id: string) => {
      const lead = leadsRef.current.find((item) => item.id === id);
      const attempts = (lead?.call_attempts ?? 0) + 1;
      return optimistic(
        id,
        { call_attempts: attempts, last_contacted_at: new Date().toISOString() },
        'Could not log the call',
      );
    },
    [optimistic],
  );

  const api = useMemo<DataApi>(
    () => ({
      leads,
      pulls,
      loadingLeads,
      loadingPulls,
      leadsError,
      leadsLoaded,
      refreshLeads,
      refreshPulls,
      refreshAll,
      setStage,
      addNote,
      logCall,
    }),
    [
      leads,
      pulls,
      loadingLeads,
      loadingPulls,
      leadsError,
      leadsLoaded,
      refreshLeads,
      refreshPulls,
      refreshAll,
      setStage,
      addNote,
      logCall,
    ],
  );

  return <DataContext.Provider value={api}>{children}</DataContext.Provider>;
}

export function useData(): DataApi {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used inside <DataProvider>');
  return context;
}
