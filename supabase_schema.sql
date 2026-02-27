-- ==========================================
-- ADDA - Supabase Schema (Fixed & Optimized)
-- Run this in the Supabase SQL Editor
-- Safe to re-run (idempotent)
-- ==========================================

-- ==========================================
-- 1. USERS & AUTH SYNC
-- ==========================================
CREATE TABLE IF NOT EXISTS public.users (
  id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  name text NOT NULL,
  avatar_url text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- MIGRATION: Add new profile columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS occupation text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS interests text[];
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role text DEFAULT 'general';
-- Gamification columns (for streak & tier system)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS streak_days int DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS adda_count int DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS hosted_count int DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_hangout_date date;

DO $$ BEGIN
  ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('general', 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.users;
CREATE POLICY "Public profiles are viewable by everyone" ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can update any profile" ON public.users;
CREATE POLICY "Admins can update any profile" ON public.users FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can delete any user" ON public.users;
CREATE POLICY "Admins can delete any user" ON public.users FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users AS u WHERE u.id = auth.uid() AND u.role = 'admin')
);

-- Trigger: auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, name, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'User'),
    null
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ==========================================
-- 2. HANGOUTS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.hangouts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id uuid REFERENCES public.users(id) NOT NULL,
  activity_type text NOT NULL,
  title text NOT NULL,
  location_text text NOT NULL,
  start_time timestamp with time zone NOT NULL,
  max_participants int NOT NULL CHECK (max_participants >= 2 AND max_participants <= 20),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  expires_at timestamp with time zone NOT NULL
);

ALTER TABLE public.hangouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hangouts are viewable by everyone" ON public.hangouts;
CREATE POLICY "Hangouts are viewable by everyone" ON public.hangouts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create hangouts" ON public.hangouts;
CREATE POLICY "Authenticated users can create hangouts" ON public.hangouts FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Creators can delete own hangouts" ON public.hangouts;
CREATE POLICY "Creators can delete own hangouts" ON public.hangouts FOR DELETE USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Admins can delete any hangout" ON public.hangouts;
CREATE POLICY "Admins can delete any hangout" ON public.hangouts FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);

-- Trigger: increment hosted_count when user creates a hangout
CREATE OR REPLACE FUNCTION public.handle_hangout_created()
RETURNS trigger AS $$
BEGIN
  UPDATE public.users
  SET hosted_count = COALESCE(hosted_count, 0) + 1
  WHERE id = new.creator_id;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_hangout_created ON public.hangouts;
CREATE TRIGGER on_hangout_created
  AFTER INSERT ON public.hangouts
  FOR EACH ROW EXECUTE PROCEDURE public.handle_hangout_created();


-- ==========================================
-- 3. PARTICIPANTS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.participants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  hangout_id uuid REFERENCES public.hangouts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.users(id) NOT NULL,
  joined_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(hangout_id, user_id)
);

ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

DO $$ BEGIN
  ALTER TABLE public.participants ADD CONSTRAINT participants_status_check CHECK (status IN ('pending', 'approved', 'rejected'));
EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;

-- NOTE: The old schema had "UPDATE participants SET status='approved' WHERE status='pending'" here.
-- That line was a CRITICAL BUG - it approved ALL pending participants on every schema run.
-- It has been removed. If you need to approve legacy data, run it ONCE manually.

ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants are viewable by everyone" ON public.participants;
CREATE POLICY "Participants are viewable by everyone" ON public.participants FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can request to join" ON public.participants;
CREATE POLICY "Users can request to join" ON public.participants FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Creators can manage participants" ON public.participants;
CREATE POLICY "Creators can manage participants" ON public.participants FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.hangouts h
    WHERE h.id = participants.hangout_id AND h.creator_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete own participation" ON public.participants;
CREATE POLICY "Users can delete own participation" ON public.participants FOR DELETE USING (auth.uid() = user_id);


-- ==========================================
-- 4. MESSAGES (CHAT)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  hangout_id uuid REFERENCES public.hangouts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.users(id) NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'text';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_url text;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Approved participants can view messages" ON public.messages;
CREATE POLICY "Approved participants can view messages" ON public.messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.participants p
    WHERE p.hangout_id = messages.hangout_id
    AND p.user_id = auth.uid()
    AND p.status = 'approved'
  )
);

DROP POLICY IF EXISTS "Approved participants can insert messages" ON public.messages;
CREATE POLICY "Approved participants can insert messages" ON public.messages FOR INSERT WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.participants p
    WHERE p.hangout_id = messages.hangout_id
    AND p.user_id = auth.uid()
    AND p.status = 'approved'
  )
);


-- ==========================================
-- 5. NOTIFICATIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  link text,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- FIX: Missing delete policy (was causing silent failures in UI)
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
CREATE POLICY "Users can delete their own notifications" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can insert notifications" ON public.notifications;
CREATE POLICY "Anyone can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);


