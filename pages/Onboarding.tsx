import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/auth-context';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Check, Lock, ChevronRight } from 'lucide-react';
import Button from '../components/Button';
import { VIBES, ACTIVITIES, LOOKING_FOR, CAMPUS_SPOTS } from '../types';

const AVATAR_COLORS = [
  '#EF4444', // Red
  '#F97316', // Orange
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
  '#8B5CF6', // Violet
  '#EC4899', // Pink
];

const YEARS = ['1st', '2nd', '3rd', '4th', 'Masters', 'PhD'];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIMES = ['Morning', 'Afternoon', 'Evening', 'Night'];

const Onboarding = () => {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [animating, setAnimating] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    university: '',
    department: '',
    year: '',
    avatarColor: AVATAR_COLORS[1], // Default Orange
    avatarUrl: '', // New field for uploaded image URL
    bio: '',
    vibes: [] as string[],
    activities: [] as string[],
    lookingFor: [] as string[],
    socialStyle: 3,
    availability: [] as string[],
    spots: [] as string[],
  });

  useEffect(() => {
    if (profile) {
      setFormData(prev => ({
        ...prev,
        firstName: profile.name?.split(' ')[0] || prev.firstName,
        avatarUrl: profile.avatar_url || prev.avatarUrl,
        university: profile.location || prev.university,
        // Try to parse occupation back into department and year if possible
        department: profile.occupation?.split(' · ')[0] || prev.department,
        year: profile.occupation?.split(' · ')[1] || prev.year,
        bio: profile.bio || prev.bio,
      }));
    }
  }, [profile]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      alert('File is too large. Maximum size is 5MB.');
      return;
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${user?.id}/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      updateField('avatarUrl', data.publicUrl);
    } catch (error) {
      console.error('Error uploading avatar:', error);
      alert('Error uploading avatar');
    }
  };

  const handleNext = () => {
    setAnimating(true);
    setTimeout(() => {
      setStep(prev => prev + 1);
      setAnimating(false);
    }, 300);
  };

  const handleBack = () => {
    if (step > 1) {
      setAnimating(true);
      setTimeout(() => {
        setStep(prev => prev - 1);
        setAnimating(false);
      }, 300);
    }
  };

  const updateField = (field: keyof typeof formData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleSelection = (field: 'vibes' | 'activities' | 'lookingFor' | 'spots', value: string, max?: number) => {
    setFormData(prev => {
      const current = prev[field];
      if (current.includes(value)) {
        return { ...prev, [field]: current.filter(i => i !== value) };
      } else {
        if (max && current.length >= max) return prev;
        return { ...prev, [field]: [...current, value] };
      }
    });
  };

  const toggleAvailability = (day: string, time: string) => {
    const key = `${day}-${time}`;
    setFormData(prev => {
      const current = prev.availability;
      if (current.includes(key)) {
        return { ...prev, availability: current.filter(i => i !== key) };
      } else {
        return { ...prev, availability: [...current, key] };
      }
    });
  };

  const handleFinish = async () => {
    if (!user) return;
    setLoading(true);

    // Construct interests array with prefixes
    const interests = [
      ...formData.vibes.map(v => `vibe:${v}`),
      ...formData.activities.map(a => `activity:${a}`),
      ...formData.lookingFor.map(l => `looking:${l}`),
      ...formData.spots.map(s => `spot:${s}`),
      ...formData.availability.map(a => `avail:${a}`),
      `social:${formData.socialStyle}`,
      `color:${formData.avatarColor}`
    ];

    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: formData.firstName,
          occupation: `${formData.department} · ${formData.year}`,
          location: formData.university,
          bio: formData.bio,
          interests: interests,
          avatar_url: formData.avatarUrl || profile?.avatar_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;
      
      // Refresh profile in context
      await refreshProfile();
      
      // Navigate to home
      navigate('/', { replace: true });
    } catch (err) {
      console.error(err);
      alert('Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const progress = (step / 9) * 100;

  const renderStep = () => {
    switch (step) {
      case 1: // Identity
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center">
              <h1 className="font-serif text-3xl text-navy mb-2">Let's build your profile.</h1>
            </div>

            <div className="flex justify-center mb-2 relative">
              <div 
                className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-serif text-white shadow-lg transition-colors duration-300 overflow-hidden relative"
                style={{ backgroundColor: formData.avatarUrl ? 'transparent' : formData.avatarColor }}
              >
                {formData.avatarUrl ? (
                    <img src={formData.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                    formData.firstName ? formData.firstName.charAt(0).toUpperCase() : '?'
                )}
                
                {/* Upload Overlay */}
                <label className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                    <span className="text-xs text-white font-bold">Upload</span>
                    <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleAvatarUpload} 
                        className="hidden" 
                    />
                </label>
              </div>
            </div>
            
            {!formData.avatarUrl && (
              <div className="text-center mb-6">
                <span className="text-xs font-bold text-red-500 uppercase tracking-wider block mb-1">Photo Required</span>
                <span className="text-[10px] text-mid">Max size: 5MB</span>
              </div>
            )}
            {formData.avatarUrl && (
              <div className="text-center mb-6">
                <span className="text-xs font-bold text-green-500 uppercase tracking-wider block mb-1">Photo Uploaded</span>
                <span className="text-[10px] text-mid">Looking good!</span>
              </div>
            )}

            <div className="flex justify-center gap-3 mb-8">
              {/* Only show colors if no image is uploaded */}
              {!formData.avatarUrl && AVATAR_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => updateField('avatarColor', color)}
                  className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${formData.avatarColor === color ? 'ring-2 ring-offset-2 ring-orange scale-110' : ''}`}
                  style={{ backgroundColor: color }}
                />
              ))}
              {formData.avatarUrl && (
                  <button 
                    onClick={() => updateField('avatarUrl', '')}
                    className="text-xs text-red-500 underline"
                  >
                    Remove Image
                  </button>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-mid uppercase tracking-wider mb-1">First Name</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={e => updateField('firstName', e.target.value)}
                  className="w-full p-3 bg-surface border border-border rounded-xl focus:border-orange focus:outline-none transition-colors"
                  placeholder="e.g. Sarah"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-mid uppercase tracking-wider mb-1">University</label>
                <input
                  type="text"
                  value={formData.university}
                  onChange={e => updateField('university', e.target.value)}
                  className="w-full p-3 bg-surface border border-border rounded-xl focus:border-orange focus:outline-none transition-colors"
                  placeholder="e.g. Stanford"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-mid uppercase tracking-wider mb-1">Department</label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={e => updateField('department', e.target.value)}
                  className="w-full p-3 bg-surface border border-border rounded-xl focus:border-orange focus:outline-none transition-colors"
                  placeholder="e.g. Computer Science"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-mid uppercase tracking-wider mb-2">Year of Study</label>
                <div className="flex flex-wrap gap-2">
                  {YEARS.map(y => (
                    <button
                      key={y}
                      onClick={() => updateField('year', y)}
                      className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                        formData.year === y 
                          ? 'bg-orange text-white border-orange shadow-sm' 
                          : 'bg-surface text-mid border-border hover:border-mid'
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 2: // Bio
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center">
              <div className="text-4xl mb-4">✍️</div>
              <h1 className="font-serif text-3xl text-navy mb-2">Say something about yourself.</h1>
              <p className="text-mid text-sm">One or two sentences. This shows on your profile so people know who they're hanging out with.</p>
            </div>

            <div className="relative">
              <textarea
                value={formData.bio}
                onChange={e => {
                  if (e.target.value.length <= 120) updateField('bio', e.target.value);
                }}
                className="w-full p-4 bg-surface border border-border rounded-xl focus:border-orange focus:outline-none transition-colors min-h-[120px] resize-none text-lg"
                placeholder="Tell us a bit about you..."
              />
              <div className="absolute bottom-3 right-3 text-xs font-medium text-mid">
                {formData.bio.length}/120
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-mid uppercase tracking-wider">Need a starter?</p>
              {[
                "I'm the kind of person who...",
                "You'll usually find me...",
                "I joined ADDA because..."
              ].map(starter => (
                <button
                  key={starter}
                  onClick={() => updateField('bio', starter + ' ')}
                  className="block w-full text-left p-3 bg-surface border border-border rounded-xl text-sm text-navy hover:border-orange transition-colors"
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
        );

      case 3: // Vibe
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center">
              <div className="text-4xl mb-4">✨</div>
              <h1 className="font-serif text-3xl text-navy mb-2">What's your vibe?</h1>
              <p className="text-mid text-sm">Pick up to 3. These appear as badges on your profile.</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {VIBES.map(vibe => {
                const isSelected = formData.vibes.includes(vibe.label);
                return (
                  <button
                    key={vibe.label}
                    onClick={() => toggleSelection('vibes', vibe.label, 3)}
                    className={`
                      flex flex-col items-center justify-center p-3 rounded-[18px] border transition-all duration-200
                      ${isSelected 
                        ? 'bg-orange-dim border-orange text-orange shadow-sm' 
                        : 'bg-surface border-border text-mid hover:border-mid'}
                    `}
                  >
                    <span className="text-2xl mb-1">{vibe.emoji}</span>
                    <span className="text-xs font-bold text-center leading-tight">{vibe.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 4: // Activities
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center">
              <div className="text-4xl mb-4">🎯</div>
              <h1 className="font-serif text-3xl text-navy mb-2">What do you like doing?</h1>
              <p className="text-mid text-sm">This helps us show you relevant addas.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {ACTIVITIES.map(activity => {
                const isSelected = formData.activities.includes(activity.label);
                return (
                  <button
                    key={activity.label}
                    onClick={() => toggleSelection('activities', activity.label)}
                    className={`
                      flex items-center p-3 rounded-[18px] border text-left transition-all duration-200
                      ${isSelected 
                        ? 'bg-orange-dim border-orange text-orange shadow-sm' 
                        : 'bg-surface border-border text-mid hover:border-mid'}
                    `}
                  >
                    <span className="text-2xl mr-3">{activity.emoji}</span>
                    <div>
                      <div className={`text-sm font-bold ${isSelected ? 'text-orange' : 'text-navy'}`}>{activity.label}</div>
                      <div className={`text-[10px] ${isSelected ? 'text-orange/80' : 'text-light'}`}>{activity.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 5: // Looking For
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center">
              <div className="text-4xl mb-4">🔍</div>
              <h1 className="font-serif text-3xl text-navy mb-2">What brings you here?</h1>
              <p className="text-mid text-sm">Be honest — this helps people know if you're the right fit.</p>
            </div>

            <div className="space-y-3">
              {LOOKING_FOR.map(item => {
                const isSelected = formData.lookingFor.includes(item.label);
                return (
                  <button
                    key={item.label}
                    onClick={() => toggleSelection('lookingFor', item.label)}
                    className={`
                      w-full flex items-center p-4 rounded-[18px] border text-left transition-all duration-200
                      ${isSelected 
                        ? 'bg-orange-dim border-orange text-orange shadow-sm' 
                        : 'bg-surface border-border text-mid hover:border-mid'}
                    `}
                  >
                    <span className="text-2xl mr-4">{item.emoji}</span>
                    <div>
                      <div className={`text-sm font-bold ${isSelected ? 'text-orange' : 'text-navy'}`}>{item.label}</div>
                      <div className={`text-xs ${isSelected ? 'text-orange/80' : 'text-light'}`}>{item.desc}</div>
                    </div>
                    {isSelected && <Check className="ml-auto" size={20} />}
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 6: // Social Style
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center">
              <div className="text-4xl mb-4">🔋</div>
              <h1 className="font-serif text-3xl text-navy mb-2">How social are you?</h1>
              <p className="text-mid text-sm">No right answer — just helps others know what to expect.</p>
            </div>

            <div className="px-4">
              <div className="flex justify-between text-xs font-bold text-mid uppercase tracking-wider mb-6">
                <span>Introverted</span>
                <span>Extroverted</span>
              </div>
              
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={formData.socialStyle}
                onChange={e => updateField('socialStyle', parseInt(e.target.value))}
                className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-orange mb-8"
              />

              <div className="text-center p-4 bg-surface border border-border rounded-[18px]">
                <p className="text-lg font-serif text-navy">
                  {formData.socialStyle === 1 && "You prefer small, quiet one-on-ones"}
                  {formData.socialStyle === 2 && "You enjoy close-knit groups of 2–3"}
                  {formData.socialStyle === 3 && "Comfortable in most situations"}
                  {formData.socialStyle === 4 && "You thrive in social settings"}
                  {formData.socialStyle === 5 && "The more people, the better"}
                </p>
              </div>
            </div>
          </div>
        );

      case 7: // Availability
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center">
              <div className="text-4xl mb-4">📅</div>
              <h1 className="font-serif text-3xl text-navy mb-2">When do you usually hang out?</h1>
              <p className="text-mid text-sm">Others can see this so they know when to invite you.</p>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[300px]">
                <div className="grid grid-cols-[auto_repeat(4,1fr)] gap-2 mb-2">
                  <div className="w-8"></div>
                  {TIMES.map(t => (
                    <div key={t} className="text-[10px] font-bold text-mid text-center uppercase tracking-wider truncate">{t}</div>
                  ))}
                </div>
                
                {DAYS.map(day => (
                  <div key={day} className="grid grid-cols-[auto_repeat(4,1fr)] gap-2 mb-2 items-center">
                    <div className="w-8 text-xs font-bold text-mid">{day}</div>
                    {TIMES.map(time => {
                      const isSelected = formData.availability.includes(`${day}-${time}`);
                      return (
                        <button
                          key={`${day}-${time}`}
                          onClick={() => toggleAvailability(day, time)}
                          className={`
                            h-10 rounded-lg border transition-all duration-200
                            ${isSelected 
                              ? 'bg-orange border-orange shadow-sm' 
                              : 'bg-surface border-border hover:border-mid'}
                          `}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 8: // Spots
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center">
              <div className="text-4xl mb-4">📍</div>
              <h1 className="font-serif text-3xl text-navy mb-2">Where do you like to hang?</h1>
              <p className="text-mid text-sm">Pick your usual spots. These show on your profile.</p>
            </div>

            <div className="flex flex-wrap gap-2 justify-center">
              {CAMPUS_SPOTS.map(spot => {
                const isSelected = formData.spots.includes(spot);
                return (
                  <button
                    key={spot}
                    onClick={() => toggleSelection('spots', spot)}
                    className={`
                      px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200
                      ${isSelected 
                        ? 'bg-orange text-white border-orange shadow-sm' 
                        : 'bg-surface text-mid border-border hover:border-mid'}
                    `}
                  >
                    {spot}
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 9: // Finish
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center">
              <div className="text-4xl mb-4">🎉</div>
              <h1 className="font-serif text-3xl text-navy mb-2">Your campus is already here.</h1>
            </div>

            <div className="bg-surface border border-border rounded-[18px] p-6 space-y-6">
              {/* Social Proof */}
              <div className="flex flex-col items-center gap-3 pb-6 border-b border-border">
                <div className="flex -space-x-3">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="w-10 h-10 rounded-full border-2 border-surface bg-bg flex items-center justify-center text-xs font-bold text-mid">
                      {String.fromCharCode(64+i)}
                    </div>
                  ))}
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-navy">47 students from your campus are on ADDA</p>
                  <p className="text-xs text-mid">14 from your department</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  <Lock size={12} /> Campus verified only
                </div>
              </div>

              {/* Profile Preview */}
              <div className="text-center">
                <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center text-3xl font-serif text-white shadow-lg mb-3 overflow-hidden" style={{ backgroundColor: formData.avatarUrl ? 'transparent' : formData.avatarColor }}>
                  {formData.avatarUrl ? (
                      <img src={formData.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                      formData.firstName.charAt(0)
                  )}
                </div>
                <h3 className="font-serif text-xl text-navy">{formData.firstName}</h3>
                <p className="text-xs text-mid uppercase tracking-wider mb-2">{formData.department} · {formData.year}</p>
                <p className="text-sm text-mid italic mb-4 line-clamp-2">"{formData.bio}"</p>
                
                <div className="flex justify-center gap-2 mb-4">
                  {formData.vibes.map(v => (
                    <span key={v} className="px-2 py-1 bg-orange-dim text-orange rounded-md text-[10px] font-bold uppercase tracking-wider border border-orange/20">
                      {v}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center border-t border-border pt-4">
                  <div>
                    <div className="font-serif text-lg text-navy">0</div>
                    <div className="text-[10px] text-mid uppercase tracking-wider">Addas</div>
                  </div>
                  <div>
                    <div className="font-serif text-lg text-orange">0</div>
                    <div className="text-[10px] text-mid uppercase tracking-wider">Streak</div>
                  </div>
                  <div>
                    <div className="font-serif text-lg text-navy">0</div>
                    <div className="text-[10px] text-mid uppercase tracking-wider">Hosted</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center">
              <p className="text-xs text-mid mb-4">This is how you'll appear to others. You can edit anytime.</p>
              <Button onClick={handleFinish} fullWidth size="lg" loading={loading}>
                Open adda <ChevronRight size={18} className="ml-1" />
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Progress Bar */}
      <div className="h-1 bg-border w-full fixed top-0 left-0 z-50">
        <div 
          className="h-full bg-orange transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col max-w-md mx-auto w-full p-6 pt-12">
        {step > 1 && step < 9 && (
          <button 
            onClick={handleBack}
            className="self-start p-2 -ml-2 text-mid hover:text-navy hover:bg-surface rounded-full transition-colors mb-4"
          >
            <ArrowLeft size={24} />
          </button>
        )}

        <div className={`flex-1 ${animating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'} transition-all duration-300`}>
          {renderStep()}
        </div>

        {step < 9 && (
          <div className="mt-8 pt-6 border-t border-border">
            <Button 
              onClick={handleNext} 
              fullWidth 
              size="lg"
              disabled={
                (step === 1 && (!formData.firstName || !formData.university || !formData.department || !formData.year)) ||
                (step === 2 && !formData.bio) ||
                (step === 3 && formData.vibes.length === 0) ||
                (step === 4 && formData.activities.length === 0) ||
                (step === 5 && formData.lookingFor.length === 0) ||
                (step === 7 && formData.availability.length === 0) ||
                (step === 8 && formData.spots.length === 0)
              }
            >
              Next Step
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Onboarding;
