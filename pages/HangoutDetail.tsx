import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Hangout, Profile, Participant, ACTIVITY_EMOJIS } from '../types';
import Chat from '../components/Chat';
import Button from '../components/Button';
import { useAuth } from '../contexts/auth-context';
import { ArrowLeft, Clock, MapPin, Users, Check, X, ShieldAlert, Lock, MessageCircle, Trash2, Flag } from 'lucide-react';
import ReportModal from '../components/ReportModal';
import { format } from 'date-fns';

const HangoutDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [hangout, setHangout] = useState<Hangout | null>(null);
  const [participants, setParticipants] = useState<(Participant & { user: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [view, setView] = useState<'chat' | 'info'>('info');
  const [isEndingSoon, setIsEndingSoon] = useState(false);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    fetchData();

    // Subscribe to participant changes
    const channel = supabase
      .channel(`participants:${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'participants',
          filter: `hangout_id=eq.${id}`,
        },
        () => {
          fetchData(); // Refresh all data when participants change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, user]);

  useEffect(() => {
    if (!hangout) return;
    
    const checkTime = () => {
        const expires = new Date(hangout.expires_at).getTime();
        const now = new Date().getTime();
        const diff = expires - now;
        // 10 minutes = 600,000 ms
        setIsEndingSoon(diff > 0 && diff <= 600000);
    };
    
    checkTime();
    const interval = setInterval(checkTime, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [hangout]);

  const fetchData = async () => {
      if (!id) return;
      // Fetch hangout details
      const { data: hData, error: hError } = await supabase
        .from('hangouts')
        .select('*, creator:users(id, name, avatar_url, occupation)')
        .eq('id', id)
        .single();

      if (hError || !hData) {
        navigate('/'); 
        return;
      }
      setHangout(hData);

      // Fetch participants with profiles
      const { data: pData } = await supabase
        .from('participants')
        .select('*, user:users(*)')
        .eq('hangout_id', id);

      if (pData) {
        setParticipants(pData as any);
        
        // Determine my status
        const myRecord = pData.find((p: any) => p.user_id === user?.id);
        
        // Default to chat if approved, otherwise info
        if (myRecord?.status === 'approved') {
             setView('chat');
        } else {
             setView('info');
        }
      }
      setLoading(false);
  };

  const handleJoinRequest = async () => {
      if (!user || !hangout) return;
      setJoining(true);
      try {
          const { error } = await supabase.rpc('join_hangout', {
            hangout_id_input: hangout.id
          });
          if (error) throw error;
          await fetchData(); // Refresh state
      } catch (err: any) {
          alert(err.message || "Could not join");
      } finally {
          setJoining(false);
      }
  };

  const handleStatusChange = async (participantId: string, newStatus: 'approved' | 'rejected') => {
    try {
        const { error } = await supabase
            .from('participants')
            .update({ status: newStatus })
            .eq('id', participantId);
        
        if (error) throw error;
        // Refresh data
        fetchData();
    } catch (err) {
        console.error(err);
        alert("Failed to update status");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this hangout? This action cannot be undone.")) return;
    try {
        const { error } = await supabase.from('hangouts').delete().eq('id', id);
        if (error) throw error;
        navigate('/');
    } catch (err: any) {
        alert("Failed to delete: " + err.message);
    }
  };

  if (loading || !hangout || !profile) return <div className="p-4 flex items-center justify-center h-full text-mid">Loading...</div>;

  const isHost = hangout.creator_id === user?.id;
  const isAdmin = profile.role === 'admin';
  const myParticipantRecord = participants.find(p => p.user_id === user?.id);
  const isMember = !!myParticipantRecord;
  const isApproved = myParticipantRecord?.status === 'approved';

  const approvedParticipants = participants.filter(p => p.status === 'approved');
  const pendingParticipants = participants.filter(p => p.status === 'pending');
  
  const isFull = approvedParticipants.length >= hangout.max_participants;

  return (
    <>
    <div className="flex flex-col h-full bg-bg w-full overflow-hidden font-sans">
      {/* Header */}
      <div className="bg-surface border-b border-border p-4 flex items-center justify-between z-10 shadow-sm shrink-0">
        <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 text-mid hover:text-navy rounded-full hover:bg-bg transition-colors">
                <ArrowLeft size={20} />
            </button>
            <div className="flex flex-col">
                <h1 className="font-serif text-navy text-xl leading-none mb-1">{hangout.title}</h1>
                <div className="flex items-center gap-2 text-[10px] text-mid font-bold uppercase tracking-wider">
                    <span>{ACTIVITY_EMOJIS[hangout.activity_type]} {hangout.activity_type}</span>
                    <span>•</span>
                    <span>{format(new Date(hangout.start_time), "h:mm a")}</span>
                </div>
            </div>
        </div>

        <div className="flex gap-3">
            {!isHost && isMember && (
                <button
                    onClick={() => setShowReport(true)}
                    className="p-2 text-light hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                    title="Report this hangout"
                >
                    <Flag size={18} />
                </button>
            )}
            {isAdmin && (
                <button 
                    onClick={handleDelete}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                    title="Admin Delete"
                >
                    <Trash2 size={20} />
                </button>
            )}
            
            {/* Mobile Toggle (Hidden on Desktop) */}
            <button 
                onClick={() => setView(view === 'chat' ? 'info' : 'chat')}
                className={`md:hidden p-2 rounded-full transition-colors ${view === 'info' ? 'bg-orange-dim text-orange' : 'text-mid hover:bg-bg'}`}
                disabled={!isApproved}
            >
                {view === 'chat' ? <Users size={20} /> : <MessageCircle size={20} />}
            </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Info Section (Left on Desktop, Toggleable on Mobile) */}
        <div className={`
            flex-1 md:flex-none md:w-[400px] lg:w-[450px] border-r border-border bg-bg overflow-y-auto no-scrollbar
            ${view === 'info' ? 'flex' : 'hidden md:flex'}
            flex-col p-6 space-y-8
        `}>
            {/* Ending Soon Banner */}
            {isEndingSoon && (
                <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl flex items-center gap-3 shadow-sm">
                    <div className="p-1.5 bg-red-100 rounded-full">
                        <Clock size={16} className="animate-pulse" />
                    </div>
                    <div className="flex-1">
                        <p className="text-xs font-bold uppercase tracking-wider">Ending Soon</p>
                        <p className="text-sm">This adda closes in less than 10 minutes.</p>
                    </div>
                </div>
            )}

            {/* Main Info Card */}
            <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-full bg-orange-dim flex items-center justify-center text-2xl">
                        {ACTIVITY_EMOJIS[hangout.activity_type]}
                    </div>
                    <div>
                        <h3 className="font-serif text-2xl text-navy leading-tight">{hangout.title}</h3>
                        <p className="text-sm text-mid">{hangout.location_text}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-bg rounded-lg text-mid">
                            <Clock size={18} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-mid uppercase tracking-wider">Time</p>
                            <p className="text-sm font-bold text-navy">{format(new Date(hangout.start_time), "h:mm a")}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-bg rounded-lg text-mid">
                            <MapPin size={18} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-mid uppercase tracking-wider">Location</p>
                            <p className="text-sm font-bold text-navy truncate">{hangout.location_text}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Status Banner */}
            {isMember && !isApproved && (
                <div className="bg-orange-dim border border-orange/20 p-4 rounded-xl">
                    <div className="flex">
                        <ShieldAlert className="h-5 w-5 text-orange shrink-0" />
                        <div className="ml-3">
                            <h3 className="text-sm font-bold text-navy">
                                {myParticipantRecord?.status === 'rejected' ? 'Request Rejected' : 'Waiting for Approval'}
                            </h3>
                            <p className="text-xs text-mid mt-1 leading-relaxed">
                                {myParticipantRecord?.status === 'rejected' 
                                    ? 'The host has declined your request.' 
                                    : 'You can chat once the host approves you.'}
                            </p>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Not Joined Banner */}
            {!isMember && (
                <div className="bg-surface p-6 rounded-2xl border border-border text-center shadow-sm">
                    <div className="w-12 h-12 bg-bg rounded-full flex items-center justify-center mx-auto mb-3">
                        <Lock className="text-mid" size={20} />
                    </div>
                    <h3 className="text-sm font-bold text-navy mb-1">Private Group</h3>
                    <p className="text-xs text-mid">Request to join this ADDA to see the chat.</p>
                    <div className="mt-6">
                        <Button 
                            fullWidth 
                            size="lg" 
                            onClick={handleJoinRequest} 
                            loading={joining}
                            disabled={isFull}
                        >
                            {isFull ? 'Hangout Full' : 'Request to Join'}
                        </Button>
                    </div>
                </div>
            )}

            {/* Host Controls */}
            {isHost && pendingParticipants.length > 0 && (
                <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm">
                    <h3 className="font-serif text-lg text-navy mb-3">Pending Requests</h3>
                    <div className="space-y-3">
                        {pendingParticipants.map(p => (
                            <div key={p.id} className="flex items-center justify-between bg-bg p-3 rounded-xl border border-border">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-surface border border-border overflow-hidden">
                                        {p.user.avatar_url ? (
                                            <img src={p.user.avatar_url} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-mid font-bold">{p.user.name.charAt(0)}</div>
                                        )}
                                    </div>
                                    <button onClick={() => navigate(`/user/${p.user_id}`)} className="text-left hover:opacity-80 transition-opacity">
                                        <p className="text-sm font-bold text-navy hover:text-orange transition-colors">{p.user.name}</p>
                                        <p className="text-[10px] text-mid uppercase tracking-wider">{p.user.occupation || 'Student'}</p>
                                    </button>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleStatusChange(p.id, 'rejected')}
                                        className="p-2 bg-surface border border-border text-mid hover:text-red-500 rounded-full transition-colors"
                                    >
                                        <X size={16} />
                                    </button>
                                    <button 
                                        onClick={() => handleStatusChange(p.id, 'approved')}
                                        className="p-2 bg-navy text-white rounded-full hover:bg-orange transition-colors shadow-sm"
                                    >
                                        <Check size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Participants Grid */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-serif text-xl text-navy">Who's Going</h3>
                    <span className="text-xs font-bold text-mid bg-surface px-2 py-1 rounded-md border border-border">
                        {approvedParticipants.length}/{hangout.max_participants}
                    </span>
                </div>
                
                <div className="grid grid-cols-4 gap-4">
                    {approvedParticipants.map(p => (
                        <button key={p.id} onClick={() => navigate(`/user/${p.user_id}`)} className="flex flex-col items-center group">
                            <div className="w-14 h-14 rounded-full bg-surface border-2 border-border p-0.5 mb-2 transition-transform group-hover:scale-105 group-hover:border-orange">
                                <div className="w-full h-full rounded-full overflow-hidden bg-bg">
                                    {p.user.avatar_url ? (
                                        <img src={p.user.avatar_url} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-mid font-bold">{p.user.name.charAt(0)}</div>
                                    )}
                                </div>
                            </div>
                            <span className="text-xs font-medium text-navy truncate w-full text-center">{p.user.name.split(' ')[0]}</span>
                        </button>
                    ))}
                    
                    {/* Empty Slots */}
                    {Array.from({ length: Math.max(0, hangout.max_participants - approvedParticipants.length) }).map((_, i) => (
                        <div key={`empty-${i}`} className="flex flex-col items-center opacity-40">
                            <div className="w-14 h-14 rounded-full border-2 border-dashed border-mid bg-transparent mb-2"></div>
                            <span className="text-[10px] text-mid">Open</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* Chat Section (Right on Desktop, Toggleable on Mobile) */}
        <div className={`
            flex-1 bg-surface relative
            ${view === 'chat' ? 'flex' : 'hidden md:flex'}
            flex-col
        `}>
            {isApproved ? (
                <Chat hangoutId={hangout.id} currentUser={profile} />
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-bg/50">
                    <div className="w-20 h-20 bg-surface border border-border rounded-full flex items-center justify-center mb-6 shadow-sm">
                        <MessageCircle size={32} className="text-light" />
                    </div>
                    <h3 className="text-xl font-serif text-navy mb-2">Chat is Locked</h3>
                    <p className="text-mid max-w-xs">
                        {isMember 
                            ? "You'll be able to chat once the host approves your request." 
                            : "Join this ADDA to start chatting with other participants."}
                    </p>
                </div>
            )}
        </div>
      </div>
    </div>
      {showReport && hangout && (
        <ReportModal
          targetHangoutId={hangout.id}
          targetHangoutTitle={hangout.title}
          onClose={() => setShowReport(false)}
        />
      )}
    </>
  );
};

export default HangoutDetail;