-- ==========================================
-- 6. STREAK & COUNT UPDATE FUNCTION
-- ==========================================
CREATE OR REPLACE FUNCTION update_user_streak(user_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  last_date date;
  today date := CURRENT_DATE;
BEGIN
  SELECT last_hangout_date INTO last_date FROM users WHERE id = user_uuid;

  -- Don't double-count on same day
  IF last_date = today THEN
    RETURN;
  END IF;

  -- 7-day streak window (as per product strategy)
  IF last_date IS NULL OR (today - last_date) > 7 THEN
    -- Reset streak to 1
    UPDATE users SET
      adda_count = COALESCE(adda_count, 0) + 1,
      streak_days = 1,
      last_hangout_date = today
    WHERE id = user_uuid;
  ELSE
    -- Continue streak
    UPDATE users SET
      adda_count = COALESCE(adda_count, 0) + 1,
      streak_days = COALESCE(streak_days, 0) + 1,
      last_hangout_date = today
    WHERE id = user_uuid;
  END IF;
END;
$$;


-- ==========================================
-- 7. SMART JOIN FUNCTION (RPC)
-- ==========================================
CREATE OR REPLACE FUNCTION join_hangout(hangout_id_input uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_count int;
  max_count int;
  is_expired boolean;
  is_creator boolean;
  new_status text;
  creator_uuid uuid;
  hangout_title text;
  user_name text;
BEGIN
  IF EXISTS (SELECT 1 FROM participants WHERE hangout_id = hangout_id_input AND user_id = auth.uid()) THEN
    RETURN;
  END IF;

  SELECT (now() > expires_at), max_participants, (creator_id = auth.uid()), creator_id, title
  INTO is_expired, max_count, is_creator, creator_uuid, hangout_title
  FROM hangouts WHERE id = hangout_id_input;

  IF is_expired THEN
    RAISE EXCEPTION 'Hangout has expired';
  END IF;

  IF is_creator THEN
    new_status := 'approved';
  ELSE
    SELECT count(*) INTO current_count FROM participants
    WHERE hangout_id = hangout_id_input AND status = 'approved';
    IF current_count >= max_count THEN
      RAISE EXCEPTION 'Hangout is full';
    END IF;
    new_status := 'pending';
  END IF;

  INSERT INTO participants (hangout_id, user_id, status)
  VALUES (hangout_id_input, auth.uid(), new_status);

  IF NOT is_creator THEN
    SELECT name INTO user_name FROM users WHERE id = auth.uid();
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      creator_uuid,
      'join_request',
      'New Join Request',
      COALESCE(user_name, 'Someone') || ' wants to join "' || COALESCE(hangout_title, 'Hangout') || '"',
      '/hangout/' || hangout_id_input
    );
  ELSE
    -- Creator auto-approved: update streak
    PERFORM update_user_streak(auth.uid());
  END IF;
END;
$$;


-- ==========================================
-- 8. TRIGGER: PARTICIPANT APPROVED
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_participant_approval()
RETURNS trigger AS $$
DECLARE
  hangout_title text;
BEGIN
  IF new.status = 'approved' AND (old.status IS NULL OR old.status != 'approved') THEN
    SELECT title INTO hangout_title FROM public.hangouts WHERE id = new.hangout_id;

    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      new.user_id,
      'approved',
      'Request Approved! 🚀',
      'You have been accepted to join "' || COALESCE(hangout_title, 'Hangout') || '"',
      '/hangout/' || new.hangout_id
    );

    PERFORM update_user_streak(new.user_id);
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_participant_approved ON public.participants;
CREATE TRIGGER on_participant_approved
  AFTER UPDATE ON public.participants
  FOR EACH ROW EXECUTE PROCEDURE public.handle_participant_approval();


-- ==========================================
-- 9. PERFORMANCE INDEXES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_hangouts_expires_at ON public.hangouts(expires_at);
CREATE INDEX IF NOT EXISTS idx_hangouts_creator_id ON public.hangouts(creator_id);
CREATE INDEX IF NOT EXISTS idx_hangouts_start_time ON public.hangouts(start_time);
CREATE INDEX IF NOT EXISTS idx_participants_hangout_id ON public.participants(hangout_id);
CREATE INDEX IF NOT EXISTS idx_participants_user_id ON public.participants(user_id);
CREATE INDEX IF NOT EXISTS idx_participants_hangout_status ON public.participants(hangout_id, status);
CREATE INDEX IF NOT EXISTS idx_messages_hangout_id ON public.messages(hangout_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read);


-- ==========================================
-- 10. ENABLE REALTIME
-- ==========================================
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.participants; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.hangouts; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN OTHERS THEN NULL; END;
END;
$$;


-- ==========================================
-- 11. STORAGE BUCKETS
-- ==========================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chat-images', 'chat-images', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Avatar policies
DROP POLICY IF EXISTS "Avatar images are publicly accessible." ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible." ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
CREATE POLICY "Authenticated users can upload avatars" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
CREATE POLICY "Users can update their own avatars" ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid() = owner);

DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;
CREATE POLICY "Users can delete their own avatars" ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid() = owner);

-- Chat images policies
DROP POLICY IF EXISTS "Chat images are publicly accessible." ON storage.objects;
CREATE POLICY "Chat images are publicly accessible." ON storage.objects FOR SELECT USING (bucket_id = 'chat-images');

DROP POLICY IF EXISTS "Authenticated users can upload chat images" ON storage.objects;
CREATE POLICY "Authenticated users can upload chat images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chat-images' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can delete their own chat images" ON storage.objects;
CREATE POLICY "Users can delete their own chat images" ON storage.objects FOR DELETE
  USING (bucket_id = 'chat-images' AND auth.uid() = owner);


-- ==========================================
-- 12. CLEANUP FUNCTION
-- Call periodically (e.g. via pg_cron or Supabase Edge Function)
-- to keep the 500MB free-tier DB lean
-- ==========================================
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete hangouts expired more than 7 days ago (cascades to participants & messages)
  DELETE FROM public.hangouts WHERE expires_at < now() - interval '7 days';

  -- Delete read notifications older than 30 days
  DELETE FROM public.notifications WHERE read = true AND created_at < now() - interval '30 days';

  -- Delete ALL notifications older than 60 days
  DELETE FROM public.notifications WHERE created_at < now() - interval '60 days';
END;
$$;
