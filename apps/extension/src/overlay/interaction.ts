import type { CharacterInstance } from "@monkeyslap/characters";
import type { InteractionId } from "@monkeyslap/core";
import type { SlapPayload } from "../shared/messages";
import type { CardChoice, Stage } from "./stage";

/**
 * An interaction is one on-screen experience: the slap today; later a bark
 * warning, a walking companion, a vocab quiz or a mini-game. Core decides which
 * one runs; the interaction decides how it plays out using the stage and the
 * character's named moves. Adding one never touches timers, storage or the
 * character art.
 */
export interface InteractionContext {
  stage: Stage;
  character: CharacterInstance;
  payload: SlapPayload;
}

export interface Interaction {
  id: InteractionId;
  run(ctx: InteractionContext): Promise<CardChoice>;
}
