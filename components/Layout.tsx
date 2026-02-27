import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Home, MessageSquare, User, Plus, Bell, Flame, Moon, Sun } from 'lucide-react';
import InstallPwaPrompt from './InstallPwaPrompt';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/auth-context';
import { useTheme } from '../contexts/theme-context';
import { getRepTier } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  onOpenCreate?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, onOpenCreate }) => {
  const location = useLocation();
  const currentPath = location.pathname;
  const { user, profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);

  // Real streak & tier from profile (updated by DB triggers)
  const streakDays = profile?.streak_days ?? 0;
  const addaCount = profile?.adda_count ?? 0;
  const tier = getRepTier(addaCount);

  useEffect(() => {
    if (!user) return;

    const fetchUnread = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);
      setUnreadCount(count || 0);
    };

    fetchUnread();

    const channel = supabase
      .channel(`layout-notif-${user.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, () => { fetchUnread(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const isActive = (path: string) => currentPath === path;

  return (
    <div className="h-screen bg-bg text-navy w-full overflow-hidden flex flex-col relative font-sans transition-colors duration-200">
      <InstallPwaPrompt />

      {/* Desktop Header */}
      <header className="hidden md:flex items-center justify-between px-8 py-4 bg-surface border-b border-border z-30 shrink-0 transition-colors duration-200">
        <div className="flex items-center gap-12">
          <Link to="/" className="text-3xl font-serif font-medium text-orange tracking-tight">
            adda
          </Link>

          <div className="flex items-center gap-1 bg-bg p-1 rounded-full border border-border">
            <Link to="/" className={`px-5 py-1.5 rounded-full text-sm font-bold transition-all ${isActive('/') ? 'bg-surface text-orange shadow-sm' : 'text-mid hover:text-navy'}`}>
              Feed
            </Link>
            <Link to="/chats" className={`px-5 py-1.5 rounded-full text-sm font-bold transition-all ${isActive('/chats') ? 'bg-surface text-orange shadow-sm' : 'text-mid hover:text-navy'}`}>
              Chats
            </Link>
            <Link to="/notifications" className={`px-5 py-1.5 rounded-full text-sm font-bold transition-all relative ${isActive('/notifications') ? 'bg-surface text-orange shadow-sm' : 'text-mid hover:text-navy'}`}>
              Alerts
              {unreadCount > 0 && <span className="absolute top-1 right-1 inline-block w-2 h-2 bg-orange rounded-full"></span>}
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {onOpenCreate && (
            <button
              onClick={onOpenCreate}
              className="px-6 py-2 bg-orange text-white rounded-full shadow-md font-bold flex items-center gap-2 hover:bg-orange/90 transition-all hover:scale-105 active:scale-95"
            >
              <Plus size={18} /> Create Adda
            </button>
          )}

          <div className="h-8 w-[1px] bg-border"></div>

          <button
            onClick={toggleTheme}
            className="p-2 text-mid hover:text-navy hover:bg-bg rounded-full transition-colors"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <Link to="/profile" className={`flex items-center gap-3 pl-1 pr-4 py-1 rounded-full border transition-all ${isActive('/profile') ? 'border-orange bg-orange-dim/50' : 'border-border hover:border-mid/50'}`}>
            <div className="w-8 h-8 rounded-full bg-bg border border-border overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} className="w-full h-full object-cover" alt="" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-mid">
                  {profile?.name?.charAt(0) || <User size={14} />}
                </div>
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-navy leading-none">
                {profile?.name?.split(' ')[0] || 'Profile'}
              </span>
              <span className={`text-[10px] font-medium ${tier.color}`}>{tier.emoji} {tier.name}</span>
            </div>
          </Link>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="md:hidden bg-surface border-b border-border px-5 py-3 sticky top-0 z-20 flex items-center justify-between shrink-0 transition-colors duration-200">
        <Link to="/" className="text-3xl font-serif font-medium text-orange tracking-tight">
          adda
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="p-1.5 text-navy hover:bg-bg rounded-full transition-colors"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          {/* Real Streak Pill — only show when user has a streak */}
          {streakDays > 0 && (
            <div className="flex items-center gap-1.5 bg-orange-dim px-2.5 py-1 rounded-full">
              <Flame size={12} className="text-orange" fill="currentColor" />
              <span className="text-xs font-bold text-orange">{streakDays}d</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Desktop Left Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 border-r border-border bg-surface p-6 shrink-0 transition-colors duration-200">
          <div className="mb-6">
            <h3 className="text-[10px] font-bold text-mid uppercase tracking-widest mb-3">Activity Filters</h3>
            <div className="flex flex-wrap gap-2">
              {['#StudyGroup', '#QuickCoffee', '#GymBuddy', '#LateNight', '#FoodRun'].map(tag => (
                <span key={tag} className="px-3 py-1.5 bg-bg border border-border rounded-full text-xs font-medium text-navy hover:border-orange cursor-pointer transition-colors">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Real Streak Card */}
          <div className="mt-auto bg-orange-dim p-4 rounded-2xl border border-orange/10">
            <div className="flex items-center gap-2 text-orange mb-1">
              <Flame size={18} fill="currentColor" />
              <span className="text-sm font-bold">
                {streakDays > 0 ? `${streakDays}-Day Streak!` : 'No streak yet'}
              </span>
            </div>
            <p className="text-xs text-orange/80 leading-relaxed">
              {streakDays > 0
                ? 'Join one adda every 7 days to keep it going!'
                : 'Join your first ADDA to start a streak!'}
            </p>
            {addaCount > 0 && (
              <p className="text-[10px] text-orange/60 mt-1">{addaCount} total addas • {tier.emoji} {tier.name}</p>
            )}
          </div>
        </aside>

        {/* Main Scrollable Area */}
        <main className="flex-1 overflow-y-auto no-scrollbar pb-24 md:pb-8 bg-bg relative">
          <div className="max-w-3xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>

      {/* Bottom Navigation (Mobile Only) */}
      <nav className="md:hidden absolute bottom-0 left-0 right-0 bg-surface border-t border-border px-6 py-2 pb-6 z-30 flex justify-between items-end h-[84px]">

        <Link to="/" className="flex flex-col items-center gap-1 w-12">
          <Home size={24} className={isActive('/') ? 'text-orange' : 'text-light'} strokeWidth={isActive('/') ? 2.5 : 2} />
          <span className={`text-[10px] font-medium ${isActive('/') ? 'text-orange' : 'text-light'}`}>Feed</span>
        </Link>

        <Link to="/chats" className="flex flex-col items-center gap-1 w-12 relative">
          <MessageSquare size={24} className={isActive('/chats') ? 'text-orange' : 'text-light'} strokeWidth={isActive('/chats') ? 2.5 : 2} />
          <span className={`text-[10px] font-medium ${isActive('/chats') ? 'text-orange' : 'text-light'}`}>Chats</span>
        </Link>

        {/* Floating Action Button */}
        <div className="absolute left-1/2 -translate-x-1/2 -top-5">
          <button
            onClick={onOpenCreate}
            className="w-14 h-14 bg-orange text-white rounded-full shadow-fab flex items-center justify-center transition-transform hover:scale-105 active:scale-95 focus:outline-none"
          >
            <Plus size={28} />
          </button>
        </div>

        <Link to="/notifications" className="flex flex-col items-center gap-1 w-12 relative">
          <div className="relative">
            <Bell size={24} className={isActive('/notifications') ? 'text-orange' : 'text-light'} strokeWidth={isActive('/notifications') ? 2.5 : 2} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-2 w-2 bg-orange rounded-full border border-white"></span>
            )}
          </div>
          <span className={`text-[10px] font-medium ${isActive('/notifications') ? 'text-orange' : 'text-light'}`}>Alerts</span>
        </Link>

        <Link to="/profile" className="flex flex-col items-center gap-1 w-12">
          <User size={24} className={isActive('/profile') ? 'text-orange' : 'text-light'} strokeWidth={isActive('/profile') ? 2.5 : 2} />
          <span className={`text-[10px] font-medium ${isActive('/profile') ? 'text-orange' : 'text-light'}`}>Profile</span>
        </Link>
      </nav>
    </div>
  );
};

export default Layout;
