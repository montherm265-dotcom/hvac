import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, LogIn } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import Logo from '@/components/Logo';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    navigate('/dashboard');
  };

  return (
    <div className="section-pad flex justify-center">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="card-soft p-6">
          <h1 className="font-display text-xl font-bold">Welcome back</h1>
          <form onSubmit={submit} className="mt-5 space-y-3">
            <input type="email" required placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="input-soft" />
            <input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-soft" />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><LogIn className="h-4 w-4" /> Sign in</>}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            No account? <Link to="/register" className="font-medium text-primary hover:underline">Start free</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
