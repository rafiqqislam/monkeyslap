/**
 * THE CHARACTER CONTRACT
 *
 * The rest of the app never draws a character. It only asks for named moves.
 * Any artist, tool or format can replace the art as long as the pack provides
 * these moves. See docs/ARCHITECTURE.md for the brief to give a designer.
 */

/** Moves every character must have for the slap. */
export const REQUIRED_MOVES = ["idle", "enter", "windup", "slap", "taunt", "exit"] as const;

/** Moves reserved for future interactions. A pack may leave these out. */
export const OPTIONAL_MOVES = ["walk", "sit", "bark", "cheer"] as const;

export type Move = (typeof REQUIRED_MOVES)[number] | (typeof OPTIONAL_MOVES)[number];

/** How a pack is animated. Adding Lottie or Rive means writing one new renderer. */
export type RendererKind = "css-svg" | "lottie" | "rive";

/** Describes a character. Mirrors the character.json a designer would deliver. */
export interface CharacterManifest {
  id: string;
  name: string;
  renderer: RendererKind;
  /** Native size of the artwork; the app scales it to the screen. */
  size: { width: number; height: number };
  /**
   * Where the hand lands at the moment of impact, as fractions of the artwork
   * (0,0 = top-left, 1,1 = bottom-right). The app lines this point up with the
   * centre of the screen and puts the flash and handprint there.
   */
  hitPoint: { x: number; y: number };
  /** Which way the character faces in the artwork. It enters from the opposite side. */
  facing: "left" | "right";
  moves: readonly Move[];
  /** Sound per move: a file inside the pack, or "synth:<name>" for a built-in sound. */
  sounds?: Partial<Record<Move, string>>;
}

export interface PlayOptions {
  /** 1–3. Renderers may make the move faster or bigger at higher intensity. */
  intensity?: number;
}

/** A character placed on screen, ready to perform moves. */
export interface CharacterInstance {
  readonly manifest: CharacterManifest;
  /** The element to position on the stage. */
  readonly element: HTMLElement;
  /** CSS the stage must add (once) to the root that holds `element`. */
  readonly styles: string;
  /** Whether this character can perform `move`. */
  has(move: Move): boolean;
  /**
   * Performs a move. Resolves when it's finished (for looping moves like idle,
   * immediately). Asking for a move the pack doesn't have resolves at once.
   */
  play(move: Move, options?: PlayOptions): Promise<void>;
  destroy(): void;
}

export interface CreateOptions {
  /** Height of the character on screen, in CSS pixels. */
  heightPx: number;
}

/** A renderer turns a pack of one kind into an on-screen character. */
export interface Renderer<P extends CharacterPack = CharacterPack> {
  kind: RendererKind;
  create(pack: P, options: CreateOptions): CharacterInstance;
}

/** Packs drawn with inline SVG and animated with CSS keyframes. */
export interface CssSvgPack {
  manifest: CharacterManifest & { renderer: "css-svg" };
  svg: string;
  css: string;
  /** How long each move takes, in ms. Looping moves use 0. */
  durations: Partial<Record<Move, number>>;
}

/** Union of every pack format. Lottie and Rive packs will be added here. */
export type CharacterPack = CssSvgPack;
