import { playSound } from "@monkeyslap/characters";
import { formatDuration } from "@monkeyslap/core";
import type { Interaction } from "../interaction";
import type { CardOptions } from "../stage";

const TITLES: Record<1 | 2 | 3, string> = {
  1: "SLAP! Time's up.",
  2: "SLAP! Still here?",
  3: "SLAP!!! Seriously?",
};

function cardFor(payload: Parameters<Interaction["run"]>[0]["payload"]): CardOptions {
  const { decision, status, reslapMinutes, test } = payload;
  if (test) {
    return {
      title: "SLAP! That's the idea.",
      body: "This is what happens when you go over your daily limit on a site.",
      primary: { label: "Ha. Got it.", choice: "stay" },
    };
  }
  if (status?.firstSlap) {
    return {
      title: "SLAP! That was your first one.",
      body: `This is what happens when you go over your limit. From now on you get ${formatDuration(status.dailyLimitMs)} a day on ${status.domain} before the monkey comes back.`,
      primary: { label: "Get me out of here", choice: "leave" },
      secondary: { label: `Stay (slap again in ${reslapMinutes} min)`, choice: "stay" },
    };
  }
  const body = status
    ? `You've spent ${formatDuration(status.usedMs)} on ${status.domain} today. Your limit is ${formatDuration(status.limitMs)}.`
    : "You've hit your daily limit for this site.";
  return {
    title: TITLES[decision.intensity],
    body,
    note: decision.slapNumber > 1 ? `That's slap #${decision.slapNumber} today.` : undefined,
    primary: { label: "Get me out of here", choice: "leave" },
    secondary: {
      label: `Stay (slap again in ${reslapMinutes} min)`,
      choice: "stay",
    },
  };
}

export const slapInteraction: Interaction = {
  id: "slap",
  async run({ stage, character, payload }) {
    const { manifest } = character;
    const intensity = payload.decision.intensity;

    // Line the character up so its hand lands in the middle of the screen,
    // standing on the bottom edge.
    const el = character.element;
    const w = el.offsetWidth || parseFloat(el.style.width);
    const h = el.offsetHeight || parseFloat(el.style.height);
    const hitX = stage.width / 2;
    const left = hitX - manifest.hitPoint.x * w;
    const top = stage.height - h + h * 0.03;
    const hitY = top + manifest.hitPoint.y * h;
    stage.place(el, left, top);

    await character.play("enter");
    await character.play("windup", { intensity });
    await character.play("slap", { intensity });

    stage.impact(hitX, hitY, intensity);
    stage.shake(intensity);
    if (payload.sound) playSound(manifest.sounds?.slap, intensity);

    const taunt = character.play("taunt");
    const choice = await stage.showCard(cardFor(payload));
    await taunt;
    await character.play("exit");
    return choice;
  },
};
