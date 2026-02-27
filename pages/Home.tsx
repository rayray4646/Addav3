import React, { useEffect, useState, useRef, useCallback } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/auth-context';
import { supabase } from '../lib/supabase';
import { Hangout, ACTIVITY_TYPES } from '../types';
import HangoutCard from '../components/HangoutCard';
import CreateHangoutModal from '../components/CreateHangoutModal';
import { Coffee } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

interface RecentEvent {
  title: string;
  participant_count: number;
  location_text: string;
  activity_type: string;
}

const Home = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [hangouts, setHangouts] = useState<Hangout[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('All');
  const [recentEvent, setRecentEvent] = useState<RecentEvent | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const FILTERS = ['All', ...ACTIVITY_TYPES];

  // Redirect to Onboarding if profile incomplete
  useEffect(() => {
    if (!authLoading && user) {
      const isIncomplete = !profile ||
        !profile.occupation ||
        !profile.location ||
        profile.occupation.trim() === '' ||
        profile.location.trim() === '' ||
        profile.occupation === ' · ';
      if (isIncomplete) navigate('/onboarding');
    }
  }, [profile, user, authLoading, navigate]);

  const fetchHangouts = useCallback(async () => {
    if (!user) return;
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('hangouts')
      .select(`
        id, creator_id, activity_type, title, location_text, start_time,
        max_participants, created_at, expires_at,
        creator:users(id, name, avatar_url, occupation),
        participants:participants(user_id, status, user:users(name, avatar_url))
      `)
      .gt('expires_at', now)
      .order('start_time', { ascending: true })
      .limit(50); // Cap results to protect free tier

    if (error) {
      console.error('Feed error:', error);
      setLoading(false);
      return;
    }

    if (data) {
      const formatted: Hangout[] = data.map((h: any) => {
        const myRow = h.participants.find((p: any) => p.user_id === user.id);
        const approved = h.participants.filter((p: any) => p.status === 'approved');
        const previews = approved
          .slice(0, 3)
          .map((p: any) => ({ name: p.user?.name || '?', avatar_url: p.user?.avatar_url || null }));

        return {
          ...h,
          participant_count: approved.length,
          my_status: myRow ? myRow.status : null,
          participant_previews: previews,
        };
      });
      setHangouts(formatted);
    }
    setLoading(false);
  }, [user]);

  // Fetch a recently completed hangout for the FOMO card
  const fetchRecentEvent = useCallback(async () => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    const { data } = await supabase
      .from('hangouts')
      .select('title, location_text, activity_type, participants:participants(count)')
      .lt('expires_at', now)
      .gt('expires_at', oneDayAgo)
      .order('expires_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      setRecentEvent({
        title: data.title,
        location_text: data.location_text,
        activity_type: data.activity_type,
        participant_count: (data as any).participants?.[0]?.count || 0,
      });
    }
  }, []);

  useEffect(() => {
    fetchHangouts();
    fetchRecentEvent();
  }, [fetchHangouts, fetchRecentEvent]);

  // Realtime: debounce refetch to avoid hammering the DB on free tier
  useEffect(() => {
    if (!user) return;

    const triggerRefetch = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchHangouts();
      }, 500);
    };

    // Use user-specific channel name to avoid multi-tab conflicts
    const channel = supabase
      .channel(`home-feed-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hangouts' }, triggerRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, triggerRefetch)
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [user, fetchHangouts]);

  const handleJoin = async (id: string) => {
    if (!user) return;
    setJoiningId(id);
    try {
      const { error } = await supabase.rpc('join_hangout', { hangout_id_input: id });
      if (error) throw error;

      // Optimistic update
      setHangouts(prev => prev.map(h => {
        if (h.id !== id) return h;
        const status = h.creator_id === user.id ? 'approved' : 'pending';
        return { ...h, my_status: status };
      }));
    } catch (err: any) {
      alert(err.message || 'Could not join');
    } finally {
      setJoiningId(null);
    }
  };

  const filteredHangouts = activeFilter === 'All'
    ? hangouts
    : hangouts.filter(h => h.activity_type === activeFilter);

  return (
    <Layout onOpenCreate={() => setIsCreateOpen(true)}>
      <div className="p-5 space-y-5">

        {/* Live Pulse Banner */}
        <div className="flex items-center gap-3 p-3 bg-surface rounded-xl border border-border shadow-sm">
          <div className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange"></span>
          </div>
          <span className="text-sm font-medium text-navy flex-1">
            {loading ? 'Finding addas…' : `${hangouts.length} ${hangouts.length === 1 ? 'adda' : 'addas'} happening on campus`}
          </span>
          <span className="px-2 py-0.5 bg-red-50 text-red-600 text-[10px] font-bold uppercase tracking-wider rounded-md border border-red-100">
            Live
          </span>
        </div>

        {/* Filter Chips */}
        <div className="flex overflow-x-auto no-scrollbar gap-2 -mx-5 px-5 pb-1">
          {FILTERS.map(filter => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`
                whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium border transition-all
                ${activeFilter === filter
                  ? 'bg-orange text-white border-orange shadow-sm'
                  : 'bg-surface text-mid border-border hover:border-mid'}
              `}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Feed */}
        <div>
          {loading && hangouts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-light">
              <div className="animate-pulse text-sm">Finding spots…</div>
            </div>
          ) : filteredHangouts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="w-16 h-16 bg-surface border border-border rounded-full flex items-center justify-center mb-4 text-light">
                <Coffee size={32} />
              </div>
              <h3 className="text-xl font-serif text-navy">No ADDAs right now</h3>
              <p className="text-mid mt-2 text-sm">Be the first to start one!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredHangouts.map((hangout, index) => (
                <div
                  key={hangout.id}
                  style={{ animationDelay: `${index * 50}ms` }}
                  className="animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards"
                >
                  <HangoutCard
                    hangout={hangout}
                    onJoin={handleJoin}
                    joiningId={joiningId}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Post-Event FOMO Card — only shown when there's a real recent event */}
        {recentEvent && recentEvent.participant_count >= 2 && (
          <div className="bg-green-bg rounded-card border border-green/20 p-5 relative overflow-hidden">
            <div className="relative z-10">
              <div className="text-[10px] font-bold uppercase tracking-wider text-green mb-1">Recently on campus</div>
              <p className="text-navy font-serif text-lg leading-tight mb-3">
                {recentEvent.participant_count} people did "{recentEvent.title}" at {recentEvent.location_text}
              </p>
              <p className="text-xs text-green/70">Don't miss the next one — check back soon!</p>
            </div>
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-green/10 rounded-full blur-xl"></div>
          </div>
        )}

      </div>

      {isCreateOpen && (
        <CreateHangoutModal
          onClose={() => setIsCreateOpen(false)}
          onCreated={fetchHangouts}
        />
      )}
    </Layout>
  );
};

export default Home;
