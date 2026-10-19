import { LogOut } from 'lucide-react';
import { PAGES, type PageKey } from '../lib/constants';
import { useAuth } from '../providers/AuthProvider';
import { useToast } from '../providers/ToastProvider';
import { errorMessage } from '../lib/supabase';
import { Brand } from './Brand';

interface Props {
  page: PageKey;
  onNavigate: (page: PageKey) => void;
}

export function Sidebar({ page, onNavigate }: Props) {
  const { signOut } = useAuth();
  const toast = useToast();

  async function handleSignOut() {
    try {
      await signOut();
    } catch (error) {
      toast.error(`Could not sign out — ${errorMessage(error)}`);
    }
  }

  return (
    <aside className="sidebar">
      <Brand height={26} />
      <nav className="nav">
        {PAGES.map((item) => (
          <button
            key={item.key}
            type="button"
            className={page === item.key ? 'active' : ''}
            onClick={() => onNavigate(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button type="button" className="signout" onClick={handleSignOut}>
          <LogOut size={14} aria-hidden="true" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
