import { createCharacter, getPack } from "@monkeyslap/characters";
import type { InteractionId } from "@monkeyslap/core";
import type { SlapPayload } from "../shared/messages";
import type { Interaction } from "./interaction";
import { slapInteraction } from "./interactions/slap";
import { Stage, type CardChoice } from "./stage";

/** Every interaction the overlay knows how to run. Add new ones here. */
const INTERACTIONS: Record<InteractionId, Interaction> = {
  slap: slapInteraction,
};

let running = false;

export function isRunning(): boolean {
  return running;
}

/** Shows the interaction the background decided on. Ignores calls while one is on screen. */
export async function runInteraction(payload: SlapPayload): Promise<CardChoice | null> {
  if (running) return null;
  running = true;
  const stage = new Stage();
  try {
    const pack = getPack(payload.characterId);
    const heightPx = Math.min(
      window.innerHeight * 0.95,
      Math.min(window.innerHeight * 0.7, 540) * payload.characterScale,
    );
    const character = createCharacter(pack, { heightPx });
    stage.addStyles(`character:${pack.manifest.id}`, character.styles);
    stage.mount();

    const interaction = INTERACTIONS[payload.decision.interaction];
    const choice = await interaction.run({ stage, character, payload });
    await stage.fadeOut();
    character.destroy();
    return choice;
  } finally {
    stage.destroy();
    running = false;
  }
}
