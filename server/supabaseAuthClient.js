import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

/**
 * A client for the sign-in flow only.
 *
 * It must not be the shared client from `db.js`. `signInWithPassword` swaps
 * the client's Authorization header to the signed-in user's access token, so
 * signing in on the shared service-role client would leave every later
 * server-side write running as `authenticated` instead of `service_role`.
 * Once the content tables have RLS enabled, PostgREST reports such a write as
 * *zero affected rows* rather than an error — the API would answer "saved
 * successfully" while nothing was written.
 *
 * `persistSession: false` keeps the throwaway session out of any storage.
 */
export const authClient = createClient(supabaseUrl || "", supabaseKey || "", {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
