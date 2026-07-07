-- The student's notification bell should clear when they open it, and stay
-- cleared (even across a re-login) until something genuinely new happens.
-- That needs a persisted marker per user, not just client-side state.
alter table profiles add column if not exists notifications_seen_at timestamptz;
