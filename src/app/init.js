import createAppStore from "../store/appStore.js";
import createDomRefs from "./dom.js";
import createCameraScreen from "../screens/cameraScreen.js";
import createEditorScreen from "../screens/editorScreen.js";
import createOperatorScreen from "../screens/operatorScreen.js";
import createGalleryScreen from "../screens/galleryScreen.js";
import wireEvents from "./events.js";
import { APP_DEFAULTS, APP_STRINGS, APP_THRESHOLDS } from "../constants/appConfig.js";
import { sleep, clearIntervalTimer } from "../utils/timing.js";
import { startCameraStream, stopCameraStream } from "../services/cameraService.js";
import { createMediaRecorder, createRecordingBlob, getRecordingExtension } from "../services/recordingService.js";
import {
  createObjectUrl,
  deleteSavedRecording,
  saveRecording,
  buildTimestampFilename,
  loadSavedRecordingsFromDirectory
} from "../services/downloadService.js";
import {
  closeDesktopApp,
  createDesktopProjectDirectory,
  deleteDesktopProjectDirectory,
  getDefaultRecordingsDirectory,
  getDesktopAppVersion,
  getFullscreenState,
  isDesktopApp,
  listDesktopProjects,
  openDesktopSlideshowWindow,
  openDesktopDirectory,
  renameDesktopProjectDirectory,
  setFullscreenState
} from "../services/desktopService.js";
import {
  applyPersistedSettings,
  loadPersistedSettings,
  persistSettings
} from "../services/settingsPersistence.js";
import {
  buildAudioInputOptions,
  buildVideoInputOptions,
  enumerateInputDevices
} from "../services/mediaDeviceService.js";
import { logger } from "../services/logger.js";

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

function getParentDirectory(directoryPath) {
  const normalized = String(directoryPath || "").trim().replace(/[\\/]+$/, "");
  if (!normalized) {
    return "";
  }

  const lastSlashIndex = Math.max(normalized.lastIndexOf("\\"), normalized.lastIndexOf("/"));
  if (lastSlashIndex <= 0) {
    return "";
  }

  return normalized.slice(0, lastSlashIndex);
}

const VALID_PROJECT_NAME_PATTERN = /^[A-Za-z0-9 .-]+$/;

