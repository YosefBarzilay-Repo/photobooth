export const APP_STRINGS = {
  brandName: "ECHO",
  cameraUnsupported: "This browser does not support camera access.",
  secureContextRequired:
    "Camera access requires a secure page. Open this app from http://localhost instead of the file directly.",
  previewLoadFailed: "Video element failed to load the camera stream.",
  previewLoadTimeout: "Timed out while waiting for the camera preview to become ready.",
  cameraAccessDenied: "Camera access was denied or is unavailable.",
  recordingFailed: "Unable to record video.",
  folderUnsupported: "Echo could not open the save-folder picker on this device.",
  saveFolderDefault: "Default save location",
  projectNameRequired: "Enter a project name to create a new folder.",
  projectNameInvalid: "Use only letters, numbers, spaces, periods, and hyphens in the project name.",
  projectNameExists: "A project folder with that name already exists. Choose a different name.",
  projectCreateFailed: "Echo could not create the project folder.",
  openFolderUnavailable: "Echo could not open the gallery folder from this device.",
  noMediaDevices: "No media input devices were found on this machine."
};

export const VIDEO_FILE_EXTENSIONS = [".mp4", ".webm", ".mov", ".m4v", ".ogg"];

export const APP_DEFAULTS = {
  mode: "editor",
  countdownSeconds: 3,
  recordingTimeoutSeconds: 0,
  captureOrientation: "landscape",
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
  logoPosition: { x: 50, y: 20 },
  slideshowSoundEnabled: false,
  slideshowAudioOutputId: "",
  slideshowFadeDurationMs: 600,
  mainWindowMonitorId: "",
  mainWindowFullscreen: true,
  slideshowMonitorId: "",
  slideshowFullscreen: true,
  videoInputId: "",
  audioInputId: ""
};

export const APP_THRESHOLDS = {
  operatorAccessClickCount: 3,
  operatorAccessTimeoutMs: 900,
  desktopApiTimeoutMs: 4000,
  videoReadyTimeoutMs: 5000,
  countdownLeadInMs: 220,
  postFlashDelayMs: 120,
  recorderChunkIntervalMs: 200,
  recordingTimerIntervalMs: 250,
  minLogoScale: 0.3,
  minTextSize: 20,
  minOverlayY: 6,
  maxOverlayY: 94,
  minOverlayX: 6,
  maxOverlayX: 94,
  dialogMinWidth: 360,
  dialogMinHeight: 420,
  dialogDefaultWidth: 420,
  dialogDefaultHeight: 960,
  dialogEdgeMargin: 24,
  composedLandscapeWidth: 1920,
  composedLandscapeHeight: 1080,
  composedPortraitWidth: 1080,
  composedPortraitHeight: 1920,
  composedFps: 30
};

export const CAMERA_CONFIG = {
  video: {
    facingMode: "user",
    width: { ideal: 1920, min: 1280 },   
    height: { ideal: 1080, min: 720 },
    frameRate: { ideal: 30, min: 24 },
    aspectRatio: { ideal: 16 / 9 }
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  }
};

export const DISABLED_AUDIO_INPUT_ID = "__none__";

export const DOWNLOAD_CONFIG = {
  preferredMimeTypes: [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4;codecs=h264,aac",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
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
