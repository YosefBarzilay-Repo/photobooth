import createAppStore from "../store/appStore.js";
import createDomRefs from "./dom.js";
import createCameraScreen from "../screens/cameraScreen.js";
import createEditorScreen from "../screens/editorScreen.js";
import createOperatorScreen from "../screens/operatorScreen.js";
import wireEvents from "./events.js";
import { APP_STRINGS, APP_THRESHOLDS } from "../constants/appConfig.js";
import { sleep, clearIntervalTimer } from "../utils/timing.js";
import { startCameraStream, stopCameraStream } from "../services/cameraService.js";
import { createMediaRecorder, createRecordingBlob, getRecordingExtension } from "../services/recordingService.js";
import { createObjectUrl, revokeObjectUrl, saveRecording, buildTimestampFilename } from "../services/downloadService.js";

function restartAnimation(element, className) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

function formatElapsedTime(startedAt) {
  const totalSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function drawVideoCover(ctx, video, width, height) {
  const videoWidth = video.videoWidth || width;
  const videoHeight = video.videoHeight || height;
  const targetAspect = width / height;
  const sourceAspect = videoWidth / videoHeight;

  let sourceWidth = videoWidth;
  let sourceHeight = videoHeight;
  let sourceX = 0;
  let sourceY = 0;

  if (sourceAspect > targetAspect) {
    sourceWidth = videoHeight * targetAspect;
    sourceX = (videoWidth - sourceWidth) / 2;
  } else {
    sourceHeight = videoWidth / targetAspect;
    sourceY = (videoHeight - sourceHeight) / 2;
  }

  ctx.save();
  ctx.translate(width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
  ctx.restore();
}

function drawOverlayText(ctx, state, width, height) {
  if (!state.overlayText) {
    return;
  }

  ctx.save();
  ctx.translate((state.overlayTextPosition.x / 100) * width, (state.overlayTextPosition.y / 100) * height);
  ctx.rotate((state.overlayTextRotation * Math.PI) / 180);
  ctx.fillStyle = state.overlayColor;
  ctx.font = `800 ${state.overlaySize}px "${state.overlayFont}", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
  ctx.shadowBlur = 20;
  ctx.fillText(state.overlayText, 0, 0);
  ctx.restore();
}

function drawOverlayLogo(ctx, state, width, height, logoImage) {
  if (!logoImage) {
    return;
  }

  const logoWidth = 160 * state.logoScale;
  const ratio = logoImage.naturalHeight / logoImage.naturalWidth;
  const logoHeight = logoWidth * ratio;

  ctx.save();
  ctx.translate((state.logoPosition.x / 100) * width, (state.logoPosition.y / 100) * height);
  ctx.rotate((state.logoRotation * Math.PI) / 180);
  ctx.drawImage(logoImage, -logoWidth / 2, -logoHeight / 2, logoWidth, logoHeight);
  ctx.restore();
}

function drawFrameOverlay(ctx, frameId, width, height) {
  switch (frameId) {
    case "classic":
      ctx.strokeStyle = "rgba(255, 255, 255, 0.94)";
      ctx.lineWidth = 42;
      ctx.strokeRect(0, 0, width, height);
      return;
    case "polaroid":
      ctx.fillStyle = "#f7f1ea";
      ctx.fillRect(0, 0, width, 28);
      ctx.fillRect(0, 0, 28, height);
      ctx.fillRect(width - 28, 0, 28, height);
      ctx.fillRect(0, height - 92, width, 92);
      return;
    case "film": {
      ctx.fillStyle = "rgba(10, 10, 14, 0.96)";
      ctx.fillRect(0, 0, width, height);
      const inset = 40;
      ctx.clearRect(inset, inset, width - inset * 2, height - inset * 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
      for (let y = 64; y < height - 64; y += 32) {
        ctx.fillRect(12, y, 18, 16);
        ctx.fillRect(width - 30, y, 18, 16);
      }
      return;
    }
    case "neon":
      ctx.strokeStyle = "rgba(255, 136, 181, 0.82)";
      ctx.lineWidth = 18;
      ctx.shadowColor = "rgba(54, 218, 248, 0.6)";
      ctx.shadowBlur = 18;
      ctx.strokeRect(9, 9, width - 18, height - 18);
      ctx.shadowBlur = 0;
      return;
    case "floral":
      ctx.strokeStyle = "rgba(18, 8, 16, 0.72)";
      ctx.lineWidth = 28;
      ctx.strokeRect(0, 0, width, height);
      [[30, 30], [width - 30, 30], [30, height - 30], [width - 30, height - 30]].forEach(([x, y]) => {
        ctx.fillStyle = "#ff88b5";
        ctx.beginPath();
        ctx.arc(x, y, 18, 0, Math.PI * 2);
        ctx.fill();
      });
      return;
    case "minimal":
      ctx.strokeStyle = "rgba(5, 5, 7, 0.98)";
      ctx.lineWidth = 44;
      ctx.strokeRect(0, 0, width, height);
      return;
    case "none":
    default:
      return;
  }
}

function createComposedRecorder(state, previewVideo) {
  const canvas = document.createElement("canvas");
  canvas.width = APP_THRESHOLDS.composedWidth;
  canvas.height = APP_THRESHOLDS.composedHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error(APP_STRINGS.recordingFailed);
  }

  const stream = canvas.captureStream(APP_THRESHOLDS.composedFps);
  let rafId = 0;
  let logoImage = null;

  if (state.logoDataUrl) {
    logoImage = new Image();
    logoImage.src = state.logoDataUrl;
  }

  const render = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawVideoCover(ctx, previewVideo, canvas.width, canvas.height);
    drawOverlayLogo(ctx, state, canvas.width, canvas.height, logoImage);
    drawOverlayText(ctx, state, canvas.width, canvas.height);
    drawFrameOverlay(ctx, state.activeFrameId, canvas.width, canvas.height);
    rafId = window.requestAnimationFrame(render);
  };

  render();

  return {
    stream,
    stop() {
      window.cancelAnimationFrame(rafId);
      stream.getTracks().forEach((track) => track.stop());
    }
  };
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
  let composedRecorder = null;

  function syncModeUi() {
    cameraScreen.syncModeUi();
  }

  function resetCaptureState() {
    state.captureInProgress = false;
    state.isRecording = false;
    state.shutterAnimatingOut = false;
    state.countdownValue = null;
  }

  function stopRecordingTimer() {
    clearIntervalTimer(state.recordIntervalId);
    state.recordIntervalId = null;
  }

  function updateRecordingTimer() {
    dom.recordingTimer.textContent = formatElapsedTime(state.recordStartedAt);
  }

  function flash() {
    restartAnimation(dom.flashOverlay, "flash-active");
  }

  async function restoreFullscreenIfNeeded() {
    if (state.mode !== "camera") {
      return;
    }
    await requestFullscreenIfPossible();
  }

  async function runCountdown() {
    if (state.countdownSeconds <= 0) {
      return;
    }

    await sleep(APP_THRESHOLDS.countdownLeadInMs);
    state.shutterAnimatingOut = false;
    state.countdownValue = state.countdownSeconds;
    syncModeUi();

    for (let number = state.countdownSeconds; number >= 1; number -= 1) {
      state.countdownValue = number;
      syncModeUi();
      await sleep(1000);
    }

    state.countdownValue = null;
    syncModeUi();
  }

  function stopStream() {
    stopCameraStream(state.stream, [dom.cameraPreview]);
    state.stream = null;
  }

  async function startCamera() {
    cameraScreen.clearError();
    state.mode = "camera";
    syncModeUi();

    try {
      stopStream();
      state.stream = await startCameraStream([dom.cameraPreview]);
      state.captureReady = true;
      dom.emptyCamera.classList.add("hidden");
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : APP_STRINGS.cameraAccessDenied;
      cameraScreen.showError(message);
    }
  }

  async function handleRecordingStop() {
    state.recordingBlob = createRecordingBlob(state.recordingChunks, state.recorder);

    if (state.recordingUrl) {
      revokeObjectUrl(state.recordingUrl);
    }

    state.recordingUrl = createObjectUrl(state.recordingBlob);
    const extension = getRecordingExtension(state.recordingBlob.type || state.recorder?.mimeType || "video/webm");
    const filename = buildTimestampFilename(extension);
    await saveRecording(state.recordingBlob, filename, state.saveDirectoryHandle);
    stopRecordingTimer();
    composedRecorder?.stop();
    composedRecorder = null;
    resetCaptureState();
    dom.snapButton.disabled = false;
    dom.recordingTimer.textContent = "00:00";
    editorScreen.showResult();
    syncModeUi();
  }

  function stopRecording() {
    if (state.recorder?.state === "recording") {
      state.recorder.stop();
    }
  }

  async function startRecordingFlow() {
    if (!state.captureReady || state.captureInProgress || !state.stream) {
      return;
    }

    operatorScreen.syncCountdownFromControl();
    state.captureInProgress = true;
    state.shutterAnimatingOut = state.countdownSeconds > 0;
    dom.snapButton.disabled = true;
    syncModeUi();

    try {
      await runCountdown();
      flash();
      await sleep(APP_THRESHOLDS.postFlashDelayMs);

      state.recordingChunks = [];
      composedRecorder = createComposedRecorder(state, dom.cameraPreview);
      state.recorder = createMediaRecorder(composedRecorder.stream);
      state.recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          state.recordingChunks.push(event.data);
        }
      };
      state.recorder.onstop = () => {
        void handleRecordingStop();
      };
      state.recorder.start(APP_THRESHOLDS.recorderChunkIntervalMs);
      state.recordStartedAt = Date.now();
      dom.recordingTimer.textContent = "00:00";
      state.isRecording = true;
      dom.snapButton.disabled = false;
      stopRecordingTimer();
      state.recordIntervalId = window.setInterval(updateRecordingTimer, APP_THRESHOLDS.recordingTimerIntervalMs);
      updateRecordingTimer();
      syncModeUi();
    } catch (error) {
      console.error(error);
      stopRecordingTimer();
      composedRecorder?.stop();
      composedRecorder = null;
      resetCaptureState();
      dom.snapButton.disabled = false;
      syncModeUi();
      cameraScreen.showError(APP_STRINGS.recordingFailed);
    }
  }

  async function captureVideo() {
    if (state.isRecording) {
      stopRecording();
      return;
    }

    await startRecordingFlow();
  }

  async function handleResultReset() {
    stopRecordingTimer();
    composedRecorder?.stop();
    composedRecorder = null;
    resetCaptureState();
    state.recordingChunks = [];
    state.recordingBlob = null;

    if (state.recordingUrl) {
      revokeObjectUrl(state.recordingUrl);
      state.recordingUrl = "";
    }

    editorScreen.resetResultVideo();
    dom.snapButton.disabled = false;
    dom.recordingTimer.textContent = "00:00";
    await startCamera();
  }

  document.body.dataset.mode = state.mode;
  operatorScreen.syncControlsFromState();
  operatorScreen.renderFrameTray();
  editorScreen.renderOverlayPreview();
  editorScreen.syncPlaybackButton();
  void requestFullscreenIfPossible();
  document.addEventListener("pointerdown", () => {
    void requestFullscreenIfPossible();
  }, { once: true });
  document.addEventListener("keydown", () => {
    void requestFullscreenIfPossible();
  }, { once: true });
  window.addEventListener("focus", () => {
    void restoreFullscreenIfNeeded();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      void restoreFullscreenIfNeeded();
    }
  });
  wireEvents(dom, state, {
    captureVideo,
    handleResultReset,
    operatorScreen,
    editorScreen
  });
  syncModeUi();
  void startCamera();
}
