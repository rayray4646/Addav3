import React, { useState, useEffect } from 'react';
import { Hangout } from '../types';
import { Check, Timer, MapPin } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface HangoutCardProps {
  hangout: Hangout;
  onJoin: (id: string) => void;
  joiningId: string | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Coffee': '#F97316',
  'Study': '#0D9488',
  'Sports': '#F59E0B',
  'Walk': '#64748B',
  'Food': '#F43F5E',
  'Other': '#6B6B6B',
};

const CATEGORY_BG: Record<string, string> = {
  'Coffee': 'bg-orange-dim',
  'Study': 'bg-teal-bg',
  'Sports': 'bg-amber-50',
  'Walk': 'bg-slate-50',
  'Food': 'bg-rose-50',
  'Other': 'bg-bg',
};

const HangoutCard: React.FC<HangoutCardProps> = ({ hangout, onJoin, joiningId }) => {
  const navigate = useNavigate();
  const [optimisticJoined, setOptimisticJoined] = useState(false);
  const [countdown, setCountdown] = useState('');

  const startTime = new Date(hangout.start_time);
  const isExpired = new Date() > new Date(hangout.expires_at);
  const participantCount = hangout.participant_count || 0;
  const isFull = participantCount >= hangout.max_participants;
  const spotsLeft = hangout.max_participants - participantCount;
  const fillPercentage = Math.min(100, (participantCount / hangout.max_participants) * 100);
  const isLastSpot = spotsLeft === 1;
  const isHighCapacity = fillPercentage >= 80;

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date().getTime();
      const distance = startTime.getTime() - now;

      if (distance < 0) {
        setCountdown('Live Now');
      } else {
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));

        if (days > 0) setCountdown(`in ${days}d ${hours}h`);
        else if (hours > 0) setCountdown(`in ${hours}h ${minutes}m`);
        else if (minutes > 0) setCountdown(`in ${minutes}m`);
        else setCountdown('Starting soon');
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleJoinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hangout.my_status) {
      navigate(`/hangout/${hangout.id}`);
    } else {
      onJoin(hangout.id);
      setOptimisticJoined(true);
      setTimeout(() => setOptimisticJoined(false), 2000);
    }
  };

  if (isExpired) return null;

  const barColor = CATEGORY_COLORS[hangout.activity_type] || CATEGORY_COLORS['Other'];
  const previews = hangout.participant_previews || [];

  return (
    <div
      onClick={() => navigate(`/hangout/${hangout.id}`)}
      className="group relative bg-surface rounded-card border border-border p-4 hover:-translate-y-[2px] hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden"
    >
      {/* Colored Left Bar */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: barColor }} />

      {/* Last spot flash */}
      {isLastSpot && !hangout.my_status && (
        <div className="absolute top-3 right-3 px-2 py-0.5 bg-orange text-white text-[9px] font-bold uppercase tracking-wider rounded-full animate-pulse">
          Last spot!
        </div>
      )}

      <div className="pl-2">
        {/* Header */}
        <div className="flex justify-between items-start mb-1">
          <span
            className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md ${CATEGORY_BG[hangout.activity_type] || 'bg-bg'}`}
            style={{ color: barColor }}
          >
            {hangout.activity_type}
          </span>
          <span className="text-[10px] text-light">
            {formatDistanceToNow(new Date(hangout.created_at), { addSuffix: true })}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-serif text-[17px] text-navy leading-snug mb-1 pr-12">
          {hangout.title}
        </h3>

        {/* Time + Location */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-1 text-xs font-medium text-orange">
            <Timer size={11} />
            <span>{countdown}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-mid truncate">
            <MapPin size={11} />
            <span className="truncate">{hangout.location_text}</span>
          </div>
        </div>

        {/* Host Info */}
        <div className="flex items-center mb-3">
          <div className="w-5 h-5 rounded-full bg-bg border border-border overflow-hidden mr-1.5 shrink-0">
            {hangout.creator?.avatar_url ? (
              <img src={hangout.creator.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-mid">
                {hangout.creator?.name?.charAt(0) || '?'}
              </div>
            )}
          </div>
          <span className="text-xs text-mid">
            <span className="font-semibold text-navy">{hangout.creator?.name?.split(' ')[0] || 'Host'}</span>
            {hangout.creator?.occupation && (
              <span className="ml-1 text-light">· {hangout.creator.occupation}</span>
            )}
          </span>
        </div>

        {/* Capacity Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-[10px] mb-1 font-medium">
            <span className={isHighCapacity ? 'text-orange font-bold' : 'text-mid'}>
              {participantCount} joined
            </span>
            <span className="text-light">{hangout.max_participants} spots</span>
          </div>
          <div className="h-[3px] w-full bg-bg rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${isHighCapacity ? 'bg-orange' : 'bg-teal'}`}
              style={{ width: `${fillPercentage}%` }}
            />
          </div>
        </div>

        {/* Footer: Real Avatar Stack + Join Button */}
        <div className="flex justify-between items-center">
          {/* Real Participant Avatars */}
          <div className="flex -space-x-2">
            {previews.map((p, i) => (
              <div
                key={i}
                title={p.name}
                className="w-6 h-6 rounded-full border-2 border-surface bg-bg overflow-hidden"
              >
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-mid">
                    {p.name.charAt(0)}
                  </div>
                )}
              </div>
            ))}
            {participantCount > 3 && (
              <div className="w-6 h-6 rounded-full border-2 border-surface bg-bg flex items-center justify-center text-[8px] text-mid font-bold">
                +{participantCount - 3}
              </div>
            )}
            {participantCount === 0 && (
              <span className="text-[10px] text-light italic">Be the first</span>
            )}
          </div>

          {/* Join / Status Button */}
          <button
            onClick={handleJoinClick}
            disabled={(isFull && !hangout.my_status) || joiningId === hangout.id || hangout.my_status === 'pending'}
            className={`
              h-8 px-4 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1 shrink-0
              ${hangout.my_status === 'approved'
                ? 'bg-green-bg text-green border border-green/20'
                : hangout.my_status === 'pending'
                ? 'bg-bg text-mid border border-border cursor-not-allowed'
                : optimisticJoined
                ? 'bg-green text-white scale-105'
                : isFull
                ? 'bg-bg text-light border border-border cursor-not-allowed'
                : 'bg-orange text-white hover:bg-orange/90 shadow-sm active:scale-95'}
            `}
          >
            {hangout.my_status === 'approved' ? 'Open Chat' :
             hangout.my_status === 'pending' ? 'Pending…' :
             joiningId === hangout.id ? '…' :
             optimisticJoined ? <><Check size={13} /> Sent!</> :
             isFull ? 'Full' : 'Join'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HangoutCard;
