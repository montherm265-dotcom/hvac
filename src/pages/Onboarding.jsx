import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import TaxonomyPicker from '@/components/TaxonomyPicker';

const STEPS = ['location', 'skills', 'interests', 'lived_experience'];

export default function Onboarding() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [city, setCity] = useState('');
  const [skills, setSkills] = useState([]);
  const [interests, setInterests] = useState([]);
  const [experienceTitle, setExperienceTitle] = useState('');
  const [experienceCategory, setExperienceCategory] = useState('');
  const [saving, setSaving] = useState(false);

  async function finish() {
    setSaving(true);
    if (city) await supabase.from('profiles').update({ city }).eq('id', user.id);
    if (skills.length) await supabase.from('profile_skills').insert(skills.map((s) => ({ profile_id: user.id, skill_id: s.id, mode: 'can_help' })));
    if (interests.length) await supabase.from('profile_interests').insert(interests.map((i) => ({ profile_id: user.id, interest_id: i.id })));
    if (experienceTitle.trim()) {
      await supabase.from('lived_experiences').insert({
        profile_id: user.id, category: experienceCategory.trim() || 'general', title: experienceTitle.trim(),
      });
    }
    await supabase.from('profiles').update({ onboarding_completed_at: new Date().toISOString() }).eq('id', user.id);
    await refreshProfile();
    setSaving(false);
    navigate('/');
  }

  function next() {
    if (step < STEPS.length - 1) setStep(step + 1);
    else finish();
  }

  return (
    <div className="section-pad">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 flex gap-1.5">
          {STEPS.map((s, i) => <span key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-accent' : 'bg-muted'}`} />)}
        </div>

        {step === 0 && (
          <div>
            <h1 className="font-display text-2xl font-bold">Where are you?</h1>
            <p className="mt-2 text-sm text-muted-foreground">City-level only — HUMAN never tracks precise location.</p>
            <input className="input-soft mt-6" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" autoFocus />
          </div>
        )}

        {step === 1 && (
          <div>
            <h1 className="font-display text-2xl font-bold">What can you help with?</h1>
            <p className="mt-2 text-sm text-muted-foreground">This is how "Needs You" and Ask Human find you.</p>
            <div className="mt-6">
              <TaxonomyPicker table="skills" selected={skills} onChange={setSkills} placeholder="Search or add a skill…" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="font-display text-2xl font-bold">What are you into?</h1>
            <p className="mt-2 text-sm text-muted-foreground">Helps HUMAN surface Missions you'd actually want to join.</p>
            <div className="mt-6">
              <TaxonomyPicker table="interests" selected={interests} onChange={setInterests} placeholder="Search or add an interest…" />
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 className="font-display text-2xl font-bold">Anything you've lived through that could help someone else?</h1>
            <p className="mt-2 text-sm text-muted-foreground">Optional. This is what makes HUMAN's matching different — real lived experience, not just skills.</p>
            <div className="mt-6 space-y-3">
              <input className="input-soft" value={experienceCategory} onChange={(e) => setExperienceCategory(e.target.value)} placeholder="Category (e.g. grief, immigration, parenting)" />
              <input className="input-soft" value={experienceTitle} onChange={(e) => setExperienceTitle(e.target.value)} placeholder="In a few words…" />
            </div>
          </div>
        )}

        <div className="mt-8 flex justify-between">
          <button type="button" onClick={() => (step > 0 ? setStep(step - 1) : finish())} className="btn-ghost">
            {step > 0 ? 'Back' : 'Skip for now'}
          </button>
          <button type="button" disabled={saving} onClick={next} className="btn-primary">
            {saving ? 'Saving…' : step === STEPS.length - 1 ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
