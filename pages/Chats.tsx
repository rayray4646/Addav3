import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/auth-context';
import { Hangout, ACTIVITY_EMOJIS } from '../types';
import { Link } from 'react-router-dom';
import { MessageCircle, Clock, MapPin } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

const Chats = () => {
  const { user } = useAuth();
  const [chats, setChats] = useState<Hangout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchChats = async () => {
      const { data, error } = await supabase
        .from('participants')
        .select('hangout:hangouts(*, creator:users(id, name, avatar_url))')
        .eq('user_id', user.id)
        .eq('status', 'approved')
        .order('joined_at', { ascending: false })
        .limit(30);

      if (!error && data) {
        const all = data
          .map((row: any) => row.hangout)
          .filter(Boolean)
          .sort((a: Hangout, b: Hangout) =>
            new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
          );
        setChats(all);
      }
      setLoading(false);
    };

    fetchChats();

    const channel = supabase
      .channel(`user-chats-${user.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'participants',
        filter: `user_id=eq.${user.id}`,
      }, () => { fetchChats(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const now = new Date();
  const activeChats = chats.filter(h => new Date(h.expires_at) > now);
  const pastChats = chats.filter(h => new Date(h.expires_at) <= now);

  const ChatCard = ({ chat, isPast }: { chat: Hangout; isPast?: boolean }) => (
    <Link
      to={`/hangout/${chat.id}`}
      className={`block rounded-xl border p-4 transition-all group ${
        isPast
          ? 'bg-bg border-border opacity-70 hover:opacity-100'
          : 'bg-surface border-border shadow-sm hover:border-orange/40 hover:shadow-md'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-orange-dim flex items-center justify-center text-xl shrink-0">
          {ACTIVITY_EMOJIS[chat.activity_type] || '🎉'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] font-bold text-mid uppercase tracking-wider">{chat.activity_type}</span>
            <span className="text-[10px] text-light">
              {isPast
                ? formatDistanceToNow(new Date(chat.start_time), { addSuffix: true })
                : formatDistanceToNow(new Date(chat.start_time), { addSuffix: true })}
            </span>
          </div>
          <h3 className={`font-serif text-base leading-tight truncate ${isPast ? 'text-mid' : 'text-navy group-hover:text-orange transition-colors'}`}>
            {chat.title}
          </h3>
          <div className="flex items-center text-xs text-light mt-0.5 gap-3">
            <span className="flex items-center gap-0.5">
              <MapPin size={10} />
              <span className="truncate">{chat.location_text}</span>
            </span>
            {chat.creator && (
              <span className="truncate">by {chat.creator.name?.split(' ')[0]}</span>
            )}
          </div>
        </div>
        {!isPast && (
          <div className="shrink-0">
            <div className="w-2 h-2 bg-orange rounded-full animate-pulse"></div>
          </div>
        )}
      </div>
    </Link>
  );

  return (
    <Layout>
      <div className="p-5 pb-28">
        <h1 className="font-serif text-3xl text-navy mb-6">Your Chats</h1>

        {loading ? (
          <div className="text-mid text-center mt-10 animate-pulse">Loading…</div>
        ) : chats.length === 0 ? (
          <div className="text-center mt-20 text-mid">
            <div className="w-16 h-16 bg-surface border border-border rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle size={28} className="text-light" />
            </div>
            <p className="font-serif text-lg text-navy mb-1">No chats yet</p>
            <p className="text-sm">Join an ADDA to start chatting!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {activeChats.length > 0 && (
              <div>
                <h2 className="text-[10px] font-bold text-mid uppercase tracking-widest mb-3">Active</h2>
                <div className="space-y-3">
                  {activeChats.map(c => <ChatCard key={c.id} chat={c} />)}
                </div>
              </div>
            )}

            {pastChats.length > 0 && (
              <div>
                <h2 className="text-[10px] font-bold text-mid uppercase tracking-widest mb-3">Past Addas</h2>
                <div className="space-y-3">
                  {pastChats.slice(0, 10).map(c => <ChatCard key={c.id} chat={c} isPast />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Chats;
