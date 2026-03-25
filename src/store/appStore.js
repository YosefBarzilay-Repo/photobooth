import { APP_DEFAULTS } from "../constants/appConfig.js";

/**
 * @typedef {import("../types/app.js").AppState} AppState
 */

/**
 * @returns {AppState}
 */
export default function createAppStore() {
  return {
    mode: APP_DEFAULTS.mode,
    operatorPanelOpen: false,
    stream: null,
    recorder: null,
    recordingBlob: null,
    recordingUrl: "",
    recordingChunks: [],
    captureReady: false,
    captureInProgress: false,
    shutterAnimatingOut: false,
    countdownSeconds: APP_DEFAULTS.countdownSeconds,
    recordingDurationSeconds: APP_DEFAULTS.recordingDurationSeconds,
    cameraEffect: APP_DEFAULTS.cameraEffect,
    cameraEffectSpeed: APP_DEFAULTS.cameraEffectSpeed,
    cameraEffectDirection: { ...APP_DEFAULTS.cameraEffectDirection },
    settingEffectDirection: false,
    recordIntervalId: null,
    recordStopTimeoutId: null,
    recordStartedAt: 0,
    activeFrameId: APP_DEFAULTS.activeFrameId,
    overlayText: APP_DEFAULTS.overlayText,
    overlayFont: APP_DEFAULTS.overlayFont,
    overlayColor: APP_DEFAULTS.overlayColor,
    overlaySize: APP_DEFAULTS.overlaySize
  };
}
