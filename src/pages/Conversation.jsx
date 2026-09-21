import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Send } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';

export default function Conversation() {
  const { id } = useParams();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('messages')
        .select('*, profiles(display_name)')
        .eq('conversation_id', id)
        .order('created_at');
      if (!active) return;
      setMessages(data ?? []);
      setLoading(false);
      await supabase.from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', id).eq('user_id', user.id);
    }
    load();

    const channel = supabase
      .channel(`messages:${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, (payload) => {
        setMessages((prev) => (prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]));
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [id, user.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    const { data, error: sendError } = await supabase.from('messages')
      .insert({ conversation_id: id, sender_id: user.id, body })
      .select()
      .single();
    if (sendError) {
      setError(sendError.message);
      setDraft(body);
      return;
    }
    // Append immediately rather than waiting on the realtime channel, which can
    // lag or drop; the postgres_changes listener still dedupes by id for everyone else.
    setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
  }

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>;

  return (
    <div className="section-pad flex flex-col">
      <div className="mx-auto flex h-[70vh] w-full max-w-lg flex-col">
        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {messages.map((m) => (
            <div key={m.id} className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${m.sender_id === user.id ? 'ml-auto bg-accent text-white' : 'bg-muted'}`}>
              {m.body}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <form onSubmit={handleSend} className="mt-3 flex gap-2">
          <input className="input-soft" placeholder="Message…" value={draft} onChange={(e) => setDraft(e.target.value)} />
          <button type="submit" className="btn-primary" aria-label="Send"><Send className="h-4 w-4" /></button>
        </form>
      </div>
    </div>
  );
}
