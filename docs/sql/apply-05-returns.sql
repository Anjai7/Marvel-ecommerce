-- Customer return requests (order lifecycle, customer side).
--
-- One row per request: who asked (user_id, the caller's own profile), which
-- order (order_id), the reason (a slug the customer UI offers) and the
-- free-text notes. The customer UI posts through
-- `POST /api/orders/:id/return` (server/routes/orders.js) and does not read
-- this table back — it shows the request it just posted.
--
-- Idempotent: every object is created `if not exists`, and the policy is
-- dropped before it is created, so re-running the file is harmless. Applies
-- with `npm run db:apply` or by pasting it into the SQL Editor.
-- Documented in docs/sql/README.md (section 9).

CREATE TABLE IF NOT EXISTS public."returns" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public."orders"(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reason TEXT NOT NULL CHECK (reason IN ('damaged', 'wrong_item', 'changed_mind', 'other')),
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- The customer's order page shows each request once; a future reader can
-- list them per order or per user.
CREATE INDEX IF NOT EXISTS returns_order_id_idx ON public."returns"(order_id);
CREATE INDEX IF NOT EXISTS returns_user_id_idx ON public."returns"(user_id);

ALTER TABLE public."returns" ENABLE ROW LEVEL SECURITY;

-- The API writes through the service_role key; the customer UI does not read
-- this table, but the rows of the caller's own requests stay readable.
DROP POLICY IF EXISTS "Users can view own returns" ON public."returns";
CREATE POLICY "Users can view own returns" ON public."returns"
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access on returns" ON public."returns";
CREATE POLICY "Service role full access on returns" ON public."returns"
    FOR ALL USING (true);
