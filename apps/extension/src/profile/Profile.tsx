import { formatDuration, siteTotals } from "@monkeyslap/core";
import { useCallback, useEffect, useState } from "react";
import iconUrl from "../../assets/icon.svg";
import { GoogleLogo } from "../shared/GoogleLogo";
import { ask, type AuthState, type Dashboard, type SiteRow, type Stats } from "../shared/messages";
import { WeekChart } from "./WeekChart";

/** The profile page: who you are (if signed in) and how your scrolling is going. */
export function Profile() {
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [d, s] = await Promise.all([
        ask<Dashboard>({ type: "dashboard" }),
        ask<Stats>({ type: "stats", days: 7 }),
      ]);
      setDash(d);
      setStats(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 5000);
    return () => clearInterval(id);
  }, [load]);

  const account = async (type: "signIn" | "signOut") => {
    setBusy(true);
    setError(null);
    try {
      await ask<AuthState>({ type });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!dash || !stats) {
    return <p className="p-10 text-center text-muted">{error ?? "Loading…"}</p>;
  }

  const today = stats.days.at(-1)!;
  const yesterday = stats.days.at(-2);
  const over = dash.sites.filter((s) => s.limit.enabled && s.usedMs >= s.limitMs);
  const enabled = dash.sites.filter((s) => s.limit.enabled);
  const week = siteTotals(stats.days);
  const weekMs = stats.days.reduce((n, d) => n + d.ms, 0);
  const weekSlaps = stats.days.reduce((n, d) => n + d.slaps, 0);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8 sm:py-12">
      <AccountHeader auth={dash.auth} busy={busy} onSignIn={() => void account("signIn")} onSignOut={() => void account("signOut")} />

      {error && (
        <p className="rounded-xl border-2 border-slap/40 bg-slap/5 px-3 py-2 text-sm text-slap" role="alert">
          {error}
        </p>
      )}

      <section aria-labelledby="today-h">
        <h2 id="today-h" className="mb-2 text-xs font-bold tracking-wide text-muted uppercase">
          Today
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Tile label="Time on limited sites" value={formatDuration(today.ms)}>
            {yesterday && <Delta todayMs={today.ms} yesterdayMs={yesterday.ms} />}
          </Tile>
          <Tile label="Slaps" value={String(today.slaps)}>
            <span className="text-muted">{weekSlaps} in the last 7 days</span>
          </Tile>
          <Tile label="Sites over the limit" value={`${over.length} of ${enabled.length}`}>
            <span className="text-muted">{over.length ? over.map((s) => s.limit.domain).join(", ") : "All under. Nice."}</span>
          </Tile>
        </div>
      </section>

      <Panel title="Today by site">
        {enabled.length === 0 ? (
          <p className="text-sm text-muted">No sites are being limited.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {[...enabled]
              .sort((a, b) => b.usedMs - a.usedMs)
              .map((s) => (
                <SiteMeter key={s.limit.domain} row={s} />
              ))}
          </ul>
        )}
      </Panel>

      <Panel title="Last 7 days" subtitle={`${formatDuration(weekMs)} on limited sites · ${weekSlaps} ${weekSlaps === 1 ? "slap" : "slaps"}`}>
        {weekMs === 0 ? (
          <p className="text-sm text-muted">Nothing yet. Your week will show up here as you browse.</p>
        ) : (
          <WeekChart days={stats.days} />
        )}
      </Panel>

      {week.length > 0 && (
        <Panel title="Last 7 days by site">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-1.5 font-semibold">Site</th>
                <th className="py-1.5 text-right font-semibold">Time</th>
                <th className="py-1.5 text-right font-semibold">Daily average</th>
                <th className="py-1.5 text-right font-semibold">Slaps</th>
              </tr>
            </thead>
            <tbody>
              {week.map((s) => (
                <tr key={s.domain} className="border-t border-line">
                  <td className="py-2 font-semibold">{s.domain}</td>
                  <td className="py-2 text-right">{formatDuration(s.ms)}</td>
                  <td className="py-2 text-right text-muted">{formatDuration(s.ms / stats.days.length)}</td>
                  <td className="py-2 text-right">{s.slaps}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      <p className="text-center text-xs text-muted">
        Stats are kept on this computer for 90 days{dash.auth.user ? " and backed up to your account" : ""}.
      </p>
    </main>
  );
}

function AccountHeader({
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
  const user = auth.user;
  return (
    <header className="flex flex-col gap-4 rounded-3xl border-[3px] border-ink bg-cream p-5 shadow-[6px_6px_0_var(--color-ink)] sm:flex-row sm:items-center">
      <img
        src={user?.avatarUrl ?? iconUrl}
        alt=""
        referrerPolicy="no-referrer"
        className="size-16 shrink-0 rounded-full border-2 border-ink bg-banana object-cover"
      />
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-2xl font-black">{user?.name ?? "Your profile"}</h1>
        <p className="truncate text-sm text-muted">
          {user ? `Signed in as ${user.email ?? user.name}` : "Not signed in. Everything is stored on this computer."}
        </p>
        {user && <SyncLine auth={auth} />}
      </div>
      {user ? (
        <button
          type="button"
          onClick={onSignOut}
          disabled={busy}
          className="shrink-0 rounded-xl border-2 border-line bg-white px-4 py-2 text-sm font-semibold hover:border-ink"
        >
          Sign out
        </button>
      ) : (
        <button
          type="button"
          onClick={onSignIn}
          disabled={busy || !auth.configured}
          title={auth.configured ? undefined : "Sign-in isn't set up yet"}
          className="flex shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-ink bg-white px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
        >
          <GoogleLogo /> {busy ? "Signing in…" : "Sign in with Google"}
        </button>
      )}
    </header>
  );
}

function SyncLine({ auth }: { auth: AuthState }) {
  if (auth.syncError) return <p className="text-xs text-slap">Couldn't back up just now. Will try again soon.</p>;
  if (!auth.lastSyncAt) return <p className="text-xs text-muted">Backing up…</p>;
  const mins = Math.floor((Date.now() - auth.lastSyncAt) / 60_000);
  return <p className="text-xs text-muted">✓ Backed up {mins < 1 ? "just now" : `${mins} min ago`}</p>;
}

function Tile({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-black">{value}</p>
      <p className="mt-1 text-xs">{children}</p>
    </div>
  );
}

/** Change vs yesterday. Less time is good, so "less" is green and "more" is red, always with words. */
function Delta({ todayMs, yesterdayMs }: { todayMs: number; yesterdayMs: number }) {
  const diff = todayMs - yesterdayMs;
  if (Math.abs(diff) < 60_000) return <span className="text-muted">About the same as yesterday</span>;
  return diff < 0 ? (
    <span className="font-semibold text-leaf">▼ {formatDuration(-diff)} less than yesterday</span>
  ) : (
    <span className="font-semibold text-slap">▲ {formatDuration(diff)} more than yesterday</span>
  );
}

function SiteMeter({ row }: { row: SiteRow }) {
  const { limit, usedMs, limitMs, slaps } = row;
  const pct = Math.min(100, (usedMs / limitMs) * 100);
  const over = usedMs >= limitMs;
  const near = !over && pct >= 80;
  const fill = over ? "bg-slap" : near ? "bg-amber" : "bg-leaf";
  return (
    <li>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold">{limit.domain}</span>
        <span className="text-muted">
          {formatDuration(usedMs)} of {formatDuration(limitMs)}
          {over && <b className="ml-1 text-ink">· over the limit</b>}
          {near && <b className="ml-1 text-ink">· almost there</b>}
          {slaps > 0 && <span className="ml-1">· 👋 {slaps}</span>}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-sand" aria-hidden>
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-4 sm:p-5">
      <h2 className="text-base font-bold">{title}</h2>
      {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}
