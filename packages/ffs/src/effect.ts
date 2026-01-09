import type { EffieEffect } from "@effing/effie";

function processFadeIn(
  effect: Extract<EffieEffect, { type: "fade-in" }>,
  _frameRate: number,
  _frameWidth: number,
  _frameHeight: number,
): string {
  return `fade=t=in:st=${effect.start}:d=${effect.duration}:alpha=1`;
}

function processFadeOut(
  effect: Extract<EffieEffect, { type: "fade-out" }>,
  _frameRate: number,
  _frameWidth: number,
  _frameHeight: number,
): string {
  return `fade=t=out:st=${effect.start}:d=${effect.duration}:alpha=1`;
}

function processSaturateIn(
  effect: Extract<EffieEffect, { type: "saturate-in" }>,
  _frameRate: number,
  _frameWidth: number,
  _frameHeight: number,
): string {
  return `hue='s=max(0,min(1,(t-${effect.start})/${effect.duration}))'`;
}

function processSaturateOut(
  effect: Extract<EffieEffect, { type: "saturate-out" }>,
  _frameRate: number,
  _frameWidth: number,
  _frameHeight: number,
): string {
  return `hue='s=max(0,min(1,(${effect.start + effect.duration}-t)/${effect.duration}))'`;
}

function processScroll(
  effect: Extract<EffieEffect, { type: "scroll" }>,
  frameRate: number,
  _frameWidth: number,
  _frameHeight: number,
): string {
  const distance = effect.distance ?? 1;
  const scroll = distance / (1 + distance);
  const speed = scroll / (effect.duration * frameRate);
  switch (effect.direction) {
    case "left":
      return `scroll=h=${speed}`;
    case "right":
      return `scroll=hpos=${1 - scroll}:h=-${speed}`;
    case "up":
      return `scroll=v=${speed}`;
    case "down":
      return `scroll=vpos=${1 - scroll}:v=-${speed}`;
  }
}

function processEffect(
  effect: EffieEffect,
  frameRate: number,
  frameWidth: number,
  frameHeight: number,
): string {
  switch (effect.type) {
    case "fade-in":
      return processFadeIn(effect, frameRate, frameWidth, frameHeight);
    case "fade-out":
      return processFadeOut(effect, frameRate, frameWidth, frameHeight);
    case "saturate-in":
      return processSaturateIn(effect, frameRate, frameWidth, frameHeight);
    case "saturate-out":
      return processSaturateOut(effect, frameRate, frameWidth, frameHeight);
    case "scroll":
      return processScroll(effect, frameRate, frameWidth, frameHeight);
    default:
      effect satisfies never;
      throw new Error(
        `Unsupported effect type: ${(effect as EffieEffect).type}`,
      );
  }
}

export function processEffects(
  effects: EffieEffect[] | undefined,
  frameRate: number,
  frameWidth: number,
  frameHeight: number,
): string {
  if (!effects || effects.length === 0) return "";

  const filters: string[] = [];

  for (const effect of effects) {
    const filter = processEffect(effect, frameRate, frameWidth, frameHeight);
    filters.push(filter);
  }

  return filters.join(",");
}
