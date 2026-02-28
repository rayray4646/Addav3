-- ==========================================
-- ADDA - Trust & Security Migrations
-- Run this AFTER supabase_schema.sql
-- Safe to re-run (idempotent)
-- ==========================================

-- ==========================================
-- 1. TRUST COLUMNS ON USERS
-- ==========================================
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ban_reason text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS profile_score int DEFAULT 0;
-- profile_score: 0-100, calculated from completeness. >=80 = "Verified Profile"

-- ==========================================
-- 2. REPORTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  reported_user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  reported_hangout_id uuid REFERENCES public.hangouts(id) ON DELETE CASCADE,
  reason text NOT NULL,
  details text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  reviewed_at timestamp with time zone,
  reviewed_by uuid REFERENCES public.users(id),
  -- At least one of reported_user_id or reported_hangout_id must be set
  CONSTRAINT report_has_target CHECK (reported_user_id IS NOT NULL OR reported_hangout_id IS NOT NULL)
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create reports" ON public.reports;
CREATE POLICY "Users can create reports" ON public.reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- Users can see their own reports
DROP POLICY IF EXISTS "Users can view own reports" ON public.reports;
CREATE POLICY "Users can view own reports" ON public.reports
  FOR SELECT USING (auth.uid() = reporter_id);

-- Admins can see all reports
DROP POLICY IF EXISTS "Admins can view all reports" ON public.reports;
CREATE POLICY "Admins can view all reports" ON public.reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can update reports" ON public.reports;
CREATE POLICY "Admins can update reports" ON public.reports
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Index for admin dashboard queries
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_reported_user ON public.reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at DESC);

-- ==========================================
-- 3. PROFILE SCORE FUNCTION
-- Called whenever a profile is updated
-- Score breakdown:
--   avatar_url     = 25 pts
--   bio            = 20 pts
--   occupation     = 20 pts (dept + year)
--   location       = 15 pts (university)
--   interests(3+)  = 20 pts (vibes/activities)
--   Total          = 100 pts
--   >= 80 = Verified Profile badge
-- ==========================================
CREATE OR REPLACE FUNCTION compute_profile_score(user_uuid uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  u public.users%ROWTYPE;
  score int := 0;
  vibe_count int;
BEGIN
  SELECT * INTO u FROM public.users WHERE id = user_uuid;

  IF u.avatar_url IS NOT NULL AND u.avatar_url != '' THEN
    score := score + 25;
  END IF;

  IF u.bio IS NOT NULL AND trim(u.bio) != '' THEN
    score := score + 20;
  END IF;

  IF u.occupation IS NOT NULL AND trim(u.occupation) != '' AND u.occupation != ' · ' THEN
    score := score + 20;
  END IF;

  IF u.location IS NOT NULL AND trim(u.location) != '' THEN
    score := score + 15;
  END IF;

  -- Count interests that start with 'vibe:' or 'activity:'
  SELECT COUNT(*) INTO vibe_count
  FROM unnest(COALESCE(u.interests, ARRAY[]::text[])) AS t(val)
  WHERE t.val LIKE 'vibe:%' OR t.val LIKE 'activity:%';

  IF vibe_count >= 3 THEN
    score := score + 20;
  ELSIF vibe_count >= 1 THEN
    score := score + 10;
  END IF;

  RETURN score;
END;
$$;

-- Trigger: recompute profile_score whenever users row is updated
CREATE OR REPLACE FUNCTION public.handle_profile_update()
RETURNS trigger AS $$
BEGIN
  NEW.profile_score := compute_profile_score(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_updated ON public.users;
CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_profile_update();

-- Backfill existing profiles
UPDATE public.users SET profile_score = compute_profile_score(id);

-- ==========================================
-- 4. RATE LIMIT: MAX 3 HANGOUTS PER DAY
-- Enforced at DB level via a function
-- ==========================================
CREATE OR REPLACE FUNCTION check_hangout_rate_limit()
RETURNS trigger AS $$
DECLARE
  count_today int;
BEGIN
  SELECT COUNT(*) INTO count_today
  FROM public.hangouts
  WHERE creator_id = NEW.creator_id
    AND created_at > now() - interval '24 hours';

  IF count_today >= 3 THEN
    RAISE EXCEPTION 'Rate limit: You can only create 3 hangouts per day.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_hangout_rate_limit ON public.hangouts;
CREATE TRIGGER enforce_hangout_rate_limit
  BEFORE INSERT ON public.hangouts
  FOR EACH ROW EXECUTE PROCEDURE check_hangout_rate_limit();

-- ==========================================
-- 5. BANNED USER GATE
-- Prevent banned users from joining or creating hangouts
-- ==========================================
CREATE OR REPLACE FUNCTION check_user_not_banned()
RETURNS trigger AS $$
DECLARE
  banned boolean;
BEGIN
  SELECT is_banned INTO banned FROM public.users WHERE id = auth.uid();
  IF banned = true THEN
    RAISE EXCEPTION 'Your account has been suspended. Contact support.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS ban_check_hangouts ON public.hangouts;
CREATE TRIGGER ban_check_hangouts
  BEFORE INSERT ON public.hangouts
  FOR EACH ROW EXECUTE PROCEDURE check_user_not_banned();

DROP TRIGGER IF EXISTS ban_check_participants ON public.participants;
CREATE TRIGGER ban_check_participants
  BEFORE INSERT ON public.participants
  FOR EACH ROW EXECUTE PROCEDURE check_user_not_banned();

-- ==========================================
-- 6. ADMIN HELPER: BAN A USER
-- ==========================================
CREATE OR REPLACE FUNCTION admin_ban_user(target_user_id uuid, reason_text text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only admins can call this
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE public.users
  SET is_banned = true, ban_reason = reason_text
  WHERE id = target_user_id;

  -- Delete all their pending join requests
  DELETE FROM public.participants
  WHERE user_id = target_user_id AND status = 'pending';
END;
$$;

-- ==========================================
-- 7. ADMIN HELPER: DISMISS ALL REPORTS FOR A USER
-- ==========================================
CREATE OR REPLACE FUNCTION admin_resolve_report(report_id uuid, new_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE public.reports
  SET status = new_status,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  WHERE id = report_id;
END;
$$;

-- ==========================================
-- 8. PREVENT SELF-REPORTING
-- ==========================================
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS no_self_report;
ALTER TABLE public.reports ADD CONSTRAINT no_self_report
  CHECK (reporter_id != reported_user_id);
