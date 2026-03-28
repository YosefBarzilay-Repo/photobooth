import createAppStore from "../store/appStore.js";
import createDomRefs from "./dom.js";
import createCameraScreen from "../screens/cameraScreen.js";
import createEditorScreen from "../screens/editorScreen.js";
import createOperatorScreen from "../screens/operatorScreen.js";
import wireEvents from "./events.js";
import { APP_STRINGS, APP_THRESHOLDS } from "../constants/appConfig.js";
import { sleep, clearIntervalTimer, clearTimer } from "../utils/timing.js";
import { startCameraStream, stopCameraStream } from "../services/cameraService.js";
import { createMediaRecorder, createRecordingBlob } from "../services/recordingService.js";
import { createObjectUrl, revokeObjectUrl, downloadRecording } from "../services/downloadService.js";

/**
 * @param {HTMLElement} element
 * @param {string} className
 */
function restartAnimation(element, className) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

async function requestFullscreenIfPossible() {
  if (!document.fullscreenEnabled || document.fullscreenElement) {
    return;
  }

  const root = document.documentElement;
  const requestFullscreen = root.requestFullscreen?.bind(root);

  if (!requestFullscreen) {
    return;
  }

  try {
    await requestFullscreen();
  } catch {
    // Ignore browser rejections; a later user gesture may allow fullscreen.
  }
}

export default function initApp() {
  const state = createAppStore();
  const dom = createDomRefs();
  const cameraScreen = createCameraScreen(dom, state);
  const editorScreen = createEditorScreen(dom, state);
  const operatorScreen = createOperatorScreen(dom, state, editorScreen);

  function syncModeUi() {
    cameraScreen.syncModeUi();
  }

  function stopRecordingTimers() {
    clearIntervalTimer(state.recordIntervalId);
    clearTimer(state.recordStopTimeoutId);
    state.recordIntervalId = null;
    state.recordStopTimeoutId = null;
  }

  function updateRecordingProgress() {
    const elapsed = Date.now() - state.recordStartedAt;
    const total = state.recordingDurationSeconds * 1000;
    const progress = Math.max(0, Math.min(1, elapsed / total));
    dom.recordingProgress.style.width = `${progress * 100}%`;
  }

  function flash() {
    restartAnimation(dom.flashOverlay, "flash-active");
  }

  async function runCountdown() {
    if (state.countdownSeconds <= 0) {
      return;
    }

    await sleep(APP_THRESHOLDS.countdownLeadInMs);
    state.shutterAnimatingOut = false;
    syncModeUi();
    dom.countdownOverlay.classList.remove("hidden");

    for (let number = state.countdownSeconds; number >= 1; number -= 1) {
      dom.countdownOverlay.textContent = String(number);
      restartAnimation(dom.countdownOverlay, "countdown-pop");
      await sleep(1000);
    }

    dom.countdownOverlay.classList.add("hidden");
  }

  function stopStream() {
    stopCameraStream(state.stream, [dom.cameraPreview, dom.operatorPreviewVideo]);
    state.stream = null;
  }

  async function startCamera() {
    cameraScreen.clearError();
    state.mode = "camera";
    syncModeUi();

    try {
      stopStream();
      state.stream = await startCameraStream([dom.cameraPreview, dom.operatorPreviewVideo]);
      state.captureReady = true;
      dom.emptyCamera.classList.add("hidden");
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : APP_STRINGS.cameraAccessDenied;
      cameraScreen.showError(message);
    }
  }

  function handleRecordingStop() {
    state.recordingBlob = createRecordingBlob(state.recordingChunks, state.recorder);

    if (state.recordingUrl) {
      revokeObjectUrl(state.recordingUrl);
    }

    state.recordingUrl = createObjectUrl(state.recordingBlob);
    downloadRecording(state.recordingUrl);
    state.captureInProgress = false;
    state.shutterAnimatingOut = false;
    dom.snapButton.disabled = false;
    editorScreen.showResult();
    syncModeUi();
  }

  function stopRecording(finalize = true) {
    stopRecordingTimers();

    if (state.recorder?.state === "recording") {
      if (!finalize) {
        state.recorder.onstop = null;
      }

      state.recorder.stop();
    }

    dom.recordingProgress.style.width = finalize ? "100%" : "0%";
  }

  async function captureVideo() {
    if (!state.captureReady || state.captureInProgress || !state.stream) {
      return;
    }

    operatorScreen.syncCountdownFromControl();
    operatorScreen.syncDurationFromControl();
    state.captureInProgress = true;
    state.shutterAnimatingOut = state.countdownSeconds > 0;
    dom.snapButton.disabled = true;
    syncModeUi();

    try {
      await runCountdown();
      flash();
      await sleep(APP_THRESHOLDS.postFlashDelayMs);

      state.recordingChunks = [];
      state.recorder = createMediaRecorder(state.stream);
      state.recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          state.recordingChunks.push(event.data);
        }
      };
      state.recorder.onstop = handleRecordingStop;
      state.recorder.start(APP_THRESHOLDS.recorderChunkIntervalMs);
      state.recordStartedAt = Date.now();
      dom.recordingProgress.style.width = "0%";
      state.recordIntervalId = window.setInterval(updateRecordingProgress, APP_THRESHOLDS.recordingProgressIntervalMs);
      state.recordStopTimeoutId = window.setTimeout(() => stopRecording(true), state.recordingDurationSeconds * 1000);
    } catch (error) {
      console.error(error);
      state.captureInProgress = false;
      state.shutterAnimatingOut = false;
      dom.snapButton.disabled = false;
      syncModeUi();
      cameraScreen.showError(APP_STRINGS.recordingFailed);
    }
  }

  async function handleResultReset() {
    stopRecording(false);
    state.captureInProgress = false;
    state.shutterAnimatingOut = false;
    state.recordingChunks = [];
    state.recordingBlob = null;

    if (state.recordingUrl) {
      revokeObjectUrl(state.recordingUrl);
      state.recordingUrl = "";
    }

    editorScreen.resetResultVideo();
    dom.snapButton.disabled = false;
    dom.recordingProgress.style.width = "0%";
    await startCamera();
  }

  document.body.dataset.mode = state.mode;
  operatorScreen.syncControlsFromState();
  operatorScreen.renderFrameTray();
  editorScreen.renderOverlayPreview();
  void requestFullscreenIfPossible();
  document.addEventListener("pointerdown", () => {
    void requestFullscreenIfPossible();
  }, { once: true });
  document.addEventListener("keydown", () => {
    void requestFullscreenIfPossible();
  }, { once: true });
  wireEvents(dom, state, {
    captureVideo,
    handleResultReset,
    operatorScreen
  });
  syncModeUi();
  void startCamera();
}