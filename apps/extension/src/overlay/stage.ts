import stageCss from "./stage.css?raw";

export type CardChoice = "leave" | "stay";

export interface CardOptions {
  title: string;
  body: string;
  note?: string;
  primary?: { label: string; choice: CardChoice };
  secondary?: { label: string; choice: CardChoice };
}

const HANDPRINT_SVG = `
<svg viewBox="0 0 120 140" xmlns="http://www.w3.org/2000/svg">
  <g fill="currentColor">
    <ellipse cx="62" cy="92" rx="34" ry="38"/>
    <rect x="22" y="22" width="16" height="58" rx="8" transform="rotate(-14 30 50)"/>
    <rect x="42" y="8" width="16" height="66" rx="8" transform="rotate(-4 50 40)"/>
    <rect x="63" y="8" width="16" height="66" rx="8" transform="rotate(5 71 40)"/>
    <rect x="83" y="20" width="15" height="58" rx="7.5" transform="rotate(15 90 48)"/>
    <rect x="4" y="70" width="40" height="15" rx="7.5" transform="rotate(-38 24 78)"/>
  </g>
</svg>`;

/**
 * The full-screen layer the character performs on. Everything lives inside a
 * shadow root so the website's CSS can't break it, and it can't break the site.
 */
export class Stage {
  readonly host: HTMLElement;
  readonly layer: HTMLElement;
  private readonly root: ShadowRoot;
  private readonly styleIds = new Set<string>();

  constructor() {
    this.host = document.createElement("monkeyslap-stage");
    this.root = this.host.attachShadow({ mode: "closed" });
    this.addStyles("stage", stageCss);
    this.layer = document.createElement("div");
    this.layer.className = "layer";
    this.layer.innerHTML = `<div class="backdrop"></div>`;
    this.root.append(this.layer);
  }

  mount(): void {
    (document.body ?? document.documentElement).append(this.host);
  }

  /** Adds a stylesheet once (e.g. the character's CSS). */
  addStyles(id: string, css: string): void {
    if (this.styleIds.has(id)) return;
    this.styleIds.add(id);
    const style = document.createElement("style");
    style.textContent = css;
    this.root.append(style);
  }

  get width(): number {
    return window.innerWidth;
  }
  get height(): number {
    return window.innerHeight;
  }

  place(el: HTMLElement, left: number, top: number): void {
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    this.layer.append(el);
  }

  /** Shakes the whole web page. Stronger at higher intensity. */
  shake(intensity: number): void {
    const a = 6 + intensity * 6;
    const target = document.documentElement;
    try {
      target.animate(
        [
          { transform: "translate(0,0)" },
          { transform: `translate(${-a}px, ${a * 0.4}px) rotate(-0.6deg)` },
          { transform: `translate(${a * 0.8}px, ${-a * 0.3}px) rotate(0.5deg)` },
          { transform: `translate(${-a * 0.5}px, ${a * 0.2}px)` },
          { transform: `translate(${a * 0.25}px, 0)` },
          { transform: "translate(0,0)" },
        ],
        { duration: 380 + intensity * 60, easing: "ease-out" },
      );
    } catch {
      // Some pages lock down animations; the slap still works without the shake.
    }
  }

  /** The impact: a flash, a "SLAP!" burst and a handprint where the hand landed. */
  impact(x: number, y: number, intensity: number, word = "SLAP!"): void {
    const flash = document.createElement("div");
    flash.className = "flash";
    flash.style.setProperty("--x", `${x}px`);
    flash.style.setProperty("--y", `${y}px`);
    this.layer.append(flash);
    setTimeout(() => flash.remove(), 600);

    const print = document.createElement("div");
    print.className = "handprint";
    print.innerHTML = HANDPRINT_SVG;
    print.style.left = `${x}px`;
    print.style.top = `${y}px`;
    print.style.setProperty("--size", `${140 + intensity * 30}px`);
    this.layer.append(print);

    const burst = document.createElement("div");
    burst.className = `burst burst-${intensity}`;
    burst.textContent = word;
    burst.style.left = `${x}px`;
    burst.style.top = `${y - 90}px`;
    this.layer.append(burst);
    setTimeout(() => burst.remove(), 1400);
  }

  /** Shows the message card and resolves with the button the user picks. */
  showCard(opts: CardOptions): Promise<CardChoice> {
    const card = document.createElement("div");
    card.className = "card";
    card.setAttribute("role", "alertdialog");
    card.setAttribute("aria-modal", "true");

    const h = document.createElement("h2");
    h.textContent = opts.title;
    const p = document.createElement("p");
    p.textContent = opts.body;
    card.append(h, p);
    if (opts.note) {
      const n = document.createElement("p");
      n.className = "note";
      n.textContent = opts.note;
      card.append(n);
    }

    const actions = document.createElement("div");
    actions.className = "actions";
    card.append(actions);
    this.layer.append(card);

    return new Promise((resolve) => {
      const add = (btn: CardOptions["primary"], cls: string) => {
        if (!btn) return null;
        const b = document.createElement("button");
        b.className = cls;
        b.textContent = btn.label;
        b.addEventListener("click", () => {
          card.classList.add("leaving");
          resolve(btn.choice);
        });
        actions.append(b);
        return b;
      };
      const first = add(opts.primary, "primary");
      add(opts.secondary, "secondary");
      setTimeout(() => first?.focus({ preventScroll: true }), 50);
    });
  }

  fadeOut(): Promise<void> {
    this.layer.classList.add("closing");
    return new Promise((r) => setTimeout(r, 250));
  }

  destroy(): void {
    this.host.remove();
  }
}
