import { createBrowserClient } from "@supabase/ssr"

let supabaseClient: ReturnType<typeof createBrowserClient> | null = null

export function getSupabase() {
  if (!supabaseClient) {
    // Try to get credentials from localStorage first (manual config)
    const storedUrl = typeof window !== "undefined" ? localStorage.getItem("supabase_url") : null
    const storedKey = typeof window !== "undefined" ? localStorage.getItem("supabase_key") : null

    // Fall back to environment variables if available
    const supabaseUrl = storedUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || ""
    const supabaseKey = storedKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase credentials not configured. Please configure in Admin Management > Database tab.")
    }

    supabaseClient = createBrowserClient(supabaseUrl, supabaseKey)
  }
  return supabaseClient
}

export const getSupabaseClient = getSupabase

export function isSupabaseConfigured(): boolean {
  if (typeof window === "undefined") return false
  const storedUrl = localStorage.getItem("supabase_url")
  const storedKey = localStorage.getItem("supabase_key")
  return !!(
    (storedUrl && storedKey) ||
    (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  )
}

export function resetSupabaseClient() {
  supabaseClient = null
}
