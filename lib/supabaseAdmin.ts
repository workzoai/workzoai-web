import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) {
  console.warn("[WorkZo] Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL for supabaseAdmin.");
}

if (!serviceRoleKey) {
  console.warn("[WorkZo] Missing SUPABASE_SERVICE_ROLE_KEY for supabaseAdmin.");
}

export const supabaseAdmin = createClient(
  supabaseUrl || "https://example.supabase.co",
  serviceRoleKey || "missing-service-role-key",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export default supabaseAdmin;
