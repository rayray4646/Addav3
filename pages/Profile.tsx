import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/auth-context';
import { LogOut, Flame, Calendar, Edit2, MapPin, Briefcase } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Hangout, getRepTier, ACTIVITY_EMOJIS } from '../types';
import { formatDistanceToNow } from 'date-fns';

const ProfilePage = () => {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [myHangouts, setMyHangouts] = useState<Hangout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchMyHangouts();
  }, [user]);

  const fetchMyHangouts = async () => {
    if (!user) return;
    try {
      // Get hangouts I created (with participant count)
      const { data: created } = await supabase
        .from('hangouts')
        .select('*, creator:users(id, name, avatar_url, occupation), participants:participants(user_id, status)')
        .eq('creator_id', user.id)
        .order('start_time', { ascending: false })
        .limit(20);

      // Get hangouts I joined and was approved for
      const { data: joinedData } = await supabase
        .from('participants')
        .select('hangout_id, hangouts:hangouts(*, creator:users(id, name, avatar_url, occupation), participants:participants(user_id, status))')
        .eq('user_id', user.id)
        .eq('status', 'approved')
        .order('joined_at', { ascending: false })
        .limit(20);

      const joined = (joinedData || [])
        .map((d: any) => d.hangouts)
        .filter((h: any) => h && h.creator_id !== user.id);

      // Merge, deduplicate, sort
      const all = [...(created || []), ...joined].sort(
        (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
      );

      // Remove duplicates by id
      const seen = new Set<string>();
      const unique = all.filter(h => {
        if (seen.has(h.id)) return false;
        seen.add(h.id);
        return true;
      });

      const formatted = unique.map(h => ({
        ...h,
        participant_count: (h.participants || []).filter((p: any) => p.status === 'approved').length,
        my_status: 'approved' as const,
      }));

      setMyHangouts(formatted);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!profile) return null;

  const addaCount = profile.adda_count ?? 0;
  const hostedCount = profile.hosted_count ?? 0;
  const streakDays = profile.streak_days ?? 0;
  const tier = getRepTier(addaCount);

  // Parse interests from stored format
  const vibes = (profile.interests || [])
    .filter(i => i.startsWith('vibe:'))
    .map(i => i.replace('vibe:', ''));

  const now = new Date();
  const activeHangouts = myHangouts.filter(h => new Date(h.expires_at) > now);
  const pastHangouts = myHangouts.filter(h => new Date(h.expires_at) <= now);

  const TIER_STEPS = [
    { name: 'Starter', threshold: 0, emoji: '🌱' },
    { name: 'Regular', threshold: 3, emoji: '⭐' },
    { name: 'Connector', threshold: 10, emoji: '🔗' },
    { name: 'Campus Legend', threshold: 25, emoji: '🏆' },
  ];

  return (
    <Layout>
      <div className="p-5 pb-28 space-y-6">

        {/* Profile Header */}
        <div className="bg-surface rounded-2xl border border-border p-6 relative">
          <button
            onClick={() => navigate('/onboarding')}
            className="absolute top-4 right-4 p-2 text-mid hover:text-navy bg-bg border border-border rounded-full shadow-sm transition-colors"
          >
            <Edit2 size={15} />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full border-2 border-border overflow-hidden bg-bg shrink-0">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl font-serif font-bold text-navy">
                  {profile.name.charAt(0)}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-serif text-2xl text-navy">{profile.name}</h1>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-bg border border-border ${tier.color}`}>
                  {tier.emoji} {tier.name}
                </span>
              </div>
              {profile.occupation && (
                <div className="flex items-center gap-1 text-sm text-mid mt-0.5">
                  <Briefcase size={12} />
                  <span>{profile.occupation}</span>
                </div>
              )}
              {profile.location && (
                <div className="flex items-center gap-1 text-sm text-mid">
                  <MapPin size={12} />
                  <span>{profile.location}</span>
                </div>
              )}
              {profile.bio && (
                <p className="text-sm text-mid mt-1 line-clamp-2 italic">"{profile.bio}"</p>
              )}
            </div>
          </div>

          {/* Vibe Tags */}
          {vibes.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {vibes.map(v => (
                <span key={v} className="px-2.5 py-1 bg-orange-dim text-orange rounded-full text-[11px] font-bold border border-orange/20">
                  {v}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-surface rounded-2xl border border-border p-4 text-center">
            <div className="font-serif text-3xl text-navy">{addaCount}</div>
            <div className="text-[10px] text-mid uppercase tracking-wider mt-1">Addas</div>
          </div>
          <div className="bg-surface rounded-2xl border border-border p-4 text-center">
            <div className="font-serif text-3xl text-orange flex items-center justify-center gap-1">
              <Flame size={20} fill="currentColor" />
              {streakDays}
            </div>
            <div className="text-[10px] text-mid uppercase tracking-wider mt-1">Streak</div>
          </div>
          <div className="bg-surface rounded-2xl border border-border p-4 text-center">
            <div className="font-serif text-3xl text-navy">{hostedCount}</div>
            <div className="text-[10px] text-mid uppercase tracking-wider mt-1">Hosted</div>
          </div>
        </div>

        {/* Reputation Tier Progress */}
        <div className="bg-surface rounded-2xl border border-border p-5">
          <h3 className="text-[10px] font-bold text-mid uppercase tracking-widest mb-4">Reputation</h3>
          <div className="flex justify-between items-end mb-3">
            {TIER_STEPS.map((t, i) => {
              const isReached = addaCount >= t.threshold;
              const isCurrent = tier.name === t.name;
              return (
                <div key={t.name} className="flex flex-col items-center gap-1">
                  <span className={`text-lg ${isReached ? 'opacity-100' : 'opacity-30'}`}>{t.emoji}</span>
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${isCurrent ? 'text-orange' : isReached ? 'text-navy' : 'text-light'}`}>
                    {t.name.split(' ')[0]}
                  </span>
                  {i < TIER_STEPS.length - 1 && (
                    <span className="text-[8px] text-light">at {TIER_STEPS[i + 1].threshold}</span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="h-2 bg-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-orange rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, (addaCount / 25) * 100)}%` }}
            />
          </div>
          {tier.next && (
            <p className="text-[10px] text-mid mt-2">{tier.next}</p>
          )}
        </div>

        {/* Active Hangouts */}
        {!loading && activeHangouts.length > 0 && (
          <div>
            <h3 className="font-serif text-xl text-navy mb-3">Active Addas</h3>
            <div className="space-y-3">
              {activeHangouts.map(h => (
                <button
                  key={h.id}
                  onClick={() => navigate(`/hangout/${h.id}`)}
                  className="w-full text-left bg-surface rounded-xl border border-border p-4 hover:border-orange/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-orange">{ACTIVITY_EMOJIS[h.activity_type] || '🎉'} {h.activity_type}</span>
                    <span className="text-[10px] text-light">{h.participant_count}/{h.max_participants} joined</span>
                  </div>
                  <p className="font-serif text-navy">{h.title}</p>
                  <p className="text-xs text-mid truncate">{h.location_text}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Past Hangouts */}
        {!loading && pastHangouts.length > 0 && (
          <div>
            <h3 className="font-serif text-xl text-navy mb-3">Past Addas</h3>
            <div className="space-y-2">
              {pastHangouts.slice(0, 5).map(h => (
                <div key={h.id} className="bg-bg rounded-xl border border-border p-3 opacity-80">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-navy">{h.title}</p>
                      <p className="text-[10px] text-mid">{h.location_text} · {h.participant_count} people</p>
                    </div>
                    <span className="text-[10px] text-light shrink-0 ml-2">
                      {formatDistanceToNow(new Date(h.start_time), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sign Out */}
        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold text-mid hover:text-red-500 border border-border hover:border-red-200 rounded-xl transition-colors"
        >
          <LogOut size={16} /> Sign Out
        </button>

      </div>
    </Layout>
  );
};

export default ProfilePage;
