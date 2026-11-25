import { monkey } from "@monkeyslap/characters";
import { DEFAULT_DAILY_MINUTES, DEFAULT_SITES, FIRST_SLAP_MINUTES } from "@monkeyslap/core";
import { useEffect, useState } from "react";
import { GoogleLogo } from "../shared/GoogleLogo";
import { ask, type AuthState, type Dashboard } from "../shared/messages";

/**
 * Opens in a tab right after install: explains how MonkeySlap works and offers
 * optional Google sign-in (to back up and sync), with "Skip for now".
 */

type Step = "account" | "done";

export function Welcome() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [step, setStep] = useState<Step>("account");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ask<Dashboard>({ type: "dashboard" })
      .then((d) => {
        setAuth(d.auth);
        if (d.auth.user) setStep("done");
      })
      .catch((e: unknown) => setError(String(e)));
  }, []);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    try {
      setAuth(await ask<AuthState>({ type: "signIn" }));
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const tryIt = () =>
    void chrome.tabs.create({ url: chrome.runtime.getURL("src/demo/index.html?slap=1") });

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:py-16">
      <header className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <div
          className="h-40 w-30 shrink-0 [&_svg]:h-full [&_svg]:w-full"
          aria-hidden
          // The same artwork the slap uses, shown still.
          dangerouslySetInnerHTML={{ __html: monkey.svg }}
        />
        <div>
          <p className="text-sm font-bold tracking-wide text-slap uppercase">MonkeySlap is installed</p>
          <h1 className="mt-1 text-4xl leading-tight font-black sm:text-5xl">Scroll less, or get slapped.</h1>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="How it works">
        <Card n={1} title={`${DEFAULT_SITES.length} sites, ${DEFAULT_DAILY_MINUTES} minutes a day`}>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {DEFAULT_SITES.map((s) => (
              <li key={s} className="rounded-full border border-line bg-cream px-2 py-0.5 text-xs font-semibold">
                {s}
              </li>
            ))}
          </ul>
        </Card>
        <Card n={2} title="Go over, get slapped">
          <p className="mt-1 text-sm text-muted">
            Your <b className="text-ink">first slap comes after just {FIRST_SLAP_MINUTES} minute</b>, so you can see it.
            After that, the monkey waits for your real limit.
          </p>
        </Card>
        <Card n={3} title="You decide the rest">
          <p className="mt-1 text-sm text-muted">
            Click the puzzle piece in Chrome's toolbar and <b className="text-ink">pin MonkeySlap</b> to change limits
            or switch sites off. <b className="text-ink">Want another site limited?</b> Add it there, and Chrome asks
            your permission for that site only. MonkeySlap never sees any other site.
          </p>
        </Card>
      </section>

      <section className="rounded-3xl border-[3px] border-ink bg-cream p-6 shadow-[8px_8px_0_var(--color-ink)]">
        {step === "account" ? (
          <AccountStep
            configured={auth?.configured ?? false}
            loading={!auth}
            busy={busy}
            onSignIn={() => void signIn()}
            onSkip={() => setStep("done")}
          />
        ) : (
          <DoneStep auth={auth} onTry={tryIt} />
        )}
        {error && (
          <p className="mt-4 rounded-xl border-2 border-slap/40 bg-slap/5 px-3 py-2 text-sm text-slap" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}

function Card({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <span className="grid size-7 place-items-center rounded-full bg-banana text-sm font-black">{n}</span>
      <h2 className="mt-2 text-base leading-snug font-bold">{title}</h2>
      {children}
    </div>
  );
}

function AccountStep({
  configured,
  loading,
  busy,
  onSignIn,
  onSkip,
}: {
  configured: boolean;
  loading: boolean;
  busy: boolean;
  onSignIn: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-md">
        <h2 className="text-2xl font-black">Back up your progress</h2>
        <p className="mt-1 text-muted">
          Sign in to keep your sites, limits and history safe, and bring them to another computer. It's optional:
          MonkeySlap works fully without an account.
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:w-56">
        <button
          type="button"
          onClick={onSignIn}
          disabled={busy || loading || !configured}
          title={configured ? undefined : "Sign-in isn't set up yet"}
          className="flex items-center justify-center gap-2 rounded-xl border-2 border-ink bg-white px-4 py-3 font-bold shadow-[3px_3px_0_var(--color-ink)] transition hover:-translate-px disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          <GoogleLogo /> {busy ? "Signing in…" : "Sign in with Google"}
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={busy}
          className="rounded-xl px-4 py-2.5 font-semibold text-muted hover:bg-sand hover:text-ink"
        >
          Skip for now
        </button>
        {!loading && !configured && (
          <p className="text-center text-xs text-muted">Sign-in isn't available yet.</p>
        )}
      </div>
    </div>
  );
}

function DoneStep({ auth, onTry }: { auth: AuthState | null; onTry: () => void }) {
  const user = auth?.user;
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-md">
        <h2 className="text-2xl font-black">You're all set{user?.name ? `, ${user.name.split(" ")[0]}` : ""}.</h2>
        <p className="mt-1 text-muted">
          {user
            ? `Signed in as ${user.email ?? user.name}. Your progress is backed up automatically.`
            : "You can sign in any time from the MonkeySlap menu in the toolbar."}{" "}
          Now go scroll somewhere you shouldn't, or see the slap right now.
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:w-56">
        <button
          type="button"
          onClick={onTry}
          className="rounded-xl border-2 border-ink bg-banana px-4 py-3 font-bold shadow-[3px_3px_0_var(--color-ink)] transition hover:-translate-px"
        >
          Show me the slap 👋
        </button>
        <button
          type="button"
          onClick={() =>
            void chrome.tabs.getCurrent().then((t) => {
              if (t?.id) void chrome.tabs.remove(t.id);
            })
          }
          className="rounded-xl px-4 py-2.5 font-semibold text-muted hover:bg-sand hover:text-ink"
        >
          Close this tab
        </button>
      </div>
    </div>
  );
}
