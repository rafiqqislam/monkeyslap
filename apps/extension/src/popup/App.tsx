import {
  DEFAULT_DAILY_MINUTES,
  formatDuration,
  normalizeDomain,
  originPatterns,
  SUGGESTED_SITES,
  type Settings,
} from "@monkeyslap/core";
import { useCallback, useEffect, useState } from "react";
import iconUrl from "../../assets/icon.svg";
import { ask, type AuthState, type Dashboard, type SiteRow } from "../shared/messages";

/** Asks Chrome for access to a site. Must be the first thing a click handler does. */
function requestAccess(domain: string): Promise<boolean> {
  return chrome.permissions.request({ origins: originPatterns(domain) });
}

export function App() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setData(await ask<Dashboard>({ type: "dashboard" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 2000);
    return () => clearInterval(id);
  }, [refresh]);

  /** Runs a background action, shows any error, and refreshes. */
  const run = useCallback(async <T,>(fn: () => Promise<T>) => {
    setError(null);
    setBusy(true);
    try {
      const out = await fn();
      if (out && typeof out === "object" && "settings" in out) setData(out as unknown as Dashboard);
      else await refresh();
      return out;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return undefined;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const addSite = (raw: string, minutes: number) => {
    const domain = normalizeDomain(raw);
    if (!domain) {
      setError("That doesn't look like a website address, e.g. youtube.com");
      return;
    }
    // Ask for access first (needs the click), but save the site right away too:
    // if the popup closes during Chrome's prompt, the background finishes the job.
    const granted = requestAccess(domain);
    void run(async () => {
      const res = await ask<Dashboard>({ type: "addSite", domain, dailyMinutes: minutes });
      await granted.catch(() => false);
      return res;
    });
  };

  const saveSettings = (settings: Settings) =>
    run(() => ask<Dashboard>({ type: "saveSettings", settings }));

  if (!data) {
    return (
      <div className="p-6 text-sm text-muted">
        {error ? <p className="text-slap">{error}</p> : "Loading…"}
      </div>
    );
  }

  const added = new Set(data.settings.limits.map((l) => l.domain));
  const suggestions = SUGGESTED_SITES.filter((s) => !added.has(s));

  return (
    <div className="flex flex-col">
      <Header auth={data.auth} />

      <main className="flex flex-col gap-4 px-4 pb-4">
        {error && (
          <div className="rounded-xl border-2 border-slap/40 bg-slap/5 px-3 py-2 text-sm text-slap" role="alert">
            {error}
          </div>
        )}

        {data.firstSlapPending && data.sites.some((s) => s.limit.enabled) && (
          <div className="rounded-2xl border-2 border-ink bg-banana/30 px-3 py-2.5 text-sm">
            <b>Your first slap comes after just 1 minute</b> on any of these sites, so you can see
            what happens. After that, your normal limits apply.
          </div>
        )}

        <section aria-labelledby="today">
          <h2 id="today" className="mb-2 text-xs font-bold tracking-wide text-muted uppercase">
            Today
          </h2>
          {data.sites.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line bg-sand/60 p-4 text-sm text-muted">
              No sites yet. Add one below, then go scroll on it. When you hit your limit, the monkey
              shows up.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.sites.map((row) => (
                <SiteItem
                  key={row.limit.domain}
                  row={row}
                  disabled={busy}
                  onChange={(limit) =>
                    saveSettings({
                      ...data.settings,
                      limits: data.settings.limits.map((l) => (l.domain === limit.domain ? limit : l)),
                    })
                  }
                  onRemove={() => run(() => ask<Dashboard>({ type: "removeSite", domain: row.limit.domain }))}
                  onGrant={() => {
                    const granted = requestAccess(row.limit.domain);
                    void run(async () => {
                      await granted;
                      return ask<Dashboard>({ type: "saveSettings", settings: data.settings });
                    });
                  }}
                />
              ))}
            </ul>
          )}
        </section>

        <AddSite suggestions={suggestions} disabled={busy} onAdd={addSite} />

        <SettingsPanel settings={data.settings} onSave={saveSettings} />

        <button
          type="button"
          onClick={() => void run(() => ask({ type: "testSlap" }))}
          className="rounded-xl border-2 border-ink bg-banana px-4 py-2.5 text-sm font-bold shadow-[3px_3px_0_var(--color-ink)] transition hover:-translate-px hover:shadow-[4px_4px_0_var(--color-ink)] active:translate-px active:shadow-none"
        >
          Test the slap 👋
        </button>
      </main>

      <AccountFooter
        auth={data.auth}
        busy={busy}
        onSignIn={() => void run(() => ask<AuthState>({ type: "signIn" }))}
        onSignOut={() => void run(() => ask<AuthState>({ type: "signOut" }))}
      />
    </div>
  );
}

