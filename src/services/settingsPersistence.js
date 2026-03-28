/**
 * @typedef {import("../types/app.js").AppState} AppState
 */

const STORAGE_KEY = "photobooth.operatorSettings.v1";

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneVector(value, fallback) {
  if (!isObject(value)) {
    return { ...fallback };
  }

  const x = Number(value.x);
  const y = Number(value.y);
  return {
    x: Number.isFinite(x) ? x : fallback.x,
    y: Number.isFinite(y) ? y : fallback.y
  };
}

export function loadPersistedSettings() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function applyPersistedSettings(state, defaults, savedSettings) {
  if (!isObject(savedSettings)) {
    return;
  }

  state.countdownSeconds = Number.isFinite(savedSettings.countdownSeconds) ? savedSettings.countdownSeconds : defaults.countdownSeconds;
  state.slideshowIdleSeconds = Number.isFinite(savedSettings.slideshowIdleSeconds) ? savedSettings.slideshowIdleSeconds : defaults.slideshowIdleSeconds;
  state.activeFrameId = typeof savedSettings.activeFrameId === "string" ? savedSettings.activeFrameId : defaults.activeFrameId;
  state.overlayText = typeof savedSettings.overlayText === "string" ? savedSettings.overlayText : defaults.overlayText;
  state.overlayFont = typeof savedSettings.overlayFont === "string" ? savedSettings.overlayFont : defaults.overlayFont;
  state.overlayColor = typeof savedSettings.overlayColor === "string" ? savedSettings.overlayColor : defaults.overlayColor;
  state.overlaySize = Number.isFinite(savedSettings.overlaySize) ? savedSettings.overlaySize : defaults.overlaySize;
  state.overlayTextPosition = cloneVector(savedSettings.overlayTextPosition, defaults.overlayTextPosition);
  state.overlayTextRotation = Number.isFinite(savedSettings.overlayTextRotation) ? savedSettings.overlayTextRotation : defaults.overlayTextRotation;
  state.logoDataUrl = typeof savedSettings.logoDataUrl === "string" ? savedSettings.logoDataUrl : defaults.logoDataUrl;
  state.logoScale = Number.isFinite(savedSettings.logoScale) ? savedSettings.logoScale : defaults.logoScale;
  state.logoRotation = Number.isFinite(savedSettings.logoRotation) ? savedSettings.logoRotation : defaults.logoRotation;
  state.logoPosition = cloneVector(savedSettings.logoPosition, defaults.logoPosition);
  state.saveDirectoryPath = typeof savedSettings.saveDirectoryPath === "string" ? savedSettings.saveDirectoryPath : "";
  state.saveDirectoryName = typeof savedSettings.saveDirectoryName === "string" && savedSettings.saveDirectoryName.trim()
    ? savedSettings.saveDirectoryName
    : defaults.saveFolderDefault;

  if (state.overlayText) {
    state.activeOverlayTarget = "text";
  } else if (state.logoDataUrl) {
    state.activeOverlayTarget = "logo";
  } else {
    state.activeOverlayTarget = defaults.activeOverlayTarget;
  }
}

export function persistSettings(state) {
  const snapshot = {
    countdownSeconds: state.countdownSeconds,
    slideshowIdleSeconds: state.slideshowIdleSeconds,
    activeFrameId: state.activeFrameId,
    overlayText: state.overlayText,
    overlayFont: state.overlayFont,
    overlayColor: state.overlayColor,
    overlaySize: state.overlaySize,
    overlayTextPosition: state.overlayTextPosition,
    overlayTextRotation: state.overlayTextRotation,
    logoDataUrl: state.logoDataUrl,
    logoScale: state.logoScale,
    logoRotation: state.logoRotation,
    logoPosition: state.logoPosition,
    saveDirectoryPath: state.saveDirectoryPath,
    saveDirectoryName: state.saveDirectoryName
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}
