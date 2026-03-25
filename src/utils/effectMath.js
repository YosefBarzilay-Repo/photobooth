import { EFFECT_CONFIG } from "../constants/appConfig.js";

/**
 * @typedef {import("../types/app.js").CameraEffect} CameraEffect
 * @typedef {import("../types/app.js").Vector2} Vector2
 */

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * @param {CameraEffect} effect
 * @param {number} speed
 * @param {number} timestamp
 * @returns {number}
 */
export function getEffectScale(effect, speed, timestamp = performance.now()) {
  const normalizedSpeed = Math.max(speed, EFFECT_CONFIG.minSpeed);
  const phase = timestamp / (EFFECT_CONFIG.phaseDivisor / normalizedSpeed);
  const animatedRange = ((Math.sin(phase) + 1) / 2) * EFFECT_CONFIG.scaleRange;

  if (effect === "zoom-in") {
    return 1 + animatedRange;
  }

  if (effect === "zoom-out") {
    return EFFECT_CONFIG.zoomOutBaseScale + animatedRange;
  }

  return 1;
}

/**
 * @param {number} effectScale
 * @param {CameraEffect} effect
 * @returns {number}
 */
export function getEffectProgress(effectScale, effect) {
  if (effect === "zoom-in") {
    return clamp((effectScale - 1) / EFFECT_CONFIG.scaleRange, 0, 1);
  }

  if (effect === "zoom-out") {
    return clamp((1 - effectScale) / EFFECT_CONFIG.scaleRange, 0, 1);
  }

  return 0;
}

/**
 * @param {number} width
 * @param {number} height
 * @param {number} effectScale
 * @param {CameraEffect} effect
 * @param {Vector2} direction
 * @returns {Vector2}
 */
export function getEffectFocusPoint(width, height, effectScale, effect, direction) {
  const centerX = width / 2;
  const centerY = height / 2;
  const progress = getEffectProgress(effectScale, effect);
  const maxOffsetX = width * EFFECT_CONFIG.maxOffsetRatio;
  const maxOffsetY = height * EFFECT_CONFIG.maxOffsetRatio;

  return {
    x: centerX + direction.x * maxOffsetX * progress,
    y: centerY + direction.y * maxOffsetY * progress
  };
}

/**
 * @param {HTMLVideoElement} video
 * @param {CameraEffect} effect
 * @param {number} speed
 * @param {Vector2} direction
 * @param {number} timestamp
 */
export function applyVideoEffectStyles(video, effect, speed, direction, timestamp = performance.now()) {
  if (effect === "none") {
    video.style.transform = "scaleX(-1)";
    return;
  }

  const scale = getEffectScale(effect, speed, timestamp);
  const focus = getEffectFocusPoint(1, 1, scale, effect, direction);
  const offsetX = (focus.x - 0.5) * EFFECT_CONFIG.translateRangePx;
  const offsetY = (focus.y - 0.5) * EFFECT_CONFIG.translateRangePx;

  video.style.transform = `scaleX(-1) scale(${scale}) translate(${offsetX}px, ${offsetY}px)`;
}