function Header({ auth }: { auth: AuthState }) {
  return (
    <header className="flex items-center gap-2.5 px-4 pt-4 pb-3">
      <img src={iconUrl} alt="" className="size-9" />
      <div className="min-w-0 flex-1">
        <h1 className="text-lg leading-tight font-black">MonkeySlap</h1>
        <p className="text-xs text-muted">Scroll less, or get slapped.</p>
      </div>
      {auth.user?.avatarUrl && (
        <img
          src={auth.user.avatarUrl}
          alt={auth.user.name ?? "Your account"}
          referrerPolicy="no-referrer"
          className="size-8 rounded-full border-2 border-ink"
        />
      )}
    </header>
  );
}

function SiteItem({
  row,
  disabled,
  onChange,
  onRemove,
  onGrant,
}: {
  row: SiteRow;
  disabled: boolean;
  onChange: (limit: SiteRow["limit"]) => void;
  onRemove: () => void;
  onGrant: () => void;
}) {
  const { limit, usedMs, slaps, granted, limitMs } = row;
  const pct = Math.min(100, (usedMs / limitMs) * 100);
  const over = usedMs >= limitMs;
  const bar = over ? "bg-slap" : pct >= 80 ? "bg-amber" : "bg-leaf";
  const [minutes, setMinutes] = useState(String(limit.dailyMinutes));
  useEffect(() => setMinutes(String(limit.dailyMinutes)), [limit.dailyMinutes]);

  const commit = () => {
    const n = Number(minutes);
    if (Number.isFinite(n) && n >= 1 && n !== limit.dailyMinutes) onChange({ ...limit, dailyMinutes: n });
    else setMinutes(String(limit.dailyMinutes));
  };

  return (
    <li className={`rounded-2xl border border-line bg-white p-3 ${limit.enabled ? "" : "opacity-60"}`}>
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="grid size-7 shrink-0 place-items-center rounded-lg bg-sand text-xs font-black uppercase"
        >
          {limit.domain[0]}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-bold">{limit.domain}</span>
        {slaps > 0 && (
          <span className="text-xs font-bold text-slap" title={`Slapped ${slaps} times today`}>
            👋 {slaps}
          </span>
        )}
        <Toggle
          label={`Limit ${limit.domain}`}
          checked={limit.enabled}
          disabled={disabled}
          onChange={(enabled) => onChange({ ...limit, enabled })}
        />
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Remove ${limit.domain}`}
          className="grid size-6 place-items-center rounded-md text-muted hover:bg-sand hover:text-ink"
        >
          ✕
        </button>
      </div>

      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-sand" aria-hidden>
        <div className={`h-full rounded-full ${bar} transition-[width]`} style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-1.5 flex items-center justify-between text-xs text-muted">
        <span className={over ? "font-bold text-slap" : ""}>
          {formatDuration(usedMs)} {over ? "· over the limit" : "used"}
        </span>
        <label className="flex items-center gap-1">
          limit
          <input
            type="number"
            min={1}
            max={1440}
            value={minutes}
            disabled={disabled}
            onChange={(e) => setMinutes(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="w-12 rounded-md border border-line bg-cream px-1 py-0.5 text-right text-ink"
          />
          min/day
        </label>
      </div>

      {!granted && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-amber/10 px-2 py-1.5 text-xs">
          <span>Chrome needs your OK to watch this site.</span>
          <button type="button" onClick={onGrant} className="font-bold underline">
            Allow
          </button>
        </div>
      )}
    </li>
  );
}

function AddSite({
  suggestions,
  disabled,
  onAdd,
}: {
  suggestions: readonly string[];
  disabled: boolean;
  onAdd: (domain: string, minutes: number) => void;
}) {
  const [value, setValue] = useState("");
  const [minutes, setMinutes] = useState(DEFAULT_DAILY_MINUTES);

  return (
    <section aria-labelledby="add" className="flex flex-col gap-2">
      <h2 id="add" className="text-xs font-bold tracking-wide text-muted uppercase">
        Add a site
      </h2>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!value.trim()) return;
          onAdd(value, minutes);
          setValue("");
        }}
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. youtube.com"
          aria-label="Website"
          className="min-w-0 flex-1 rounded-xl border-2 border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink"
        />
        <select
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          aria-label="Daily limit"
          className="rounded-xl border-2 border-line bg-white px-2 text-sm"
        >
          {[1, 5, 10, 15, 30, 45, 60, 90, 120].map((m) => (
            <option key={m} value={m}>
              {m} min
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={disabled}
          className="rounded-xl border-2 border-ink bg-ink px-3 text-sm font-bold text-cream disabled:opacity-50"
        >
          Add
        </button>
      </form>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              disabled={disabled}
              onClick={() => onAdd(s, minutes)}
              className="rounded-full border border-line bg-white px-2.5 py-1 text-xs font-semibold hover:border-ink"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function SettingsPanel({ settings, onSave }: { settings: Settings; onSave: (s: Settings) => void }) {
  return (
    <details className="group rounded-2xl border border-line bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-sm font-bold">
        Settings
        <span className="text-muted transition group-open:rotate-180">▾</span>
      </summary>
      <div className="flex flex-col gap-3 border-t border-line px-3 py-3 text-sm">
        <label className="flex items-center justify-between gap-2">
          <span>After I choose to stay, slap again in</span>
          <span className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={60}
              defaultValue={settings.reslapMinutes}
              onBlur={(e) => onSave({ ...settings, reslapMinutes: Number(e.target.value) })}
              className="w-12 rounded-md border border-line bg-cream px-1 py-0.5 text-right"
            />
            min
          </span>
        </label>
        <div className="flex items-center justify-between">
          <span>Slap sound</span>
          <Toggle label="Slap sound" checked={settings.sound} onChange={(sound) => onSave({ ...settings, sound })} />
        </div>
        <label className="flex flex-col gap-1">
          <span className="flex justify-between">
            Monkey size <span className="text-muted">{Math.round(settings.characterScale * 100)}%</span>
          </span>
          <input
            type="range"
            min={0.6}
            max={1.6}
            step={0.1}
            defaultValue={settings.characterScale}
            onPointerUp={(e) => onSave({ ...settings, characterScale: Number((e.target as HTMLInputElement).value) })}
            onKeyUp={(e) => onSave({ ...settings, characterScale: Number((e.target as HTMLInputElement).value) })}
            className="accent-ink"
          />
        </label>
      </div>
    </details>
  );
}

function AccountFooter({
  auth,
  busy,
  onSignIn,
  onSignOut,
}: {
  auth: AuthState;
  busy: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}) {
  return (
    <footer className="border-t border-line bg-sand/60 px-4 py-3 text-xs">
      {auth.user ? (
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate">
            Signed in as <b>{auth.user.email ?? auth.user.name}</b>
          </span>
          <button type="button" onClick={onSignOut} disabled={busy} className="shrink-0 font-bold underline">
            Sign out
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onSignIn}
            disabled={busy || !auth.configured}
            title={auth.configured ? undefined : "Add your Supabase keys to turn this on (docs/SETUP.md)"}
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-line bg-white px-3 py-2 text-sm font-semibold hover:border-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            <GoogleLogo /> Sign in with Google
          </button>
          <p className="text-center text-muted">
            {auth.configured
              ? "Optional. Sign in to keep your progress across devices."
              : "Sign-in isn't set up yet. Everything else works without it."}
          </p>
        </div>
      )}
    </footer>
  );
}

function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full border-2 border-ink transition ${checked ? "bg-leaf" : "bg-sand"}`}
    >
      <span
        className={`absolute top-0.5 size-3 rounded-full bg-white shadow ring-1 ring-ink transition-[left] ${checked ? "left-[18px]" : "left-0.5"}`}
      />
    </button>
  );
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-4" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
