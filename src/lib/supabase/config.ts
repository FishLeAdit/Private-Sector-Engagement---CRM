export function parseSupabaseConfig(url: string | undefined, key: string | undefined) {
  if (!url || !key || /your-project|your-publishable-key/.test(`${url} ${key}`)) {
    throw new Error("Supabase URL and publishable key must be configured.");
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Supabase URL must be a valid HTTP(S) URL.");
  }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error("Supabase URL must be a valid HTTP(S) URL.");
  }
  // A privileged key must never be accepted by browser/caller-scoped clients.
  let isAnonKey = false;
  if (key.startsWith("eyJ")) {
    try {
      const payload = JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      isAnonKey = payload.role === "anon";
    } catch {
      /* Invalid keys are rejected below without exposing their value. */
    }
  }
  if (!key.startsWith("sb_publishable_") && !isAnonKey) {
    throw new Error("Use a Supabase publishable or legacy anon key for application clients.");
  }
  return { url: parsed.origin, key };
}

export function getSupabaseConfig() {
  return parseSupabaseConfig(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
