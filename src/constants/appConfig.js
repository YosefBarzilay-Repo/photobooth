/**
 * @typedef {import("../types/app.js").Vector2} Vector2
 */

export const APP_STRINGS = {
  brandName: "SNAPBOOTH",
  cameraUnsupported: "This browser does not support camera access.",
  secureContextRequired:
    "Camera access requires a secure page. Open this app from http://localhost instead of the file directly.",
  previewLoadFailed: "Video element failed to load the camera stream.",
  previewLoadTimeout: "Timed out while waiting for the camera preview to become ready.",
  cameraAccessDenied: "Camera access was denied or is unavailable.",
  recordingFailed: "Unable to record video.",
  effectHintDisabled: "Choose a camera effect to enable directional zoom.",
  effectHintPicking: "Draw from the center toward the zoom direction.",
  effectHintIdle: "Draw from the center to choose the zoom direction."
};

export const APP_DEFAULTS = {
  mode: "camera",
  countdownSeconds: 3,
  recordingDurationSeconds: 6,
  cameraEffect: "none",
  cameraEffectSpeed: 1,
  cameraEffectDirection: /** @type {Vector2} */ ({ x: 0, y: -1 }),
  activeFrameId: "none",
  overlayText: APP_STRINGS.brandName,
  overlayFont: "Space Grotesk",
  overlayColor: "#ff88b5",
  overlaySize: 44,
  kenBurnsEnabled: false
};

export const APP_THRESHOLDS = {
  operatorAccessClickCount: 3,
  operatorAccessTimeoutMs: 900,
  videoReadyTimeoutMs: 5000,
  countdownLeadInMs: 220,
  postFlashDelayMs: 120,
  recordingProgressIntervalMs: 80,
  recorderChunkIntervalMs: 200,
  directionIgnoreRadiusPx: 8
};

export const CAMERA_CONFIG = {
  video: {
    facingMode: "user",
    width: { ideal: 1080 },
    height: { ideal: 1080 },
    aspectRatio: { ideal: 1 }
  },
  audio: false
};

export const EFFECT_CONFIG = {
  minSpeed: 0.1,
  phaseDivisor: 900,
  scaleRange: 0.18,
  zoomOutBaseScale: 0.82,
  maxOffsetRatio: 0.18,
  translateRangePx: 18
};

export const DOWNLOAD_CONFIG = {
  filePrefix: "snapbooth",
  fileExtension: "webm",
  fallbackMimeType: "video/webm",
  preferredMimeType: "video/webm;codecs=vp9,opus"
};
