export const APP_STRINGS = {
  brandName: "SNAPBOOTH",
  cameraUnsupported: "This browser does not support camera access.",
  secureContextRequired:
    "Camera access requires a secure page. Open this app from http://localhost instead of the file directly.",
  previewLoadFailed: "Video element failed to load the camera stream.",
  previewLoadTimeout: "Timed out while waiting for the camera preview to become ready.",
  cameraAccessDenied: "Camera access was denied or is unavailable.",
  recordingFailed: "Unable to record video."
};

export const APP_DEFAULTS = {
  mode: "camera",
  countdownSeconds: 3,
  recordingDurationSeconds: 6,
  activeFrameId: "none",
  activeOverlayTarget: "text",
  overlayText: APP_STRINGS.brandName,
  overlayFont: "Space Grotesk",
  overlayColor: "#ff88b5",
  overlaySize: 44,
  overlayTextPosition: { x: 50, y: 84 },
  overlayTextRotation: 0,
  logoDataUrl: "",
  logoScale: 1,
  logoRotation: 0,
  logoPosition: { x: 50, y: 20 }
};

export const APP_THRESHOLDS = {
  operatorAccessClickCount: 3,
  operatorAccessTimeoutMs: 900,
  videoReadyTimeoutMs: 5000,
  countdownLeadInMs: 220,
  postFlashDelayMs: 120,
  recordingProgressIntervalMs: 80,
  recorderChunkIntervalMs: 200,
  overlayRotationStep: 8,
  textResizeStep: 6,
  logoScaleStep: 0.12,
  minLogoScale: 0.3,
  maxLogoScale: 3,
  minOverlayY: 8,
  maxOverlayY: 92,
  minOverlayX: 8,
  maxOverlayX: 92
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

export const DOWNLOAD_CONFIG = {
  filePrefix: "snapbooth",
  fileExtension: "webm",
  fallbackMimeType: "video/webm",
  preferredMimeType: "video/webm;codecs=vp9,opus"
};