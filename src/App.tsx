import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Login } from './components/Login';
import { Sidebar } from './components/Sidebar';
import { PAGES, type PageKey } from './lib/constants';
import { Dashboard } from './pages/Dashboard';
import { Pipeline } from './pages/Pipeline';
import { PullLeads } from './pages/PullLeads';
import { useAuth } from './providers/AuthProvider';
import { DataProvider } from './providers/DataProvider';

function readHash(): PageKey {
  const hash = window.location.hash.replace('#', '');
  return PAGES.some((page) => page.key === hash) ? (hash as PageKey) : 'pull';
}

function Shell() {
  const [page, setPage] = useState<PageKey>(readHash);

  useEffect(() => {
    function onHashChange() {
      setPage(readHash());
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  function navigate(next: PageKey) {
    window.location.hash = `#${next}`;
    setPage(next);
  }

  return (
    <div className="app">
      <Sidebar page={page} onNavigate={navigate} />
      <main className="main">
        <div className="page">
          {page === 'dashboard' && <Dashboard />}
          {page === 'pipeline' && <Pipeline />}
          {page === 'pull' && <PullLeads />}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const { session, loading } = useAuth();

  // Wait for the persisted session before deciding — no login flash on reload.
  if (loading) {
    return (
      <div className="login-wrap">
        <Loader2 size={20} className="spin" aria-label="Loading" />
      </div>
    );
  }

  // No session means no queries run at all: DataProvider only mounts below.
  if (!session) return <Login />;

  return (
    <DataProvider>
      <Shell />
    </DataProvider>
  );
}
