import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/auth-context';
import { Profile, getRepTier, isVerifiedProfile, ACTIVITY_EMOJIS } from '../types';
import { ArrowLeft, MapPin, Briefcase, Flame, ShieldCheck, Flag } from 'lucide-react';
import ReportModal from '../components/ReportModal';
import { formatDistanceToNow } from 'date-fns';

interface PublicHangout {
  id: string;
  title: string;
  activity_type: string;
  location_text: string;
  start_time: string;
  expires_at: string;
}

const UserProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recentHangouts, setRecentHangouts] = useState<PublicHangout[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    if (!id) return;
    // Redirect own profile to /profile
    if (id === user?.id) {
      navigate('/profile', { replace: true });
      return;
    }
    fetchProfile();
  }, [id, user]);

  const fetchProfile = async () => {
    if (!id) return;
    try {
      const { data: profileData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !profileData) {
        navigate('/');
        return;
      }
      setProfile(profileData);

      // Fetch their recent completed hangouts (public social trophy case)
      const { data: hangoutData } = await supabase
        .from('participants')
        .select('hangouts:hangouts(id, title, activity_type, location_text, start_time, expires_at)')
        .eq('user_id', id)
        .eq('status', 'approved')
        .order('joined_at', { ascending: false })
        .limit(6);

      if (hangoutData) {
        const hangouts = hangoutData
          .map((d: any) => d.hangouts)
          .filter(Boolean)
          .filter((h: PublicHangout) => new Date(h.expires_at) < new Date());
        setRecentHangouts(hangouts);
      }
    } catch (err) {
      console.error(err);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="animate-pulse text-mid text-sm">Loading profile…</div>
      </div>
    );
  }

  if (!profile) return null;

  const tier = getRepTier(profile.adda_count ?? 0);
  const verified = isVerifiedProfile(profile);
  const score = profile.profile_score ?? 0;

  const vibes = (profile.interests || [])
    .filter(i => i.startsWith('vibe:'))
    .map(i => i.replace('vibe:', ''));

  const lookingFor = (profile.interests || [])
    .filter(i => i.startsWith('looking:'))
    .map(i => i.replace('looking:', ''));

  const spots = (profile.interests || [])
    .filter(i => i.startsWith('spot:'))
    .map(i => i.replace('spot:', ''));

  // Parse availability for display
  const availability = (profile.interests || [])
    .filter(i => i.startsWith('avail:'))
    .map(i => i.replace('avail:', ''));

  // Profile completeness breakdown
  const scoreBreakdown = [
    { label: 'Profile photo', pts: 25, done: !!profile.avatar_url },
    { label: 'Bio', pts: 20, done: !!profile.bio },
    { label: 'Department & Year', pts: 20, done: !!profile.occupation && profile.occupation !== ' · ' },
    { label: 'University', pts: 15, done: !!profile.location },
    { label: '3+ vibe tags', pts: 20, done: vibes.length >= 3 },
  ];

  const isOwnProfile = id === user?.id;

  return (
    <div className="min-h-screen bg-bg font-sans">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-surface border-b border-border px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 text-mid hover:text-navy rounded-full hover:bg-bg transition-colors"
        >
          <ArrowLeft size={22} />
        </button>
        <span className="font-serif text-lg text-navy">Profile</span>
        {!isOwnProfile && (
          <button
            onClick={() => setShowReport(true)}
            className="p-2 text-light hover:text-red-500 rounded-full hover:bg-red-50 transition-colors"
            title="Report user"
          >
            <Flag size={18} />
          </button>
        )}
        {isOwnProfile && <div className="w-10" />}
      </div>

      <div className="max-w-lg mx-auto p-5 space-y-5 pb-24">

        {/* Main Profile Card */}
        <div className="bg-surface rounded-2xl border border-border p-6">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-20 h-20 rounded-full border-2 border-border overflow-hidden bg-bg">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-serif font-bold text-navy">
                    {profile.name.charAt(0)}
                  </div>
                )}
              </div>
              {/* Verified badge overlay */}
              {verified && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green rounded-full flex items-center justify-center border-2 border-surface" title="Verified Profile">
                  <ShieldCheck size={12} className="text-white" />
                </div>
              )}
            </div>

            {/* Identity */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-serif text-2xl text-navy leading-none">{profile.name}</h1>
                {verified && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-green-bg text-green text-[10px] font-bold rounded-full border border-green/20">
                    <ShieldCheck size={10} /> Verified
                  </span>
                )}
              </div>

              <div className={`inline-flex items-center gap-1 mt-1 text-xs font-bold px-2 py-0.5 rounded-full bg-bg border border-border ${tier.color}`}>
                {tier.emoji} {tier.name}
              </div>

              {profile.occupation && (
                <div className="flex items-center gap-1 text-sm text-mid mt-2">
                  <Briefcase size={12} className="shrink-0" />
                  <span className="truncate">{profile.occupation}</span>
                </div>
              )}
              {profile.location && (
                <div className="flex items-center gap-1 text-sm text-mid">
                  <MapPin size={12} className="shrink-0" />
                  <span className="truncate">{profile.location}</span>
                </div>
              )}
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-sm text-mid mt-4 italic leading-relaxed border-t border-border pt-4">
              "{profile.bio}"
            </p>
          )}

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

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-surface rounded-2xl border border-border p-4 text-center">
            <div className="font-serif text-3xl text-navy">{profile.adda_count ?? 0}</div>
            <div className="text-[10px] text-mid uppercase tracking-wider mt-1">Addas</div>
          </div>
          <div className="bg-surface rounded-2xl border border-border p-4 text-center">
            <div className="font-serif text-3xl text-orange flex items-center justify-center gap-1">
              <Flame size={18} fill="currentColor" />
              {profile.streak_days ?? 0}
            </div>
            <div className="text-[10px] text-mid uppercase tracking-wider mt-1">Streak</div>
          </div>
          <div className="bg-surface rounded-2xl border border-border p-4 text-center">
            <div className="font-serif text-3xl text-navy">{profile.hosted_count ?? 0}</div>
            <div className="text-[10px] text-mid uppercase tracking-wider mt-1">Hosted</div>
          </div>
        </div>

        {/* Looking For */}
        {lookingFor.length > 0 && (
          <div className="bg-surface rounded-2xl border border-border p-5">
            <h3 className="text-[10px] font-bold text-mid uppercase tracking-widest mb-3">Looking For</h3>
            <div className="flex flex-wrap gap-2">
              {lookingFor.map(l => (
                <span key={l} className="px-3 py-1.5 bg-teal-bg text-teal rounded-full text-xs font-medium border border-teal/20">
                  {l}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Favourite Spots */}
        {spots.length > 0 && (
          <div className="bg-surface rounded-2xl border border-border p-5">
            <h3 className="text-[10px] font-bold text-mid uppercase tracking-widest mb-3">Favourite Spots</h3>
            <div className="flex flex-wrap gap-2">
              {spots.map(s => (
                <span key={s} className="px-3 py-1.5 bg-bg text-navy rounded-full text-xs font-medium border border-border">
                  📍 {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recent Hangouts (Social trophy case) */}
        {recentHangouts.length > 0 && (
          <div>
            <h3 className="font-serif text-xl text-navy mb-3">Past Addas</h3>
            <div className="space-y-2">
              {recentHangouts.map(h => (
                <div key={h.id} className="bg-surface rounded-xl border border-border p-3 flex items-center gap-3">
                  <span className="text-xl shrink-0">{ACTIVITY_EMOJIS[h.activity_type] || '🎉'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-navy truncate">{h.title}</p>
                    <p className="text-[10px] text-mid">{h.location_text}</p>
                  </div>
                  <span className="text-[10px] text-light shrink-0">
                    {formatDistanceToNow(new Date(h.start_time), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Profile completeness — only shown on own profile */}
        {isOwnProfile && score < 80 && (
          <div className="bg-orange-dim border border-orange/20 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-orange">Complete your profile</h3>
              <span className="text-sm font-bold text-orange">{score}/100</span>
            </div>
            <div className="h-2 bg-white/50 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-orange rounded-full transition-all duration-700"
                style={{ width: `${score}%` }}
              />
            </div>
            <p className="text-xs text-orange/80 mb-3">
              Reach 80 to earn the ✅ Verified Profile badge — others trust verified users more.
            </p>
            <div className="space-y-1.5">
              {scoreBreakdown.filter(s => !s.done).map(s => (
                <div key={s.label} className="flex items-center justify-between text-xs text-orange/70">
                  <span>+ {s.label}</span>
                  <span className="font-bold">+{s.pts} pts</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => navigate('/onboarding')}
              className="mt-4 w-full py-2 bg-orange text-white rounded-xl text-sm font-bold hover:bg-orange/90 transition-colors"
            >
              Edit Profile
            </button>
          </div>
        )}

      </div>

      {showReport && (
        <ReportModal
          targetUserId={id}
          targetUserName={profile.name}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
};

export default UserProfile;
