import { monkey } from "./packs/monkey";
import { cssSvgRenderer } from "./renderers/css-svg";
import type { CharacterInstance, CharacterManifest, CharacterPack, CreateOptions } from "./types";

/** Packs bundled with the app. Later, more can be downloaded (art and data only). */
const PACKS: Record<string, CharacterPack> = {
  [monkey.manifest.id]: monkey,
};

export const DEFAULT_CHARACTER_ID = "monkey";

export function listCharacters(): CharacterManifest[] {
  return Object.values(PACKS).map((p) => p.manifest);
}

/** The pack for `id`, falling back to the monkey if it isn't installed. */
export function getPack(id: string | undefined): CharacterPack {
  return (id && PACKS[id]) || monkey;
}

/** Creates an on-screen character, picking the renderer the pack was made for. */
export function createCharacter(pack: CharacterPack, options: CreateOptions): CharacterInstance {
  switch (pack.manifest.renderer) {
    case "css-svg":
      return cssSvgRenderer.create(pack, options);
    default:
      throw new Error(`No renderer for "${String(pack.manifest.renderer)}" yet`);
  }
}
