-- Signed-in customers' carts (the "also add there in backend" request).
--
-- One row per customer: the same cart lines the browser keeps in
-- localStorage, stored server-side so a different device can pick them up.
-- The browser remains authoritative during a write; a missing table never
-- stops someone adding to their cart (the API reports it and the UI carries
-- on with the local copy).
--
-- Idempotent: created IF NOT EXISTS, policies dropped before creation.

CREATE TABLE IF NOT EXISTS public.user_carts (
    user_id TEXT PRIMARY KEY,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.user_carts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on user carts" ON public.user_carts;
CREATE POLICY "Service role full access on user carts" ON public.user_carts
    FOR ALL USING (true);

COMMENT ON TABLE public.user_carts IS
    'Cart lines of signed-in customers, mirrored from the browser for durability.';
