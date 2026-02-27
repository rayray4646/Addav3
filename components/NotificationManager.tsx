import React, { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/auth-context';
import { Hangout, Notification as NotificationType } from '../types';

const NotificationManager = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Request permission on mount
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const sendNotification = (title: string, body: string, url?: string) => {
      if (Notification.permission === 'granted') {
        const notif = new Notification(title, {
          body,
          icon: '/pwa-192x192.png', // Assuming standard PWA icon path or similar
          badge: '/pwa-192x192.png',
        });
        
        if (url) {
            notif.onclick = () => {
                window.focus();
                window.location.hash = url; // Using hash router
                notif.close();
            };
        }
      }
    };

    const handleNewHangout = async (payload: any) => {
      const newHangout = payload.new as Hangout;
      // Don't notify about my own hangouts
      if (newHangout.creator_id === user.id) return;

      sendNotification(
        'New Adda Created',
        `${newHangout.title} (${newHangout.activity_type})`,
        `#/hangout/${newHangout.id}`
      );
    };

    const handleNewNotification = async (payload: any) => {
        const notification = payload.new as NotificationType;
        sendNotification(
            notification.title,
            notification.message,
            `#${notification.link || '/notifications'}`
        );
    };

    const channel = supabase.channel('global-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'hangouts' },
        handleNewHangout
      )
      .on(
        'postgres_changes',
        { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
        },
        handleNewNotification
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return null; // This component doesn't render anything
};

export default NotificationManager;
