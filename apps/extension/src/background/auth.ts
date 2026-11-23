import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { AuthState, AuthUser } from "../shared/messages";

/**
 * Optional Google sign-in through Supabase Auth.
 *
 * Runs in the service worker, not the popup: the popup closes as soon as the
 * Google window takes focus, which would cut the sign-in off halfway.
 *
 * Flow: Supabase gives us a Google sign-in URL → Chrome opens it in a small
 * window (launchWebAuthFlow) → Google/Supabase redirect back to
 * https://<extension-id>.chromiumapp.org/?code=… → we swap the code for a session.
 */

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const authConfigured = Boolean(url && key && !url.includes("your-project-ref"));

/** Keeps the Supabase session in chrome.storage so it survives worker restarts. */
const chromeStorage = {
  getItem: async (k: string) => {
    const v = (await chrome.storage.local.get(k))[k];
    return typeof v === "string" ? v : null;
  },
  setItem: async (k: string, v: string) => chrome.storage.local.set({ [k]: v }),
  removeItem: async (k: string) => chrome.storage.local.remove(k),
};

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient | null {
  if (!authConfigured) return null;
  client ??= createClient(url!, key!, {
    auth: {
      storage: chromeStorage,
      storageKey: "monkeyslap-auth",
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}

function toAuthUser(user: User | null | undefined): AuthUser | null {
  if (!user) return null;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  return {
    email: user.email ?? null,
    name: str(meta.full_name) ?? str(meta.name),
    avatarUrl: str(meta.avatar_url) ?? str(meta.picture),
  };
}

export async function getAuthState(): Promise<AuthState> {
  const sb = supabase();
  if (!sb) return { configured: false, user: null };
  const { data } = await sb.auth.getSession();
  return { configured: true, user: toAuthUser(data.session?.user) };
}

export async function signInWithGoogle(): Promise<AuthState> {
  const sb = supabase();
  if (!sb) throw new Error("Sign-in isn't set up yet. Add your Supabase keys (docs/SETUP.md).");

  const redirectTo = chrome.identity.getRedirectURL();
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw new Error(error?.message ?? "Couldn't start Google sign-in");

  const returned = await chrome.identity.launchWebAuthFlow({ url: data.url, interactive: true });
  if (!returned) throw new Error("Sign-in was cancelled");

  const params = new URL(returned).searchParams;
  const failure = params.get("error_description") ?? params.get("error");
  if (failure) throw new Error(failure);
  const code = params.get("code");
  if (!code) throw new Error("Google didn't return a sign-in code");

  const exchanged = await sb.auth.exchangeCodeForSession(code);
  if (exchanged.error) throw new Error(exchanged.error.message);
  return { configured: true, user: toAuthUser(exchanged.data.user) };
}

export async function signOut(): Promise<AuthState> {
  const sb = supabase();
  if (sb) await sb.auth.signOut();
  return { configured: authConfigured, user: null };
}
