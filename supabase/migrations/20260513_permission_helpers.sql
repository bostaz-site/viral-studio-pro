-- Migration 2: Capability-based permission helpers
-- Orthogonal permissions, NOT hierarchical (finance != above ops)

-- Returns the role of the current user (or NULL if not admin)
CREATE OR REPLACE FUNCTION auth_role() RETURNS TEXT AS $$
  SELECT role FROM admin_users WHERE user_id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Capability-based helpers
CREATE OR REPLACE FUNCTION can_view_crm() RETURNS BOOLEAN AS $$
  SELECT auth_role() IN ('owner', 'ops', 'va', 'readonly');
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION can_manage_crm() RETURNS BOOLEAN AS $$
  SELECT auth_role() IN ('owner', 'ops', 'va');
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION can_manage_campaigns() RETURNS BOOLEAN AS $$
  SELECT auth_role() IN ('owner', 'ops');
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION can_view_inbox() RETURNS BOOLEAN AS $$
  SELECT auth_role() IN ('owner', 'ops', 'va');
$$ LANGUAGE SQL STABLE;

-- VAs see subject/preview only, not full body
CREATE OR REPLACE FUNCTION can_view_inbox_bodies() RETURNS BOOLEAN AS $$
  SELECT auth_role() IN ('owner', 'ops');
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION can_view_finance() RETURNS BOOLEAN AS $$
  SELECT auth_role() IN ('owner', 'finance');
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION can_manage_payouts() RETURNS BOOLEAN AS $$
  SELECT auth_role() IN ('owner', 'finance');
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION can_view_credentials() RETURNS BOOLEAN AS $$
  SELECT auth_role() = 'owner';
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION is_owner() RETURNS BOOLEAN AS $$
  SELECT auth_role() = 'owner';
$$ LANGUAGE SQL STABLE;

-- Any admin role
CREATE OR REPLACE FUNCTION is_admin_any() RETURNS BOOLEAN AS $$
  SELECT auth_role() IS NOT NULL;
$$ LANGUAGE SQL STABLE;

-- Backward compat: old is_admin() now delegates to is_admin_any()
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
  SELECT is_admin_any();
$$ LANGUAGE SQL STABLE;
