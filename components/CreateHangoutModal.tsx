import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/auth-context';
import { X, MapPin, Clock, Users } from 'lucide-react';
import Button from './Button';
import { ACTIVITY_TYPES, ActivityType, ACTIVITY_EMOJIS, CAMPUS_SPOTS } from '../types';

interface CreateHangoutModalProps {
  onClose: () => void;
  onCreated: () => void;
}

const CreateHangoutModal: React.FC<CreateHangoutModalProps> = ({ onClose, onCreated }) => {
  const { user } = useAuth();
  const [activityType, setActivityType] = useState<ActivityType>('Coffee');
  const [title, setTitle] = useState('');
  const [locationText, setLocationText] = useState('');
  const [usePresetSpot, setUsePresetSpot] = useState(true);
  const [dateTime, setDateTime] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(4);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    const now = new Date();
    now.setHours(now.getHours() + 1);
    now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
    const offset = now.getTimezoneOffset() * 60000;
    setDateTime(new Date(now.getTime() - offset).toISOString().slice(0, 16));
    return () => setIsVisible(false);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!title.trim()) return setError('Please enter a title.');
    if (!locationText.trim()) return setError('Please enter a location.');

    setLoading(true);
    setError(null);

    const startTime = new Date(dateTime);
    const expiresAt = new Date(startTime.getTime() + 2 * 60 * 60 * 1000); // 2 hours

    try {
      const { data: hangout, error: hangoutError } = await supabase
        .from('hangouts')
        .insert({
          creator_id: user.id,
          activity_type: activityType,
          title: title.trim(),
          location_text: locationText.trim(),
          start_time: startTime.toISOString(),
          max_participants: maxParticipants,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (hangoutError) throw hangoutError;

      const { error: joinError } = await supabase.rpc('join_hangout', {
        hangout_id_input: hangout.id
      });
      if (joinError) throw joinError;

      onCreated();
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create hangout');
    } finally {
      setLoading(false);
    }
  };

  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  const minDate = new Date(now.getTime() - offset).toISOString().slice(0, 16);
  const maxDate = new Date(now.getTime() - offset + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

  const inputClass = "w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm text-navy focus:ring-1 focus:ring-orange focus:border-orange focus:outline-none transition-colors placeholder-light";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className={`absolute inset-0 bg-navy/60 backdrop-blur-sm transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />

      <div className={`relative w-full max-w-lg bg-surface rounded-t-3xl shadow-2xl overflow-y-auto max-h-[90vh] transition-transform duration-300 ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-border rounded-full"></div>
        </div>

        <div className="px-6 pb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-serif text-2xl text-navy">New Adda</h2>
            <button onClick={handleClose} className="p-2 text-mid hover:text-navy hover:bg-bg rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Activity Type */}
            <div>
              <label className="block text-[10px] font-bold text-mid uppercase tracking-widest mb-2">Activity Type</label>
              <div className="grid grid-cols-3 gap-2">
                {ACTIVITY_TYPES.map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setActivityType(type)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                      activityType === type
                        ? 'bg-orange text-white border-orange shadow-sm'
                        : 'bg-bg text-mid border-border hover:border-orange/50'
                    }`}
                  >
                    <span>{ACTIVITY_EMOJIS[type]}</span>
                    <span>{type}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-[10px] font-bold text-mid uppercase tracking-widest mb-2">Title</label>
              <input
                className={inputClass}
                placeholder={`e.g. ${activityType === 'Coffee' ? 'Quick chai at TSC?' : activityType === 'Study' ? 'Group study for finals' : 'Anyone for ' + activityType.toLowerCase() + '?'}`}
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={80}
                required
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-[10px] font-bold text-mid uppercase tracking-widest mb-2">
                <MapPin size={10} className="inline mr-1" />Location
              </label>
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setUsePresetSpot(true)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${usePresetSpot ? 'bg-orange text-white border-orange' : 'bg-bg text-mid border-border'}`}
                >
                  Campus Spot
                </button>
                <button
                  type="button"
                  onClick={() => setUsePresetSpot(false)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${!usePresetSpot ? 'bg-orange text-white border-orange' : 'bg-bg text-mid border-border'}`}
                >
                  Custom
                </button>
              </div>
              {usePresetSpot ? (
                <div className="flex flex-wrap gap-2">
                  {CAMPUS_SPOTS.map(spot => (
                    <button
                      key={spot}
                      type="button"
                      onClick={() => setLocationText(spot)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                        locationText === spot
                          ? 'bg-navy text-white border-navy'
                          : 'bg-bg text-mid border-border hover:border-mid'
                      }`}
                    >
                      {spot}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  className={inputClass}
                  placeholder="Where exactly?"
                  value={locationText}
                  onChange={e => setLocationText(e.target.value)}
                  maxLength={60}
                />
              )}
            </div>

            {/* Date & Time */}
            <div>
              <label className="block text-[10px] font-bold text-mid uppercase tracking-widest mb-2">
                <Clock size={10} className="inline mr-1" />When
              </label>
              <input
                type="datetime-local"
                className={inputClass}
                value={dateTime}
                min={minDate}
                max={maxDate}
                onChange={e => setDateTime(e.target.value)}
                required
              />
              <p className="text-[10px] text-light mt-1">Hangout stays open for 2 hours from this time.</p>
            </div>

            {/* Max Participants */}
            <div>
              <label className="block text-[10px] font-bold text-mid uppercase tracking-widest mb-2">
                <Users size={10} className="inline mr-1" />Max People (including you)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={2}
                  max={12}
                  value={maxParticipants}
                  onChange={e => setMaxParticipants(Number(e.target.value))}
                  className="flex-1 accent-orange"
                />
                <span className="w-8 text-center font-bold text-navy text-lg">{maxParticipants}</span>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            <Button type="submit" fullWidth size="lg" loading={loading}>
              Post Adda 🚀
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateHangoutModal;
