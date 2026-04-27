-- ═══════════════════════════════════════════════════════════════
-- RLS Policies — enforce row-level security on all user tables.
-- Service role (used by crons, VPS, admin) bypasses RLS by default.
-- ═══════════════════════════════════════════════════════════════

-- ── Enable RLS ──────────────────────────────────────────────────

ALTER TABLE render_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trending_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE streamers ENABLE ROW LEVEL SECURITY;

-- analytics_events uses session_id (anonymous), no user_id column — RLS via session not practical.
-- Protected by rate limiting + event whitelist instead.
-- ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- ── render_jobs ─────────────────────────────────────────────────

CREATE POLICY "Users can view own render jobs" ON render_jobs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own render jobs" ON render_jobs
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- No user UPDATE policy: VPS updates via service role (bypasses RLS)

-- ── videos ──────────────────────────────────────────────────────

CREATE POLICY "Users can view own videos" ON videos
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own videos" ON videos
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own videos" ON videos
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own videos" ON videos
  FOR DELETE USING (user_id = auth.uid());

-- ── clips ───────────────────────────────────────────────────────

CREATE POLICY "Users can view own clips" ON clips
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own clips" ON clips
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own clips" ON clips
  FOR UPDATE USING (user_id = auth.uid());

-- ── social_accounts ─────────────────────────────────────────────

CREATE POLICY "Users can manage own social accounts" ON social_accounts
  FOR ALL USING (user_id = auth.uid());

-- ── account_snapshots ───────────────────────────────────────────

CREATE POLICY "Users can view own snapshots" ON account_snapshots
  FOR SELECT USING (account_id IN (
    SELECT id FROM social_accounts WHERE user_id = auth.uid()
  ));

-- ── profiles ────────────────────────────────────────────────────

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- ── saved_clips ─────────────────────────────────────────────────

CREATE POLICY "Users can manage own saves" ON saved_clips
  FOR ALL USING (user_id = auth.uid());

-- ── trending_clips (public read) ────────────────────────────────

CREATE POLICY "Anyone can view trending clips" ON trending_clips
  FOR SELECT USING (true);

-- ── streamers (public read) ─────────────────────────────────────

CREATE POLICY "Anyone can view streamers" ON streamers
  FOR SELECT USING (true);
