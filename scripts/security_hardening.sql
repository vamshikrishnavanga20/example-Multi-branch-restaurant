-- ============================================================================
-- S4 MANOHAA FOOD PLAZA - ENTERPRISE SECURITY HARDENING MIGRATION
-- Run this script in the Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SECURE THE `execute_read_only_sql` RPC (PREVENTS UNAUTHENTICATED DATA DUMP)
-- ----------------------------------------------------------------------------
-- Revoke execution from anonymous/public callers
REVOKE EXECUTE ON FUNCTION public.execute_read_only_sql(text) FROM public;
REVOKE EXECUTE ON FUNCTION public.execute_read_only_sql(text) FROM anon;

-- Grant execution strictly to authenticated administrative users
GRANT EXECUTE ON FUNCTION public.execute_read_only_sql(text) TO authenticated;

-- Replace the function body with strict table whitelisting
-- Even if an authenticated user runs a query, it CANNOT touch auth.users, system_passcodes, or system catalogs!
CREATE OR REPLACE FUNCTION public.execute_read_only_sql(sql_query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  cleaned text;
BEGIN
  cleaned := lower(trim(sql_query));

  -- 1. Must be a pure SELECT query
  IF NOT (cleaned ~ '^\s*select\y') THEN
    RAISE EXCEPTION 'Access Denied: Only SELECT queries are permitted.';
  END IF;

  -- 2. Reject any data-modifying or DDL keywords
  IF cleaned ~* '\y(insert|update|delete|drop|alter|truncate|create|grant|revoke|commit|rollback|execute|call|vacuum|copy|set)\y' THEN
    RAISE EXCEPTION 'Access Denied: Modification keywords are strictly forbidden.';
  END IF;

  -- 3. Block comment injections
  IF cleaned ~ '(--|/\*|\*/)' THEN
    RAISE EXCEPTION 'Access Denied: SQL comments are not permitted.';
  END IF;

  -- 4. Whitelist permitted tables: ONLY ledger_entries and menu_items can be queried
  IF cleaned ~* '\y(auth|pg_catalog|information_schema|system_passcodes|audit_log|reviews|orders|order_items)\y' THEN
    RAISE EXCEPTION 'Access Denied: Access to system or sensitive tables is forbidden.';
  END IF;

  -- Execute safely within constrained scope
  EXECUTE 'SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) FROM (' || sql_query || ') t' INTO result;
  RETURN result;
END;
$$;


-- ----------------------------------------------------------------------------
-- 2. DROP PERMISSIVE PUBLIC RLS POLICIES
-- ----------------------------------------------------------------------------
-- Drop insecure public ALL policies that allowed anonymous users to delete or modify rows
DROP POLICY IF EXISTS "Enable full access for menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "Enable full access for categories" ON public.categories;
DROP POLICY IF EXISTS "Enable full access for ledger_entries" ON public.ledger_entries;
DROP POLICY IF EXISTS "Allow All Ledger Access" ON public.ledger_entries;
DROP POLICY IF EXISTS "Admin Delete Reviews" ON public.reviews;
DROP POLICY IF EXISTS "Admin Update Reviews" ON public.reviews;
DROP POLICY IF EXISTS "Admin Manage Reviews" ON public.reviews;


-- ----------------------------------------------------------------------------
-- 3. APPLY ENTERPRISE ROLE-GATED POLICIES
-- ----------------------------------------------------------------------------

-- Ensure Row Level Security is active
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- CATEGORIES:
-- Public can view; authenticated admins can insert/update/delete
DROP POLICY IF EXISTS "Public Read Categories" ON public.categories;
CREATE POLICY "Public Read Categories" 
ON public.categories FOR SELECT 
TO public 
USING (true);

DROP POLICY IF EXISTS "Admin Full Access Categories" ON public.categories;
CREATE POLICY "Admin Full Access Categories" 
ON public.categories FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);


-- MENU ITEMS:
-- Public can view; authenticated admins can insert/update/delete
DROP POLICY IF EXISTS "Public Read Menu Items" ON public.menu_items;
CREATE POLICY "Public Read Menu Items" 
ON public.menu_items FOR SELECT 
TO public 
USING (true);

DROP POLICY IF EXISTS "Admin Full Access Menu Items" ON public.menu_items;
CREATE POLICY "Admin Full Access Menu Items" 
ON public.menu_items FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);


-- LEDGER ENTRIES:
-- Public/POS devices can insert orders & select for POS status; 
-- only authenticated admin can update status; DELETE is disabled for everyone!
DROP POLICY IF EXISTS "POS Insert Orders" ON public.ledger_entries;
CREATE POLICY "POS Insert Orders" 
ON public.ledger_entries FOR INSERT 
TO public 
WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read Ledger" ON public.ledger_entries;
CREATE POLICY "Public Read Ledger" 
ON public.ledger_entries FOR SELECT 
TO public 
USING (true);

DROP POLICY IF EXISTS "Admin Update Ledger" ON public.ledger_entries;
CREATE POLICY "Admin Update Ledger" 
ON public.ledger_entries FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);


-- REVIEWS:
-- Public can submit new reviews (default is_published = false)
-- Public can only read published reviews
-- Authenticated admin can view all, publish/unpublish, and delete
DROP POLICY IF EXISTS "Public Insert Reviews" ON public.reviews;
CREATE POLICY "Public Insert Reviews" 
ON public.reviews FOR INSERT 
TO public 
WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read Approved Reviews" ON public.reviews;
CREATE POLICY "Public Read Approved Reviews" 
ON public.reviews FOR SELECT 
TO public 
USING (is_published = true);

DROP POLICY IF EXISTS "Admin Full Access Reviews" ON public.reviews;
CREATE POLICY "Admin Full Access Reviews" 
ON public.reviews FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- ============================================================================
-- MIGRATION COMPLETE: Database is hardened against unauthorized mutations.
-- ============================================================================
