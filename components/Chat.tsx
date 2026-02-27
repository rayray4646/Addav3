import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Message, Profile } from '../types';
import { Send, ArrowLeft, Image as ImageIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface ChatProps {
  hangoutId: string;
  currentUser: Profile;
}

const Chat: React.FC<ChatProps> = ({ hangoutId, currentUser }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const userCache: Record<string, any> = {};

    // Fetch initial messages
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*, user:users(id, name, avatar_url)')
        .eq('hangout_id', hangoutId)
        .order('created_at', { ascending: true });
      
      if (!error && data) {
        setMessages(data as any);
        // Seed cache
        data.forEach((m: any) => {
            if (m.user) userCache[m.user.id] = m.user;
        });
      }
    };

    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`chat:${hangoutId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `hangout_id=eq.${hangoutId}`,
        },
        async (payload) => {
          const userId = payload.new.user_id;
          let userData = userCache[userId];

          if (!userData) {
            // Fetch user details for the new message if not in cache
            const { data } = await supabase
                .from('users')
                .select('id, name, avatar_url')
                .eq('id', userId)
                .single();
            userData = data;
            if (data) userCache[userId] = data;
          }

          const newMsg = { ...payload.new, user: userData } as Message;
          setMessages((prev) => {
            // Prevent duplicates (Supabase real-time can sometimes double-fire)
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hangoutId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const content = newMessage.trim();
    setNewMessage('');

    const { error } = await supabase
      .from('messages')
      .insert({
        hangout_id: hangoutId,
        user_id: currentUser.id,
        content: content,
        message_type: 'text'
      });

    if (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${hangoutId}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    setUploading(true);

    try {
        const { error: uploadError } = await supabase.storage
            .from('chat-images')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('chat-images').getPublicUrl(filePath);
        
        // Send message with image
        const { error: msgError } = await supabase
            .from('messages')
            .insert({
                hangout_id: hangoutId,
                user_id: currentUser.id,
                content: 'Sent an image',
                message_type: 'image',
                media_url: data.publicUrl
            });

        if (msgError) throw msgError;

    } catch (error: any) {
        console.error('Error uploading image:', error);
        alert('Failed to upload image');
    } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg font-sans">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isMe = msg.user_id === currentUser.id;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex flex-col max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
                {!isMe && (
                   <span className="text-[10px] font-bold text-mid ml-1 mb-1 uppercase tracking-wide">{msg.user?.name.split(' ')[0]}</span>
                )}
                
                {msg.message_type === 'image' && msg.media_url ? (
                    <div className={`rounded-2xl overflow-hidden shadow-sm mb-1 border border-border ${isMe ? 'rounded-br-none' : 'rounded-bl-none'}`}>
                        <img src={msg.media_url} alt="Shared" className="max-w-full h-auto max-h-60 object-cover" />
                    </div>
                ) : (
                    <div
                    className={`px-4 py-2 rounded-2xl text-sm leading-relaxed shadow-sm ${
                        isMe
                        ? 'bg-orange text-white rounded-br-none'
                        : 'bg-surface border border-border text-navy rounded-bl-none'
                    }`}
                    >
                    {msg.content}
                    </div>
                )}

                <span className="text-[10px] text-light mt-1 px-1">
                  {format(new Date(msg.created_at), 'h:mm a')}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="p-3 bg-surface border-t border-border flex gap-2 items-center">
        <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-3 text-mid hover:text-navy hover:bg-bg rounded-full transition-colors"
        >
            <ImageIcon size={20} />
        </button>
        <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleImageUpload}
        />

        <input
          type="text"
          className="flex-1 bg-bg border-none rounded-full px-4 py-3 text-sm focus:ring-1 focus:ring-orange focus:outline-none placeholder-mid text-navy"
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
        />
        <button
          type="submit"
          disabled={!newMessage.trim() && !uploading}
          className="p-3 bg-navy text-white rounded-full hover:bg-orange disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};

export default Chat;