function validateProjectName(projectName) {
  const normalizedName = String(projectName || "").trim();
  if (!normalizedName) {
    return APP_STRINGS.projectNameRequired;
  }

  if (!VALID_PROJECT_NAME_PATTERN.test(normalizedName)) {
    return APP_STRINGS.projectNameInvalid;
  }

  return "";
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
  const sourceStream = previewVideo.srcObject instanceof MediaStream ? previewVideo.srcObject : null;
  sourceStream?.getAudioTracks().forEach((track) => {
    try {
      stream.addTrack(track.clone());
    } catch {
      // Ignore audio tracks that cannot be cloned into the composed stream.
    }
  });

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
  void logger.info("Photobooth app initialization started.", {
    isDesktopApp: state.isDesktopApp,
    saveDirectoryPath: state.saveDirectoryPath,
    saveDirectoryName: state.saveDirectoryName
  });
  const dom = createDomRefs();
  const cameraScreen = createCameraScreen(dom, state);
  const editorScreen = createEditorScreen(dom, state);
  const operatorScreen = createOperatorScreen(dom, state, editorScreen, persistSettings);
  let composedRecorder = null;
  let cameraSessionId = 0;
  let dialogResolver = null;
  let dialogIsConfirmation = false;

  function syncModeUi() {
    cameraScreen.syncModeUi();
  }

  function resetDialogState() {
    dialogResolver = null;
    dialogIsConfirmation = false;
  }

  function hideAppDialog(result = false) {
    dom.appDialogOverlay.classList.add("hidden");
    const resolver = dialogResolver;
    resetDialogState();
    if (resolver) {
      resolver(Boolean(result));
    }
  }

  function showAppDialog(title, message) {
    dom.appDialogTitle.textContent = title;
    dom.appDialogMessage.textContent = message;
    dom.appDialogActions.classList.remove("hidden");
    dom.appDialogCancelButton.classList.add("hidden");
    dom.appDialogConfirmButton.textContent = "OK";
    dom.appDialogOverlay.classList.remove("hidden");
    resetDialogState();
  }

  function requestConfirmation({ title, message, confirmLabel = "Yes", cancelLabel = "No" }) {
    dom.appDialogTitle.textContent = title;
    dom.appDialogMessage.textContent = message;
    dom.appDialogCancelButton.textContent = cancelLabel;
    dom.appDialogConfirmButton.textContent = confirmLabel;
    dom.appDialogCancelButton.classList.remove("hidden");
    dom.appDialogActions.classList.remove("hidden");
    dom.appDialogOverlay.classList.remove("hidden");
    dialogIsConfirmation = true;

    return new Promise((resolve) => {
      dialogResolver = resolve;
    });
  }

  function showProjectDialog() {
    dom.projectDialogError.textContent = "";
    dom.projectDialogError.classList.add("hidden");
    dom.projectNameInput.value = "";
    dom.projectDialogOverlay.classList.remove("hidden");
    window.setTimeout(() => dom.projectNameInput.focus(), 0);
  }

  function hideProjectDialog() {
    dom.projectDialogOverlay.classList.add("hidden");
  }

  function showProjectError(message) {
    dom.projectDialogError.textContent = message;
    dom.projectDialogError.classList.remove("hidden");
  }

  function hasUnsavedRecording() {
    if (!state.recordingBlob || !state.recordingFilename) {
      return false;
    }

    const currentRecording = state.recordings.find((recording) => recording.filename === state.recordingFilename);
    return !currentRecording?.saved;
  }

  async function confirmDiscardIfNeeded(actionLabel) {
    if (!hasUnsavedRecording()) {
      return true;
    }

    return requestConfirmation({
      title: "Unsaved Video",
      message: `You have an unsaved video. Discard it and ${actionLabel}?`,
      confirmLabel: "Yes",
      cancelLabel: "No"
    });
  }

  async function refreshMediaDeviceOptions() {
    const { videoInputs, audioInputs } = await enumerateInputDevices();
    operatorScreen.populateMediaDeviceOptions({
      videoOptions: buildVideoInputOptions(videoInputs),
      audioOptions: buildAudioInputOptions(audioInputs)
    });
    persistSettings(state);
  }

  function showErrorDialog(title, error, fallbackMessage) {
    void logger.exception("Error dialog shown.", error, { title, fallbackMessage });
    showAppDialog(title, formatErrorMessage(error, fallbackMessage));
  }

  function applyPreviewEntry(entry) {
    state.recordingBlob = null;
    state.recordingUrl = entry.url;
    state.recordingFilename = entry.filename;
    state.recordingPath = entry.path || "";
    editorScreen.showResult();
    syncModeUi();
  }

  async function loadGalleryEntries() {
    const source = state.isDesktopApp ? state.saveDirectoryPath : state.saveDirectoryHandle;
    void logger.debug("Loading gallery entries for main app.", {
      source: typeof source === "string" ? source : source?.name || ""
    });
    return loadSavedRecordingsFromDirectory(source);
  }

  async function deleteGalleryEntry(entry) {
    await deleteSavedRecording(entry, state.isDesktopApp ? state.saveDirectoryPath : state.saveDirectoryHandle);

    if (!state.recordingBlob && state.recordingPath && entry.path && state.recordingPath === entry.path) {
      state.recordingUrl = "";
      state.recordingFilename = "";
      state.recordingPath = "";
      editorScreen.resetResultVideo();
      editorScreen.showResult();
    }

    syncModeUi();
  }

  async function loadProjects() {
    if (!state.isDesktopApp) {
      return [];
    }
    return listDesktopProjects();
  }
  function setActiveProject(projectPath, projectName) {
    state.saveDirectoryHandle = null;
    state.saveDirectoryPath = projectPath;
    state.saveDirectoryName = projectName;
    persistSettings(state);
  }
  async function openProject(project) {
    setActiveProject(project.path, project.name);
    hideAppDialog();
    syncModeUi();
  }
  async function openProjectFolder(project) {
    try {
      await openDesktopDirectory(project.path);
    } catch (error) {
      showErrorDialog("Folder unavailable", error, APP_STRINGS.openFolderUnavailable);
    }
  }
  async function renameProject(project) {
    if (!state.isDesktopApp) {
      return;
    }
    const requestedName = window.prompt("Enter the new project name.", project.name);
    if (requestedName === null) {
      return;
    }
    const projectName = requestedName.trim();
    const validationError = validateProjectName(projectName);
    if (validationError) {
      showAppDialog("Rename failed", validationError);
      return;
    }
    try {
      const renamedPath = await renameDesktopProjectDirectory(project.path, projectName);
      if (state.saveDirectoryPath === project.path) {
        setActiveProject(renamedPath, projectName);
      }
      hideAppDialog();
    } catch (error) {
      showErrorDialog("Rename failed", error, "Photobooth could not rename the selected project.");
    }
  }
  async function deleteProject(project) {
    if (!state.isDesktopApp) {
      return;
    }
    const confirmed = await requestConfirmation({
      title: "Delete Project",
      message: `Delete ${project.name} and all videos in this folder?`,
      confirmLabel: "Yes",
      cancelLabel: "No"
    });
    if (!confirmed) {
      return;
    }
    try {
      await deleteDesktopProjectDirectory(project.path);
      if (state.saveDirectoryPath === project.path) {
        state.saveDirectoryPath = await getDefaultRecordingsDirectory();
        state.saveDirectoryName = APP_STRINGS.saveFolderDefault;
        state.saveDirectoryHandle = null;
        persistSettings(state);
      }
      if (!state.recordingBlob && state.recordingPath && state.recordingPath.toLowerCase().startsWith(project.path.toLowerCase())) {
        state.recordingUrl = "";
        state.recordingFilename = "";
        state.recordingPath = "";
        editorScreen.resetResultVideo();
        editorScreen.showResult();
      }
      hideAppDialog();
      syncModeUi();
    } catch (error) {
      showErrorDialog("Delete failed", error, "Photobooth could not delete the selected project.");
    }
  }
  const galleryScreen = createGalleryScreen(dom, state, {
    loadEntries: loadGalleryEntries,
    loadProjects,
    openEntry(entry) {
      galleryScreen.setGalleryPanelOpen(false);
      hideAppDialog();
      applyPreviewEntry(entry);
    },
    async deleteEntry(entry) {
      try {
        await deleteGalleryEntry(entry);
      } catch (error) {
        showErrorDialog("Delete failed", error, "Photobooth could not delete the selected video.");
      }
    },
    openProject,
    openProjectFolder,
    renameProject,
    deleteProject
  });

  async function loadAppVersion() {
    try {
      const version = await getDesktopAppVersion();
      dom.appVersionLabel.textContent = `Version ${version.displayVersion}`;
      void logger.info("Loaded app version.", version);
    } catch (error) {
      void logger.exception("Failed to load app version.", error);
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

  async function restoreFullscreenIfNeeded() {
    if (state.mode !== "camera") {
      return;
    }

    state.isFullscreen = await requestFullscreenIfPossible();
    syncModeUi();
  }

  async function closeApp() {
    const confirmed = await requestConfirmation({
      title: "Close App",
      message: hasUnsavedRecording()
        ? "You have an unsaved video. Close the app and discard it?"
        : "Are you sure you want to close the app?",
      confirmLabel: "Yes",
      cancelLabel: "No"
    });

    if (!confirmed) {
      return;
    }

    try {
      await closeDesktopApp();
    } catch (error) {
      showErrorDialog("Unable to close app", error, "Photobooth could not close right now.");
    }
  }

  async function openSlideshowWindow() {
    try {
      if (!state.isDesktopApp) {
        showAppDialog("Desktop only", "The separate slideshow screen is available in the installed desktop app.");
        return;
      }

      await logger.audit("Open slideshow window requested.", { saveDirectoryPath: state.saveDirectoryPath });
      await openDesktopSlideshowWindow();
      hideAppDialog();
      void logger.info("Slideshow window opened.");
    } catch (error) {
      showErrorDialog("Slideshow unavailable", error, "Photobooth could not open the slideshow screen.");
    }
  }

  async function openGalleryPanel(initialView = "videos") {
    try {
      hideAppDialog();
      await galleryScreen.openGalleryPanel(initialView);
      syncModeUi();
    } catch (error) {
      showErrorDialog("Gallery unavailable", error, "Photobooth could not open the gallery.");
    }
  }

  function closeGalleryPanel() {
    galleryScreen.setGalleryPanelOpen(false);
    syncModeUi();
  }

  async function openGalleryFolder(view = state.galleryView) {
    try {
      if (!state.isDesktopApp) {
        showAppDialog("Folder access unavailable", APP_STRINGS.openFolderUnavailable);
        return;
      }

      const directoryPath = view === "projects" ? await getDefaultRecordingsDirectory() : state.saveDirectoryPath || await getDefaultRecordingsDirectory();
      void logger.audit("Open gallery folder requested.", { directoryPath });
      await openDesktopDirectory(directoryPath);
      void logger.info("Gallery folder opened.", { directoryPath });
    } catch (error) {
      showErrorDialog("Folder unavailable", error, APP_STRINGS.openFolderUnavailable);
    }
  }

  function resetProjectDesignState() {
    state.activeFrameId = APP_DEFAULTS.activeFrameId;
    state.activeOverlayTarget = APP_DEFAULTS.activeOverlayTarget;
    state.showTextColorPalette = APP_DEFAULTS.showTextColorPalette;
    state.overlayText = APP_DEFAULTS.overlayText;
    state.overlayFont = APP_DEFAULTS.overlayFont;
    state.overlayColor = APP_DEFAULTS.overlayColor;
    state.overlaySize = APP_DEFAULTS.overlaySize;
    state.overlayTextPosition = { ...APP_DEFAULTS.overlayTextPosition };
    state.overlayTextRotation = APP_DEFAULTS.overlayTextRotation;
    state.logoDataUrl = APP_DEFAULTS.logoDataUrl;
    state.logoScale = APP_DEFAULTS.logoScale;
    state.logoRotation = APP_DEFAULTS.logoRotation;
    state.logoPosition = { ...APP_DEFAULTS.logoPosition };
    state.draggingOverlayTarget = null;
    state.overlayInteraction = null;
    state.dragPointerId = null;
    state.dragStartPointer = null;
    state.dragSurfaceSize = null;
    state.dragStartPosition = null;
    state.dragStartScale = APP_DEFAULTS.logoScale;
    state.dragStartTextSize = APP_DEFAULTS.overlaySize;
    dom.logoInput.value = "";
    operatorScreen.syncControlsFromState();
    operatorScreen.renderFrameTray();
    editorScreen.renderOverlayPreview();
    syncModeUi();
  }
  function openPreviewView() {
    hideAppDialog();
    closeGalleryPanel();
    stopStream();
    editorScreen.showResult();
    syncModeUi();
  }

  async function openSettingsView() {
    hideAppDialog();
    closeGalleryPanel();
    state.operatorReturnMode = state.mode;
    dom.resultVideo.pause();
    state.mode = "camera";
    operatorScreen.setOperatorPanelOpen(true);
    syncModeUi();
    try {
      await refreshMediaDeviceOptions();
    } catch {
      // Ignore device list failures here; startCamera will surface stream errors.
    }
    void startCamera();
  }

  function closeOperatorPanel() {
    operatorScreen.setOperatorPanelOpen(false);
    hideAppDialog();

    if (state.operatorReturnMode === "editor") {
      stopStream();
      editorScreen.showResult();
    } else {
      state.mode = "camera";
      void startCamera();
    }

    syncModeUi();
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
    cameraSessionId += 1;
    stopCameraStream(state.stream, [dom.cameraPreview]);
    state.stream = null;
    state.captureReady = false;
  }

  async function startCamera() {
    cameraScreen.clearError();
    state.mode = "camera";
    syncModeUi();

    const sessionId = cameraSessionId + 1;
    cameraSessionId = sessionId;
    void logger.info("Camera start requested.", {
      sessionId,
      videoInputId: state.videoInputId || "default",
      audioInputId: state.audioInputId || "default"
    });

    try {
      stopCameraStream(state.stream, [dom.cameraPreview]);
      state.stream = null;
      const stream = await startCameraStream([dom.cameraPreview], {
        videoInputId: state.videoInputId,
        audioInputId: state.audioInputId
      });
      if (cameraSessionId !== sessionId) {
        stopCameraStream(stream, [dom.cameraPreview]);
        return;
      }

      state.stream = stream;
      state.captureReady = true;
      dom.emptyCamera.classList.add("hidden");
      try {
        await refreshMediaDeviceOptions();
      } catch {
        // Device labels are best-effort.
      }
    } catch (error) {
      if (cameraSessionId !== sessionId) {
        return;
      }

      void logger.exception("Camera start failed.", error, { sessionId });
      state.captureReady = false;
      dom.emptyCamera.classList.add("hidden");
      showErrorDialog("Camera unavailable", error, APP_STRINGS.cameraAccessDenied);
      cameraScreen.showError(APP_STRINGS.cameraAccessDenied);
    }

    if (cameraSessionId === sessionId) {
      void restoreFullscreenIfNeeded();
    }
  }

  async function saveCurrentRecording() {
    if (!state.recordingBlob || !state.recordingFilename) {
      void logger.warn("Save requested without an active recording.");
      return;
    }

    void logger.audit("Save current recording requested.", { filename: state.recordingFilename });

    state.isSaving = true;
    syncModeUi();

    try {
      const savedPath = await saveRecording(
        state.recordingBlob,
        state.recordingFilename,
        state.isDesktopApp ? state.saveDirectoryPath : state.saveDirectoryHandle
      );

      if (!savedPath) {
        return;
      }

      state.recordingPath = typeof savedPath === "string" ? savedPath : state.recordingPath;

      const currentRecording = state.recordings.find((recording) => recording.filename === state.recordingFilename);
      if (currentRecording) {
        currentRecording.saved = true;
      }
      hideAppDialog();
      syncModeUi();
      void logger.info("Current recording saved successfully.", {
        filename: state.recordingFilename,
        savedPath: state.recordingPath
      });
    } catch (error) {
      showErrorDialog("Save failed", error, "Photobooth could not save the recording.");
    } finally {
      state.isSaving = false;
      syncModeUi();
    }
  }

  async function handleRecordingStop() {
    state.recordingBlob = createRecordingBlob(state.recordingChunks, state.recorder);
    state.recordingUrl = createObjectUrl(state.recordingBlob);
    state.recordingFilename = buildTimestampFilename(getRecordingExtension(state.recordingBlob.type || state.recorder?.mimeType || "video/webm"));
    state.recordingPath = "";
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
    stopStream();
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
      void logger.warn("Start recording ignored because capture is not ready.", {
        captureReady: state.captureReady,
        captureInProgress: state.captureInProgress,
        hasStream: Boolean(state.stream)
      });
      return;
    }

    operatorScreen.syncCountdownFromControl();
    void logger.audit("Start recording requested.", {
      countdownSeconds: state.countdownSeconds,
      frameId: state.activeFrameId,
      hasOverlayText: Boolean(state.overlayText),
      hasLogo: Boolean(state.logoDataUrl)
    });
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
      void logger.info("Recording started.", {
        mimeType: state.recorder.mimeType,
        chunkIntervalMs: APP_THRESHOLDS.recorderChunkIntervalMs
      });
    } catch (error) {
      void logger.exception("Recording start failed.", error);
      stopRecordingTimer();
      composedRecorder?.stop();
      composedRecorder = null;
      resetCaptureState();
      dom.snapButton.disabled = false;
      syncModeUi();
      showErrorDialog("Recording error", error, APP_STRINGS.recordingFailed);
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
    const canDiscard = await confirmDiscardIfNeeded("take a new video");
    if (!canDiscard) {
      return;
    }

    stopRecordingTimer();
    composedRecorder?.stop();
    composedRecorder = null;
    resetCaptureState();
    state.recordingChunks = [];
    state.recordingBlob = null;
    state.recordingUrl = "";
    state.recordingFilename = "";
    state.recordingPath = "";

    editorScreen.resetResultVideo();
    dom.snapButton.disabled = false;
    dom.recordingTimer.textContent = "00:00";
    state.mode = "camera";
    hideAppDialog();
    closeGalleryPanel();
    syncModeUi();
    void startCamera();
  }

  function handleResultEnded() {
    editorScreen.handlePlaybackStateChange();
  }

  async function pickSaveFolder() {
    void logger.audit("Main app choose folder action started.");
    const result = await operatorScreen.pickSaveFolder();
    if (result === "cancelled") {
      void logger.info("Main app choose folder action cancelled.");
      syncModeUi();
      return;
    }

    if (result === "unsupported") {
      showAppDialog("Folder access unavailable", APP_STRINGS.folderUnsupported);
      syncModeUi();
      return;
    }
    hideAppDialog();
    syncModeUi();
  }

  async function handleMediaInputChange() {
    operatorScreen.syncMediaInputSelections();
    if (state.mode === "camera") {
      await startCamera();
    }
  }

  async function handleCreateProject() {
    const projectName = dom.projectNameInput.value.trim();
    const validationError = validateProjectName(projectName);
    if (validationError) {
      void logger.warn("Project creation blocked by validation.", { projectName, validationError });
      showProjectError(validationError);
      return;
    }

    try {
      void logger.audit("Project creation requested.", { projectName });
      if (state.isDesktopApp) {
        const baseDirectory = await getDefaultRecordingsDirectory();
        const projectDirectory = await createDesktopProjectDirectory(projectName, baseDirectory);
        state.saveDirectoryPath = projectDirectory;
        state.saveDirectoryName = projectDirectory.split(/[\\/]/).filter(Boolean).pop() || projectName;
      } else {
        state.saveDirectoryName = projectName;
      }

      resetProjectDesignState();
      persistSettings(state);
      hideProjectDialog();
      void logger.info("Project created successfully.", {
        projectName,
        saveDirectoryPath: state.saveDirectoryPath,
        saveDirectoryName: state.saveDirectoryName
      });
    } catch (error) {
      void logger.exception("Project creation failed.", error, { projectName });
      showProjectError(formatErrorMessage(error, APP_STRINGS.projectCreateFailed));
    }
  }

  async function bootstrapApp() {
    editorScreen.showResult();
    syncModeUi();
    void logger.info("Bootstrap sequence started.");

    try {
      await Promise.all([
        loadAppVersion(),
        refreshMediaDeviceOptions(),
        getFullscreenState().then((fullscreen) => {
          state.isFullscreen = fullscreen;
          syncModeUi();
        })
      ]);
    } finally {
      await sleep(600);
      dom.launchOverlay.classList.add("hidden");
      showProjectDialog();
      void logger.info("Bootstrap sequence completed.");
    }
  }

  dom.appDialogCloseButton.addEventListener("click", () => {
    hideAppDialog(false);
  });
  dom.appDialogCancelButton.addEventListener("click", () => {
    hideAppDialog(false);
  });
  dom.appDialogConfirmButton.addEventListener("click", () => {
    hideAppDialog(dialogIsConfirmation);
  });
  dom.projectContinueButton.addEventListener("click", () => {
    hideProjectDialog();
  });
  dom.projectCreateButton.addEventListener("click", () => {
    void handleCreateProject();
  });
  dom.projectNameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleCreateProject();
    }
  });
  dom.cameraInputSelect.addEventListener("change", () => {
    void handleMediaInputChange();
  });
  dom.audioInputSelect.addEventListener("change", () => {
    void handleMediaInputChange();
  });
  navigator.mediaDevices?.addEventListener?.("devicechange", () => {
    void refreshMediaDeviceOptions();
  });

  window.addEventListener("error", (event) => {
    if (!event.message && !event.error) {
      return;
    }

    void logger.exception("Unhandled window error.", event.error || event.message, {
      message: event.message || ""
    });
    showErrorDialog("Photobooth", event.error || event.message, "An unexpected error occurred.");
  });

  window.addEventListener("unhandledrejection", (event) => {
    void logger.exception("Unhandled promise rejection.", event.reason);
    showErrorDialog("Photobooth", event.reason, "An unexpected error occurred.");
  });

  window.addEventListener("beforeunload", (event) => {
    if (!hasUnsavedRecording()) {
      return;
    }

    event.preventDefault();
    event.returnValue = "";
  });

  document.body.dataset.mode = state.mode;
  operatorScreen.syncControlsFromState();
  operatorScreen.renderFrameTray();
  editorScreen.renderOverlayPreview();
  editorScreen.syncPlaybackButton();
  editorScreen.syncEmptyState();
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
    if (state.galleryPanelOpen) {
      void galleryScreen.refreshGallery();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      void restoreFullscreenIfNeeded();
      if (state.galleryPanelOpen) {
        void galleryScreen.refreshGallery();
      }
    }
  });
  wireEvents(dom, state, {
    captureVideo,
    closeGalleryPanel,
    closeOperatorPanel,
    handleResultReset,
    handleResultEnded,
    hideAppDialog,
    openGalleryFolder,
    openGalleryPanel,
    openPreviewView,
    openSettingsView,
    pickSaveFolder,
    saveCurrentRecording,
    openSlideshowWindow,
    closeApp,
    operatorScreen,
    editorScreen,
    galleryScreen
  });
  syncModeUi();
  void bootstrapApp();
}





