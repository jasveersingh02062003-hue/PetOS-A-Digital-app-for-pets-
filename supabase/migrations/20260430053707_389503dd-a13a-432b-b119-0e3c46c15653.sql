-- Phase 3: Quick perf wins — fill missing hot-path indexes
-- post_likes: PK is (post_id, user_id) so lookups by user_id alone scan; add reverse index for "my likes" queries
CREATE INDEX IF NOT EXISTS idx_post_likes_user ON public.post_likes (user_id, post_id);

-- messages: sender_id has no index; needed for "messages by user" + RLS sender checks
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages (sender_id, created_at DESC);

-- post_comments: author_id has no index; needed for profile "my comments" + author lookups
CREATE INDEX IF NOT EXISTS idx_comments_author ON public.post_comments (author_id, created_at DESC);

-- conversations: ordering "my conversations by recency" goes via members → conversations.last_message_at
CREATE INDEX IF NOT EXISTS idx_conversations_last_msg ON public.conversations (last_message_at DESC NULLS LAST);

-- conversation_members: speed up "unread" checks
CREATE INDEX IF NOT EXISTS idx_cm_user_lastread ON public.conversation_members (user_id, last_read_at DESC NULLS LAST);

ANALYZE public.post_likes;
ANALYZE public.messages;
ANALYZE public.post_comments;
ANALYZE public.conversations;
ANALYZE public.conversation_members;