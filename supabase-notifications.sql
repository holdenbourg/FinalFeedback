-- ============================================================
-- NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE public.notifications (
  id              uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id    uuid              NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  actor_id        uuid              NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type            text              NOT NULL,
  post_id         uuid              REFERENCES public.posts(id)    ON DELETE CASCADE,
  comment_id      uuid              REFERENCES public.comments(id) ON DELETE CASCADE,
  rating_id       uuid              REFERENCES public.ratings(id)  ON DELETE CASCADE,
  metadata        jsonb             NOT NULL DEFAULT '{}'::jsonb,
  read            boolean           NOT NULL DEFAULT false,
  created_at      timestamptz       NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_notifications_recipient_created
  ON public.notifications(recipient_id, created_at DESC);

CREATE INDEX idx_notifications_recipient_unread
  ON public.notifications(recipient_id, read)
  WHERE read = false;

CREATE INDEX idx_notifications_type_post
  ON public.notifications(type, post_id)
  WHERE post_id IS NOT NULL;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  USING (recipient_id = auth.uid());

CREATE POLICY "notifications_insert_authenticated"
  ON public.notifications FOR INSERT
  WITH CHECK (
    actor_id = auth.uid()
    AND recipient_id != auth.uid()
  );

CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  USING (recipient_id = auth.uid());

CREATE POLICY "notifications_delete_own"
  ON public.notifications FOR DELETE
  USING (recipient_id = auth.uid());

-- ============================================================
-- RPC: create_notification (single recipient, with block check)
-- ============================================================
CREATE OR REPLACE FUNCTION create_notification(
  p_recipient_id  uuid,
  p_actor_id      uuid,
  p_type          text,
  p_post_id       uuid      DEFAULT NULL,
  p_comment_id    uuid      DEFAULT NULL,
  p_rating_id     uuid      DEFAULT NULL,
  p_metadata      jsonb     DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Skip if actor and recipient are the same
  IF p_actor_id = p_recipient_id THEN
    RETURN;
  END IF;

  -- Skip if a block relationship exists in either direction
  IF EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (blocker_id = p_actor_id    AND blocked_id = p_recipient_id)
       OR (blocker_id = p_recipient_id AND blocked_id = p_actor_id)
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications(
    recipient_id, actor_id, type, post_id, comment_id, rating_id, metadata
  ) VALUES (
    p_recipient_id, p_actor_id, p_type, p_post_id, p_comment_id, p_rating_id, p_metadata
  );
END;
$$;

-- ============================================================
-- RPC: create_notification_for_followers (fan-out to all followers)
-- Used for rating notifications
-- ============================================================
CREATE OR REPLACE FUNCTION create_notification_for_followers(
  p_actor_id      uuid,
  p_type          text,
  p_post_id       uuid      DEFAULT NULL,
  p_comment_id    uuid      DEFAULT NULL,
  p_rating_id     uuid      DEFAULT NULL,
  p_metadata      jsonb     DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.notifications(
    recipient_id, actor_id, type, post_id, comment_id, rating_id, metadata
  )
  SELECT
    f.follower_id,
    p_actor_id,
    p_type,
    p_post_id,
    p_comment_id,
    p_rating_id,
    p_metadata
  FROM public.follows f
  WHERE f.followee_id = p_actor_id
    -- Exclude blocked relationships
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks ub
      WHERE (ub.blocker_id = p_actor_id    AND ub.blocked_id = f.follower_id)
         OR (ub.blocker_id = f.follower_id AND ub.blocked_id = p_actor_id)
    );
END;
$$;

-- ============================================================
-- AUTO-DELETE NOTIFICATIONS OLDER THAN 30 DAYS
-- Enable pg_cron extension first (Supabase Dashboard → Database → Extensions)
-- Then run:
-- ============================================================
-- SELECT cron.schedule(
--   'cleanup-old-notifications',
--   '0 3 * * *',  -- daily at 3 AM UTC
--   $$DELETE FROM public.notifications WHERE created_at < now() - interval '30 days'$$
-- );

-- If you prefer a manual function instead of pg_cron:
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM public.notifications
  WHERE created_at < now() - interval '30 days';
$$;
