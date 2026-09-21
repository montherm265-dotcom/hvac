import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, UserPlus } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import Logo from '@/components/Logo';

export default function Register() {
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { data, error: err } = await supabase.auth.signUp({ email, password });
    if (err) { setLoading(false); setError(err.message); return; }
    if (data?.user && companyName) {
      await supabase.from('profiles').update({ company_name: companyName }).eq('id', data.user.id);
    }
    setLoading(false);
    navigate('/dashboard');
  };

  return (
    <div className="section-pad flex justify-center">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="card-soft p-6">
          <h1 className="font-display text-xl font-bold">Set up your business</h1>
          <p className="mt-1 text-sm text-muted-foreground">Free to start — no card required.</p>
          <form onSubmit={submit} className="mt-5 space-y-3">
            <input required placeholder="Company name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="input-soft" />
            <input type="email" required placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="input-soft" />
            <input type="password" required minLength={6} placeholder="Password (min 6 characters)" value={password} onChange={(e) => setPassword(e.target.value)} className="input-soft" />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserPlus className="h-4 w-4" /> Create account</>}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account? <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
