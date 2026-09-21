import React, { useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import BackendNotice from '@/components/BackendNotice';
import { useI18n } from '@/i18n';

export default function Auth() {
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get('mode') === 'signup' ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const { signIn, signUpWithProfile } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        await signUpWithProfile({ email, password, username, displayName });
        navigate('/onboarding', { replace: true });
      } else {
        await signIn({ email, password });
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="section-pad">
      <div className="mx-auto max-w-sm">
        <h1 className="text-center font-display text-2xl font-bold">
          {mode === 'signup' ? t('auth.joinTitle') : t('auth.signInTitle')}
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {mode === 'signup' ? t('auth.joinSubtitle') : t('auth.signInSubtitle')}
        </p>

        {!isSupabaseConfigured && <BackendNotice className="mt-6" />}

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          {mode === 'signup' && (
            <>
              <input
                className="input-soft" placeholder="Display name" value={displayName}
                onChange={(e) => setDisplayName(e.target.value)} required maxLength={60}
              />
              <input
                className="input-soft" placeholder="username" value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                pattern="[a-z0-9_]{3,24}" title="3-24 lowercase letters, numbers, or underscores" required
              />
            </>
          )}
          <input
            className="input-soft" type="email" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)} required
          />
          <input
            className="input-soft" type="password" placeholder="Password" value={password}
            onChange={(e) => setPassword(e.target.value)} required minLength={6}
          />

          {error && <p className="text-sm text-danger">{error}</p>}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <button
          type="button"
          className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setMode((m) => (m === 'signup' ? 'signin' : 'signup'))}
        >
          {mode === 'signup' ? 'Already on HUMAN? Sign in' : "New here? Join HUMAN"}
        </button>
      </div>
    </div>
  );
}
