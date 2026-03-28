import createAppStore from "../store/appStore.js";
import createDomRefs from "./dom.js";
import createCameraScreen from "../screens/cameraScreen.js";
import createEditorScreen from "../screens/editorScreen.js";
import createOperatorScreen from "../screens/operatorScreen.js";
import wireEvents from "./events.js";
import { APP_DEFAULTS, APP_STRINGS, APP_THRESHOLDS } from "../constants/appConfig.js";
import { sleep, clearIntervalTimer } from "../utils/timing.js";
import { startCameraStream, stopCameraStream } from "../services/cameraService.js";
import { createMediaRecorder, createRecordingBlob, getRecordingExtension } from "../services/recordingService.js";
import {
  createObjectUrl,
  saveRecording,
  buildTimestampFilename,
  loadSavedRecordingsFromDirectory,
  revokeObjectUrl
} from "../services/downloadService.js";
import {
  closeDesktopApp,
  getDesktopAppVersion,
  getFullscreenState,
  isDesktopApp,
  setFullscreenState
} from "../services/desktopService.js";
import {
  applyPersistedSettings,
  loadPersistedSettings,
  persistSettings
} from "../services/settingsPersistence.js";

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

function formatErrorMessage(error, fallbackMessage) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return fallbackMessage;
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

function drawOverlayText(ctx, state, width, height, metrics = null) {
  if (!state.overlayText || !metrics) {
    return;
  }

  ctx.save();
  ctx.translate((state.overlayTextPosition.x / 100) * width, (state.overlayTextPosition.y / 100) * height);
  ctx.rotate((state.overlayTextRotation * Math.PI) / 180);
  ctx.fillStyle = state.overlayColor;
  ctx.font = `800 ${metrics.fontSize}px "${state.overlayFont}", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
  ctx.shadowBlur = 20;
  const textMetrics = ctx.measureText(state.overlayText);
  const ascent = textMetrics.actualBoundingBoxAscent || metrics.fontSize * 0.8;
  const descent = textMetrics.actualBoundingBoxDescent || metrics.fontSize * 0.2;
  const baselineOffset = (ascent - descent) / 2;
  ctx.fillText(state.overlayText, 0, baselineOffset);
  ctx.restore();
}

function drawOverlayLogo(ctx, state, width, height, logoImage, metrics = null) {
  if (!logoImage || !metrics) {
    return;
  }

  const logoWidth = metrics.width;
  const logoHeight = metrics.height;

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

function getCompositionSize(stageElement) {
  const rect = stageElement.getBoundingClientRect();
  const stageWidth = Math.max(1, rect.width || APP_THRESHOLDS.composedWidth);
  const stageHeight = Math.max(1, rect.height || APP_THRESHOLDS.composedHeight);
  const aspectRatio = stageWidth / stageHeight;

  if (aspectRatio >= 1) {
    return {
      stageWidth,
      stageHeight,
      width: APP_THRESHOLDS.composedWidth,
      height: Math.max(2, Math.round(APP_THRESHOLDS.composedWidth / aspectRatio))
    };
  }

  return {
    stageWidth,
    stageHeight,
    width: Math.max(2, Math.round(APP_THRESHOLDS.composedHeight * aspectRatio)),
    height: APP_THRESHOLDS.composedHeight
  };
}

function getOverlayMetrics(dom, state, compositionSize) {
  const scaleX = compositionSize.width / compositionSize.stageWidth;
  const scaleY = compositionSize.height / compositionSize.stageHeight;
  const metrics = {
    text: null,
    logo: null
  };

  const textElement = dom.cameraText.querySelector(".overlay-caption");
  if (textElement instanceof HTMLElement && state.overlayText) {
    const fontSize = Number.parseFloat(window.getComputedStyle(textElement).fontSize) || state.overlaySize;
    metrics.text = {
      fontSize: Math.max(1, fontSize * scaleY)
    };
  }

  const logoElement = dom.cameraText.querySelector(".overlay-logo-image");
  if (logoElement instanceof HTMLImageElement && state.logoDataUrl) {
    metrics.logo = {
      width: Math.max(1, logoElement.offsetWidth * state.logoScale * scaleX),
      height: Math.max(1, logoElement.offsetHeight * state.logoScale * scaleY)
    };
  }

  return metrics;
}

function createComposedRecorder(state, previewVideo, dom) {
  const compositionSize = getCompositionSize(dom.cameraStage);
  const canvas = document.createElement("canvas");
  canvas.width = compositionSize.width;
  canvas.height = compositionSize.height;
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
    const overlayMetrics = getOverlayMetrics(dom, state, compositionSize);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawVideoCover(ctx, previewVideo, canvas.width, canvas.height);
    drawOverlayLogo(ctx, state, canvas.width, canvas.height, logoImage, overlayMetrics.logo);
    drawOverlayText(ctx, state, canvas.width, canvas.height, overlayMetrics.text);
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
  if (isDesktopApp()) {
    return setFullscreenState(true);
  }

  if (!document.fullscreenEnabled || document.fullscreenElement) {
    return Boolean(document.fullscreenElement);
  }

  const root = document.documentElement;
  const requestFullscreen = root.requestFullscreen?.bind(root);
  if (!requestFullscreen) {
    return Boolean(document.fullscreenElement);
  }

  try {
    await requestFullscreen();
  } catch {
    // Ignore browser rejections; a later user gesture may allow fullscreen.
  }

  return Boolean(document.fullscreenElement);
}

export default function initApp() {
  const state = createAppStore();
  state.isDesktopApp = isDesktopApp();
  applyPersistedSettings(state, { ...APP_DEFAULTS, saveFolderDefault: APP_STRINGS.saveFolderDefault }, loadPersistedSettings());
  const dom = createDomRefs();
  const cameraScreen = createCameraScreen(dom, state);
  const editorScreen = createEditorScreen(dom, state);
  const operatorScreen = createOperatorScreen(dom, state, editorScreen, persistSettings);
  let composedRecorder = null;

  function syncModeUi() {
    cameraScreen.syncModeUi();
  }

  function showAppDialog(title, message) {
    dom.appDialogTitle.textContent = title;
    dom.appDialogMessage.textContent = message;
    dom.appDialogOverlay.classList.remove("hidden");
  }

  function hideAppDialog() {
    dom.appDialogOverlay.classList.add("hidden");
  }

  function showErrorDialog(title, error, fallbackMessage) {
    showAppDialog(title, formatErrorMessage(error, fallbackMessage));
  }

  async function loadAppVersion() {
    try {
      const version = await getDesktopAppVersion();
      dom.appVersionLabel.textContent = `Version ${version.displayVersion}`;
    } catch {
      dom.appVersionLabel.textContent = "Version 1.0.0.0_0";
    }
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
    syncModeUi();
  }

  function flash() {
    restartAnimation(dom.flashOverlay, "flash-active");
  }

  function clearIdleSlideshowTimer() {
    if (state.idleTimeoutId !== null) {
      window.clearTimeout(state.idleTimeoutId);
      state.idleTimeoutId = null;
    }
  }

  function clearSavedSlideshowEntries() {
    state.savedSlideshowEntries
      .filter((entry) => entry.source === "folder")
      .forEach((entry) => revokeObjectUrl(entry.url));
    state.savedSlideshowEntries = [];
  }

  async function refreshSavedSlideshowEntries() {
    const savedSessionEntries = state.recordings
      .filter((recording) => recording.saved)
      .map((recording) => ({
        filename: recording.filename,
        url: recording.url,
        source: "session"
      }));

    const savedByFilename = new Map(savedSessionEntries.map((entry) => [entry.filename, entry]));
    const folderEntries = await loadSavedRecordingsFromDirectory(state.isDesktopApp ? state.saveDirectoryPath : state.saveDirectoryHandle);

    clearSavedSlideshowEntries();

    folderEntries.forEach((entry) => {
      if (!savedByFilename.has(entry.filename)) {
        savedByFilename.set(entry.filename, {
          filename: entry.filename,
          url: entry.url,
          source: "folder"
        });
        return;
      }

      revokeObjectUrl(entry.url);
    });

    state.savedSlideshowEntries = Array.from(savedByFilename.values()).sort((left, right) =>
      left.filename.localeCompare(right.filename, undefined, { numeric: true })
    );
  }

  async function restoreFullscreenIfNeeded() {
    if (state.mode !== "camera") {
      return;
    }

    state.isFullscreen = await requestFullscreenIfPossible();
    syncModeUi();
  }

  async function closeApp() {
    try {
      await closeDesktopApp();
    } catch (error) {
      showErrorDialog("Unable to close app", error, "Photobooth could not close right now.");
    }
  }

  function showRecordingAtIndex(index) {
    if (state.savedSlideshowEntries.length === 0) {
      return;
    }

    const boundedIndex = ((index % state.savedSlideshowEntries.length) + state.savedSlideshowEntries.length) % state.savedSlideshowEntries.length;
    state.slideshowIndex = boundedIndex;
    editorScreen.showSlideshow(state.savedSlideshowEntries[boundedIndex].url);
    syncModeUi();
    dom.resultVideo.play().catch((error) => {
      console.warn("Slideshow playback did not start.", error);
    });
  }

  async function startSlideshow(options = {}) {
    const { silent = false } = options;
    if (state.isRecording || state.captureInProgress) {
      return;
    }

    await refreshSavedSlideshowEntries();
    syncModeUi();
    if (state.savedSlideshowEntries.length === 0) {
      if (!silent) {
        showAppDialog("Slideshow unavailable", "Save at least one video or choose a folder that already contains saved videos.");
      }
      resetIdleSlideshowTimer();
      return;
    }

    clearIdleSlideshowTimer();
    if (state.mode !== "slideshow") {
      state.slideshowReturnMode = state.mode;
    }
    showRecordingAtIndex(0);
  }

  function stopSlideshow() {
    if (state.mode !== "slideshow") {
      return;
    }

    dom.resultVideo.pause();
    if (state.slideshowReturnMode === "editor") {
      editorScreen.showResult();
    } else {
      state.mode = "camera";
      void restoreFullscreenIfNeeded();
    }
    syncModeUi();
  }

  function resetIdleSlideshowTimer() {
    clearIdleSlideshowTimer();

    if (
      state.slideshowIdleSeconds <= 0 ||
      state.operatorPanelOpen ||
      state.isRecording ||
      state.captureInProgress ||
      (state.mode !== "camera" && state.mode !== "editor")
    ) {
      return;
    }

    state.idleTimeoutId = window.setTimeout(() => {
      void startSlideshow({ silent: true });
    }, state.slideshowIdleSeconds * 1000);
  }

  function handleSlideshowIdleSettingChange() {
    operatorScreen.syncSlideshowIdleFromControl();
    resetIdleSlideshowTimer();
  }

  function handleUserActivity() {
    if (state.mode === "slideshow") {
      stopSlideshow();
    }
    resetIdleSlideshowTimer();
  }

  function openPreviewView() {
    hideAppDialog();
    editorScreen.showResult();
    syncModeUi();
    resetIdleSlideshowTimer();
  }

  function openSettingsView() {
    hideAppDialog();
    state.operatorReturnMode = state.mode;
    state.mode = "camera";
    operatorScreen.setOperatorPanelOpen(true);
    syncModeUi();
    resetIdleSlideshowTimer();
    void restoreFullscreenIfNeeded();
  }

  function closeOperatorPanel() {
    operatorScreen.setOperatorPanelOpen(false);
    hideAppDialog();

    if (state.operatorReturnMode === "editor") {
      editorScreen.showResult();
    } else {
      state.mode = "camera";
      void restoreFullscreenIfNeeded();
    }

    syncModeUi();
    resetIdleSlideshowTimer();
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
      state.captureReady = false;
      dom.emptyCamera.classList.add("hidden");
      showErrorDialog("Camera unavailable", error, APP_STRINGS.cameraAccessDenied);
    }

    resetIdleSlideshowTimer();
    void restoreFullscreenIfNeeded();
  }

  async function saveCurrentRecording() {
    if (!state.recordingBlob || !state.recordingFilename) {
      return;
    }

    try {
      const savedFilename = await saveRecording(
        state.recordingBlob,
        state.recordingFilename,
        state.isDesktopApp ? state.saveDirectoryPath : state.saveDirectoryHandle
      );

      if (!savedFilename) {
        return;
      }

      const currentRecording = state.recordings.find((recording) => recording.filename === state.recordingFilename);
      if (currentRecording) {
        currentRecording.saved = true;
      }
      await refreshSavedSlideshowEntries();
      hideAppDialog();
      syncModeUi();
      resetIdleSlideshowTimer();
    } catch (error) {
      showErrorDialog("Save failed", error, "Photobooth could not save the recording.");
    }
  }

  async function handleRecordingStop() {
    state.recordingBlob = createRecordingBlob(state.recordingChunks, state.recorder);
    state.recordingUrl = createObjectUrl(state.recordingBlob);
    const extension = getRecordingExtension(state.recordingBlob.type || state.recorder?.mimeType || "video/webm");
    state.recordingFilename = buildTimestampFilename(extension);
    state.recordings.push({
      url: state.recordingUrl,
      blob: state.recordingBlob,
      filename: state.recordingFilename,
      saved: false
    });
    stopRecordingTimer();
    composedRecorder?.stop();
    composedRecorder = null;
    resetCaptureState();
    dom.snapButton.disabled = false;
    dom.recordingTimer.textContent = "00:00";
    editorScreen.showResult();
    syncModeUi();
    resetIdleSlideshowTimer();
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

    clearIdleSlideshowTimer();
    operatorScreen.syncCountdownFromControl();
    state.captureInProgress = true;
    state.shutterAnimatingOut = state.countdownSeconds > 0;
    dom.snapButton.disabled = true;
    hideAppDialog();
    syncModeUi();

    try {
      await runCountdown();
      flash();
      await sleep(APP_THRESHOLDS.postFlashDelayMs);

      state.recordingChunks = [];
      composedRecorder = createComposedRecorder(state, dom.cameraPreview, dom);
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
      showErrorDialog("Recording error", error, APP_STRINGS.recordingFailed);
      resetIdleSlideshowTimer();
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
    state.recordingUrl = "";
    state.recordingFilename = "";

    editorScreen.resetResultVideo();
    dom.snapButton.disabled = false;
    dom.recordingTimer.textContent = "00:00";
    state.mode = "camera";
    hideAppDialog();
    syncModeUi();
    resetIdleSlideshowTimer();
    void restoreFullscreenIfNeeded();
  }

  function handleResultEnded() {
    if (state.mode === "slideshow") {
      showRecordingAtIndex(state.slideshowIndex + 1);
      return;
    }

    editorScreen.handlePlaybackStateChange();
  }

  async function pickSaveFolder() {
    const result = await operatorScreen.pickSaveFolder();
    if (result === "cancelled") {
      syncModeUi();
      return;
    }

    if (result === "unsupported") {
      showAppDialog("Folder access unavailable", APP_STRINGS.folderUnsupported);
      syncModeUi();
      return;
    }

    await refreshSavedSlideshowEntries();
    hideAppDialog();
    syncModeUi();
    resetIdleSlideshowTimer();
  }

  window.addEventListener("error", (event) => {
    if (!event.message && !event.error) {
      return;
    }

    showErrorDialog("Photobooth", event.error || event.message, "An unexpected error occurred.");
  });

  window.addEventListener("unhandledrejection", (event) => {
    showErrorDialog("Photobooth", event.reason, "An unexpected error occurred.");
  });

  document.body.dataset.mode = state.mode;
  operatorScreen.syncControlsFromState();
  operatorScreen.renderFrameTray();
  editorScreen.renderOverlayPreview();
  editorScreen.syncPlaybackButton();
  void loadAppVersion();
  void getFullscreenState().then((fullscreen) => {
    state.isFullscreen = fullscreen;
    syncModeUi();
  });
  void requestFullscreenIfPossible().then((fullscreen) => {
    state.isFullscreen = fullscreen;
    syncModeUi();
  });
  document.addEventListener("pointerdown", () => {
    void requestFullscreenIfPossible().then((fullscreen) => {
      state.isFullscreen = fullscreen;
      syncModeUi();
    });
  }, { once: true });
  document.addEventListener("keydown", () => {
    void requestFullscreenIfPossible().then((fullscreen) => {
      state.isFullscreen = fullscreen;
      syncModeUi();
    });
  }, { once: true });
  window.addEventListener("focus", () => {
    void restoreFullscreenIfNeeded();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      void restoreFullscreenIfNeeded();
    }
  });
  ["pointerdown", "keydown", "pointermove"].forEach((eventName) => {
    document.addEventListener(eventName, handleUserActivity, { passive: true });
  });
  wireEvents(dom, state, {
    captureVideo,
    closeOperatorPanel,
    handleResultReset,
    handleResultEnded,
    handleSlideshowIdleSettingChange,
    hideAppDialog,
    openPreviewView,
    openSettingsView,
    pickSaveFolder,
    saveCurrentRecording,
    startSlideshow,
    closeApp,
    operatorScreen,
    editorScreen
  });
  syncModeUi();
  void refreshSavedSlideshowEntries();
  void startCamera();
}
