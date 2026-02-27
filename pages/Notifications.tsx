import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/auth-context';
import { supabase } from '../lib/supabase';
import { Notification } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { Bell, Check, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const NotificationsPage = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    fetchNotifications();

    // Subscribe to new notifications
    const channel = supabase
      .channel('notifications-page')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchNotifications = async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setNotifications(data as Notification[]);
    }
    setLoading(false);
  };

  const markAsRead = async (id: string) => {
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id);
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user?.id)
      .eq('read', false);
  };

  const deleteNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setNotifications(prev => prev.filter(n => n.id !== id));
    
    await supabase
      .from('notifications')
      .delete()
      .eq('id', id);
  };

  const handleClick = async (notification: Notification) => {
    if (!notification.read) {
        await markAsRead(notification.id);
    }
    if (notification.link) {
        navigate(notification.link);
    }
  };

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
            <h1 className="font-serif text-3xl text-navy">Notifications</h1>
            {notifications.some(n => !n.read) && (
                <button 
                    onClick={markAllAsRead}
                    className="text-xs font-bold text-orange uppercase tracking-wider hover:text-orange-mid transition-colors"
                >
                    Mark all read
                </button>
            )}
        </div>

        {loading ? (
            <div className="text-center py-10 text-mid">Loading...</div>
        ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 bg-surface border border-border rounded-full flex items-center justify-center mb-4">
                    <Bell className="text-mid" size={24} />
                </div>
                <h3 className="text-lg font-serif text-navy mb-1">All caught up</h3>
                <p className="text-sm text-mid">You have no new notifications.</p>
            </div>
        ) : (
            <div className="space-y-3">
                {notifications.map((notification) => (
                    <div 
                        key={notification.id}
                        onClick={() => handleClick(notification)}
                        className={`
                            relative p-4 rounded-xl border transition-all cursor-pointer group
                            ${notification.read 
                                ? 'bg-bg border-transparent hover:bg-surface hover:border-border' 
                                : 'bg-surface border-orange/20 shadow-sm'}
                        `}
                    >
                        {!notification.read && (
                            <div className="absolute top-4 right-4 w-2 h-2 bg-orange rounded-full"></div>
                        )}
                        
                        <div className="pr-6">
                            <h3 className={`text-sm font-bold mb-1 ${notification.read ? 'text-mid' : 'text-navy'}`}>
                                {notification.title}
                            </h3>
                            <p className={`text-sm mb-2 leading-relaxed ${notification.read ? 'text-light' : 'text-mid'}`}>
                                {notification.message}
                            </p>
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-light uppercase tracking-wider">
                                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                </span>
                                <button 
                                    onClick={(e) => deleteNotification(e, notification.id)}
                                    className="p-1.5 text-light hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </Layout>
  );
};

export default NotificationsPage;
