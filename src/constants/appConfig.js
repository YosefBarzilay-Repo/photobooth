export const APP_STRINGS = {
  brandName: "SNAPBOOTH",
  cameraUnsupported: "This browser does not support camera access.",
  secureContextRequired:
    "Camera access requires a secure page. Open this app from http://localhost instead of the file directly.",
  previewLoadFailed: "Video element failed to load the camera stream.",
  previewLoadTimeout: "Timed out while waiting for the camera preview to become ready.",
  cameraAccessDenied: "Camera access was denied or is unavailable.",
  recordingFailed: "Unable to record video.",
  folderUnsupported: "This browser does not support choosing a save folder.",
  saveFolderDefault: "Browser default downloads"
};

export const APP_DEFAULTS = {
  mode: "camera",
  countdownSeconds: 3,
  slideshowIdleSeconds: 0,
  activeFrameId: "none",
  activeOverlayTarget: null,
  showTextColorPalette: false,
  overlayText: "",
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
  recorderChunkIntervalMs: 200,
  recordingTimerIntervalMs: 250,
  overlayRotationStep: 8,
  minLogoScale: 0.3,
  maxLogoScale: 3,
  minTextSize: 20,
  maxTextSize: 180,
  minOverlayY: 6,
  maxOverlayY: 94,
  minOverlayX: 6,
  maxOverlayX: 94,
  minSlideshowIdleSeconds: 0,
  maxSlideshowIdleSeconds: 600,
  dialogMinWidth: 360,
  dialogMinHeight: 420,
  dialogDefaultWidth: 420,
  dialogDefaultHeight: 960,
  dialogEdgeMargin: 24,
  composedWidth: 1280,
  composedHeight: 720,
  composedFps: 30
};

export const CAMERA_CONFIG = {
  video: {
    facingMode: "user",
    width: { ideal: 1280 },
    height: { ideal: 720 },
    aspectRatio: { ideal: 16 / 9 }
  },
  audio: false
};

export const DOWNLOAD_CONFIG = {
  preferredMimeTypes: [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm"
  ],
  defaultFileExtension: "mp4",
  fallbackFileExtension: "webm"
};

export const TEXT_COLOR_SWATCHES = [
  "#ffffff",
  "#ff88b5",
  "#ffd36e",
  "#90f4de",
  "#5ddcff",
  "#c7b8ff",
  "#1b2533",
  "#000000"
];
