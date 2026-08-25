import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../providers/AuthProvider';
import { errorMessage } from '../lib/supabase';
import { Brand } from './Brand';

export function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      // On success the auth listener swaps this screen out.
    } catch (caught) {
      setError(errorMessage(caught, 'Could not sign in. Check your email and password.'));
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={handleSubmit}>
        <Brand height={32} />

        <div className="login-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="login-field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {error && <div className="login-error">{error}</div>}

        <button type="submit" className="btn-primary" disabled={busy}>
          {busy && <Loader2 size={15} className="spin" aria-hidden="true" />}
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
