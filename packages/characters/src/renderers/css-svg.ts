import type { CharacterInstance, CreateOptions, CssSvgPack, Move, PlayOptions, Renderer } from "../types";

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Animates a pack made of inline SVG + CSS keyframes, by switching data-move on the root. */
export const cssSvgRenderer: Renderer<CssSvgPack> = {
  kind: "css-svg",
  create(pack: CssSvgPack, { heightPx }: CreateOptions): CharacterInstance {
    const { manifest } = pack;
    const scale = heightPx / manifest.size.height;

    const element = document.createElement("div");
    element.className = "ms-root";
    element.style.width = `${manifest.size.width * scale}px`;
    element.style.height = `${heightPx}px`;
    // Enter from the side the character's back faces, i.e. opposite to `facing`.
    element.style.setProperty("--ms-offstage", manifest.facing === "left" ? "130vw" : "-130vw");
    element.innerHTML = pack.svg;

    let destroyed = false;
    let token = 0;

    return {
      manifest,
      element,
      styles: pack.css,
      has: (move: Move) => manifest.moves.includes(move),
      async play(move: Move, options: PlayOptions = {}) {
        if (destroyed || !manifest.moves.includes(move)) return;
        const intensity = Math.min(3, Math.max(1, options.intensity ?? 1));
        const baseSlap = pack.durations.slap ?? 150;
        const slapMs = Math.round(baseSlap / (1 + (intensity - 1) * 0.25));
        element.style.setProperty("--ms-slap-ms", `${slapMs}ms`);

        const mine = ++token;
        // Restart the CSS animation even when the same move is played twice in a row.
        element.removeAttribute("data-move");
        void element.offsetWidth;
        element.setAttribute("data-move", move);

        const duration = move === "slap" ? slapMs : (pack.durations[move] ?? 0);
        if (duration > 0) await wait(duration);
        // If another move started meanwhile, that one owns the element now.
        if (mine !== token) return;
      },
      destroy() {
        destroyed = true;
        element.remove();
      },
    };
  },
};
