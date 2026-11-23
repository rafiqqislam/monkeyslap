import type { CssSvgPack, CharacterManifest } from "../../types";
import manifest from "./character.json";
import svg from "./monkey.svg?raw";
import css from "./monkey.css?raw";

export const monkey: CssSvgPack = {
  manifest: manifest as CharacterManifest & { renderer: "css-svg" },
  svg,
  css,
  durations: {
    idle: 0,
    enter: 520,
    windup: 380,
    slap: 150,
    taunt: 1200,
    exit: 420,
  },
};
