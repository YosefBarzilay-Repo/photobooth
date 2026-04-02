import createGalleryScreen from "../screens/galleryScreen.js";
import wireEvents from "./events.js";
import { APP_DEFAULTS, APP_STRINGS, APP_THRESHOLDS } from "../constants/appConfig.js";
import { sleep, clearIntervalTimer, clearTimer } from "../utils/timing.js";
import { getCameraErrorMessage, startCameraStream, stopCameraStream } from "../services/cameraService.js";
import { createMediaRecorder, createRecordingBlob, getRecordingExtension } from "../services/recordingService.js";
import {
  createObjectUrl,
  deleteSavedRecording,
  ensureRecordingEntryUrl,
  saveRecording,
  buildTimestampFilename,
  loadSavedRecordingsFromDirectory
} from "../services/downloadService.js";
import {
  applyCurrentWindowDisplaySettings,
  closeDesktopApp,
  closeExternalDesktopSlideshows,
  createDesktopProjectDirectory,
  deleteDesktopProjectDirectory,
  getDefaultRecordingsDirectory,
  getDesktopAppVersion,
  isDesktopApp,
  listActiveDesktopSlideshows,
  listDesktopProjects,
  openDesktopSlideshowWindow,
  openDesktopDirectory,
  renameDesktopProjectDirectory,
  setFullscreenState
} from "../services/desktopService.js";
import {
  applyPersistedSettings,
  loadDesktopPersistedSettings,
  loadPersistedSettings,
  loadProjectMetadata,
  persistSettings,
  saveProjectMetadata
} from "../services/settingsPersistence.js";
import {
  buildAudioOutputOptions,
  buildAudioInputOptions,
  buildVideoInputOptions,
  enumerateInputDevices
} from "../services/mediaDeviceService.js";
import { logger } from "../services/logger.js";
import { createTextOverlay, createLogoOverlay, getActiveOverlay, getOverlays, syncActiveOverlayState } from "../utils/overlayState.js";

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

function buildDefaultProjectName() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${pad(now.getDate())}${pad(now.getMonth() + 1)}${String(now.getFullYear()).slice(-2)}${pad(now.getHours())}${pad(now.getMinutes())}`;
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

function drawVideoFrame(ctx, video, width, height, captureOrientation = "landscape") {
  const videoWidth = video.videoWidth || width;
  const videoHeight = video.videoHeight || height;
  const useCover = captureOrientation === "portrait";
  const scale = useCover
    ? Math.max(width / videoWidth, height / videoHeight)
    : Math.min(width / videoWidth, height / videoHeight);
  const targetWidth = videoWidth * scale;
  const targetHeight = videoHeight * scale;
  const targetX = (width - targetWidth) / 2;
  const targetY = (height - targetHeight) / 2;

  ctx.save();
  ctx.fillStyle = "#050507";
  ctx.fillRect(0, 0, width, height);
  ctx.translate(width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, videoWidth, videoHeight, width - targetX - targetWidth, targetY, targetWidth, targetHeight);
  ctx.restore();
}

function drawOverlayText(ctx, overlay, width, height, metrics = null) {
  if (!overlay?.text || !metrics) {
    return;
  }

  ctx.save();
  ctx.translate((overlay.position.x / 100) * width, (overlay.position.y / 100) * height);
  ctx.rotate((overlay.rotation * Math.PI) / 180);
  ctx.scale(metrics.scaleX, metrics.scaleY);
  ctx.fillStyle = overlay.color;
  ctx.font = `800 ${metrics.fontSize}px "${overlay.font}", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
  ctx.shadowBlur = 20;
  const textMetrics = ctx.measureText(overlay.text);
  const ascent = textMetrics.actualBoundingBoxAscent || metrics.fontSize * 0.8;
  const descent = textMetrics.actualBoundingBoxDescent || metrics.fontSize * 0.2;
  const baselineOffset = (ascent - descent) / 2;
  ctx.fillText(overlay.text, 0, baselineOffset);
  ctx.restore();
}

function drawOverlayLogo(ctx, overlay, width, height, logoImage, metrics = null) {
  if (!logoImage || !metrics) {
    return;
  }

  const logoWidth = metrics.width;
  const logoHeight = metrics.height;

  ctx.save();
  ctx.translate((overlay.position.x / 100) * width, (overlay.position.y / 100) * height);
  ctx.rotate((overlay.rotation * Math.PI) / 180);
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

function getCompositionSize(stageElement, captureOrientation = "landscape") {
  const rect = stageElement.getBoundingClientRect();
  const isPortrait = captureOrientation === "portrait";
  return {
    stageWidth: Math.max(1, rect.width || (isPortrait ? APP_THRESHOLDS.composedPortraitWidth : APP_THRESHOLDS.composedLandscapeWidth)),
    stageHeight: Math.max(1, rect.height || (isPortrait ? APP_THRESHOLDS.composedPortraitHeight : APP_THRESHOLDS.composedLandscapeHeight)),
    width: isPortrait ? APP_THRESHOLDS.composedPortraitWidth : APP_THRESHOLDS.composedLandscapeWidth,
    height: isPortrait ? APP_THRESHOLDS.composedPortraitHeight : APP_THRESHOLDS.composedLandscapeHeight
  };
}

function getOverlayMetrics(dom, state, compositionSize) {
  const stageScaleX = compositionSize.width / compositionSize.stageWidth;
  const stageScaleY = compositionSize.height / compositionSize.stageHeight;
  const metrics = new Map();

  dom.cameraText.querySelectorAll(".overlay-item").forEach((overlayElement) => {
    if (!(overlayElement instanceof HTMLElement)) {
      return;
    }

    const overlayId = overlayElement.dataset.overlayId || "";
    const overlay = getOverlays(state).find((entry) => entry.id === overlayId);
    if (!overlay) {
      return;
    }

    if (overlay.type === "text") {
      const textElement = overlayElement.querySelector(".overlay-caption");
      if (textElement instanceof HTMLElement) {
        const fontSize = Number.parseFloat(window.getComputedStyle(textElement).fontSize) || overlay.size;
        metrics.set(overlay.id, {
          fontSize: Math.max(1, fontSize * stageScaleY),
          scaleX: Number.isFinite(overlay.scaleX) ? overlay.scaleX : 1,
          scaleY: Number.isFinite(overlay.scaleY) ? overlay.scaleY : 1
        });
      }
      return;
    }

    const logoElement = overlayElement.querySelector(".overlay-logo-image");
    if (logoElement instanceof HTMLImageElement) {
      const overlayScaleX = Number.isFinite(overlay.scaleX) ? overlay.scaleX : 1;
      const overlayScaleY = Number.isFinite(overlay.scaleY) ? overlay.scaleY : 1;
      metrics.set(overlay.id, {
        width: Math.max(1, logoElement.offsetWidth * overlayScaleX * stageScaleX),
        height: Math.max(1, logoElement.offsetHeight * overlayScaleY * stageScaleY)
      });
    }
  });

  return metrics;
}

function createComposedRecorder(state, previewVideo, dom) {
  const compositionSize = getCompositionSize(dom.cameraStage, state.captureOrientation);
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
  let videoFrameCallbackId = 0;
  let stopped = false;
  const logoImages = new Map();

  const render = () => {
    if (stopped) {
      return;
    }

    const overlayMetrics = getOverlayMetrics(dom, state, compositionSize);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawVideoFrame(ctx, previewVideo, canvas.width, canvas.height, state.captureOrientation);
    getOverlays(state).forEach((overlay) => {
      if (overlay.type === "logo" && overlay.dataUrl) {
        if (!logoImages.has(overlay.id)) {
          const image = new Image();
          image.src = overlay.dataUrl;
          logoImages.set(overlay.id, image);
        }
        drawOverlayLogo(ctx, overlay, canvas.width, canvas.height, logoImages.get(overlay.id), overlayMetrics.get(overlay.id) || null);
        return;
      }

      if (overlay.type === "text" && overlay.text) {
        drawOverlayText(ctx, overlay, canvas.width, canvas.height, overlayMetrics.get(overlay.id) || null);
      }
    });
    drawFrameOverlay(ctx, state.activeFrameId, canvas.width, canvas.height);
  };

  const scheduleRender = () => {
    if (stopped) {
      return;
    }

    if (typeof previewVideo.requestVideoFrameCallback === "function") {
      videoFrameCallbackId = previewVideo.requestVideoFrameCallback(() => {
        render();
        scheduleRender();
      });
      return;
    }

    rafId = window.requestAnimationFrame(() => {
      render();
      scheduleRender();
    });
  };

  render();
  scheduleRender();

  return {
    stream,
    stop() {
      stopped = true;
      window.cancelAnimationFrame(rafId);
      previewVideo.cancelVideoFrameCallback?.(videoFrameCallbackId);
      stream.getTracks().forEach((track) => track.stop());
    }
  };
}

function createDirectRecorder(previewVideo) {
  const sourceStream = previewVideo.srcObject instanceof MediaStream ? previewVideo.srcObject : null;
  if (!sourceStream) {
    throw new Error(APP_STRINGS.recordingFailed);
  }

  const stream = new MediaStream();
  sourceStream.getVideoTracks().forEach((track) => stream.addTrack(track.clone()));
  sourceStream.getAudioTracks().forEach((track) => stream.addTrack(track.clone()));

  return {
    stream,
    stop() {
      stream.getTracks().forEach((track) => track.stop());
    }
  };
}

async function requestFullscreenIfPossible(desired = true) {
  if (isDesktopApp()) {
    return setFullscreenState(Boolean(desired));
  }

  if (!desired) {
    if (document.fullscreenElement) {
      await document.exitFullscreen?.();
    }
    return Boolean(document.fullscreenElement);
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

/**
 * Creates the main app runtime and starts bootstrap.
 *
 * @param {{
 *   state: import("../types/app.js").AppState & { isDesktopApp?: boolean },
 *   dom: import("../types/dom.js").DomRefs,
 *   cameraScreen: ReturnType<typeof import("../screens/cameraScreen.js").default>,
 *   editorScreen: ReturnType<typeof import("../screens/editorScreen.js").default>,
 *   operatorScreen: ReturnType<typeof import("../screens/operatorScreen.js").default>
 * }} dependencies
 * @returns {void}
 */
export default function createAppRuntime({
  state,
  dom,
  cameraScreen,
  editorScreen,
  operatorScreen
}) {
  let composedRecorder = null;
  let cameraSessionId = 0;
  let dialogResolver = null;
  let dialogIsConfirmation = false;
  let projectDialogMode = "create";
  let projectDialogProject = null;
  let recentProjects = [];
  let projectMetadataProject = null;
  let previewAccessClickCount = 0;
  let previewAccessClickTimer = null;
  let activeSlideshowsCache = [];
  let activeSlideshowsCacheTimestamp = 0;
  let activeSlideshowsPromise = null;
  let pendingSlideshowProjectPath = "";
  const ACTIVE_SLIDESHOW_CACHE_MS = 30000;

  function showLaunchOverlay(title, message) {
    dom.launchOverlayTitle.textContent = title;
    dom.launchOverlayMessage.textContent = message;
    dom.launchOverlay.classList.remove("hidden");
  }

  function hideLaunchOverlay() {
    dom.launchOverlay.classList.add("hidden");
  }

  function normalizeProjectPath(projectPath) {
    return String(projectPath || "").trim().toLowerCase();
  }

  function invalidateActiveSlideshowsCache() {
    activeSlideshowsCache = [];
    activeSlideshowsCacheTimestamp = 0;
    activeSlideshowsPromise = null;
  }

  function markProjectSlideshowActive(projectPath) {
    const normalizedProjectPath = normalizeProjectPath(projectPath);
    if (!normalizedProjectPath) {
      return;
    }

    activeSlideshowsCache = [
      ...activeSlideshowsCache.filter((entry) => normalizeProjectPath(entry.projectPath) !== normalizedProjectPath),
      { pid: 0, projectPath }
    ];
    activeSlideshowsCacheTimestamp = Date.now();
  }

  function removeProjectSlideshowFromCache(projectPath) {
    const normalizedProjectPath = normalizeProjectPath(projectPath);
    if (!normalizedProjectPath) {
      return;
    }

    activeSlideshowsCache = activeSlideshowsCache.filter((entry) => normalizeProjectPath(entry.projectPath) !== normalizedProjectPath);
    activeSlideshowsCacheTimestamp = Date.now();
  }

  async function getActiveSlideshows(forceRefresh = false) {
    if (!state.isDesktopApp) {
      return [];
    }

    const now = Date.now();
    if (!forceRefresh && activeSlideshowsCacheTimestamp > 0 && now - activeSlideshowsCacheTimestamp < ACTIVE_SLIDESHOW_CACHE_MS) {
      return activeSlideshowsCache;
    }

    if (!forceRefresh && activeSlideshowsPromise) {
      return activeSlideshowsPromise;
    }

    try {
      activeSlideshowsPromise = listActiveDesktopSlideshows()
        .then((slideshows) => {
          activeSlideshowsCache = Array.isArray(slideshows) ? slideshows : [];
          activeSlideshowsCacheTimestamp = Date.now();
          return activeSlideshowsCache;
        })
        .finally(() => {
          activeSlideshowsPromise = null;
        });
      return await activeSlideshowsPromise;
    } catch (error) {
      invalidateActiveSlideshowsCache();
      void logger.warn("Active slideshow list failed.", {
        error: error instanceof Error ? error.message : String(error || "")
      });
      return [];
    }
  }

  async function hasActiveSlideshowForProject(projectPath, forceRefresh = false) {
    const normalizedProjectPath = normalizeProjectPath(projectPath);
    if (!normalizedProjectPath) {
      return false;
    }

    if (normalizeProjectPath(pendingSlideshowProjectPath) === normalizedProjectPath) {
      return true;
    }

    const activeSlideshows = await getActiveSlideshows(forceRefresh);
    return activeSlideshows.some((entry) => normalizeProjectPath(entry.projectPath) === normalizedProjectPath);
  }

  function syncModeUi() {
    cameraScreen.syncModeUi();
  }

  async function validateActiveProjectSelection() {
    if (!state.isDesktopApp) {
      return;
    }

    const defaultDirectory = await getDefaultRecordingsDirectory();
    const projects = await listDesktopProjects();
    const activeProjectPath = String(state.activeProjectPath || "").trim();
    const hasActiveProject = activeProjectPath
      && projects.some((project) => project.path?.toLowerCase() === activeProjectPath.toLowerCase());

    if (hasActiveProject) {
      return;
    }

    state.activeProjectPath = "";
    state.saveDirectoryHandle = null;
    state.saveDirectoryPath = defaultDirectory;
    state.saveDirectoryName = APP_STRINGS.saveFolderDefault;
    persistSettings(state);
  }

  function resetDialogState() {
    dialogResolver = null;
    dialogIsConfirmation = false;
  }

  function resetProjectDialogState() {
    projectDialogMode = "create";
    projectDialogProject = null;
  }

  function resetPreviewAccessClicks() {
    previewAccessClickCount = 0;
    if (previewAccessClickTimer !== null) {
      window.clearTimeout(previewAccessClickTimer);
      previewAccessClickTimer = null;
    }
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

  async function showProjectDialog() {
    projectDialogMode = "create";
    projectDialogProject = null;
    recentProjects = state.isDesktopApp ? (await listDesktopProjects()).slice(0, 5) : [];
    const hasCurrentProject = Boolean(String(state.activeProjectPath || "").trim());
    dom.projectDialogTitle.textContent = "Project";
    dom.projectDialogMessage.textContent = "Create a new project folder for this event, or continue with the current setup.";
    dom.projectContinueButton.textContent = "Continue Current";
    dom.projectContinueButton.disabled = !hasCurrentProject && recentProjects.length === 0;
    dom.projectCreateButton.textContent = "Create Project";
    dom.projectDialogError.textContent = "";
    dom.projectDialogError.classList.add("hidden");
    dom.projectNameInput.value = buildDefaultProjectName();
    dom.projectNameInput.dataset.autoclear = "true";
    dom.projectContinueButton.classList.remove("hidden");
    const recentList = document.getElementById("projectRecentList");
    if (recentList) {
      recentList.replaceChildren();
      recentProjects.forEach((project, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "secondary-button project-recent-button";
        button.dataset.recentIndex = String(index);
        button.textContent = project.name;
        recentList.appendChild(button);
      });
      recentList.classList.toggle("hidden", recentProjects.length === 0);
    }
    dom.projectDialogOverlay.classList.remove("hidden");
    window.setTimeout(() => dom.projectNameInput.focus(), 0);
  }

  function hideProjectDialog() {
    dom.projectDialogOverlay.classList.add("hidden");
    resetProjectDialogState();
  }

  function showProjectError(message) {
    dom.projectDialogError.textContent = message;
    dom.projectDialogError.classList.remove("hidden");
  }

  function registerPreviewAccessClick() {
    if (state.mode !== "camera") {
      return;
    }

    previewAccessClickCount += 1;
    if (previewAccessClickCount >= APP_THRESHOLDS.operatorAccessClickCount) {
      resetPreviewAccessClicks();
      openPreviewView();
      return;
    }

    if (previewAccessClickTimer !== null) {
      window.clearTimeout(previewAccessClickTimer);
    }

    previewAccessClickTimer = window.setTimeout(resetPreviewAccessClicks, APP_THRESHOLDS.operatorAccessTimeoutMs);
  }

  function showRenameProjectDialog(project) {
    projectDialogMode = "rename";
    projectDialogProject = project;
    dom.projectDialogTitle.textContent = "Rename Project";
    dom.projectDialogMessage.textContent = "Update the project folder name.";
    dom.projectContinueButton.textContent = "Cancel";
    dom.projectContinueButton.disabled = false;
    dom.projectCreateButton.textContent = "Save Name";
    dom.projectDialogError.textContent = "";
    dom.projectDialogError.classList.add("hidden");
    dom.projectNameInput.value = project.name;
    dom.projectContinueButton.classList.remove("hidden");
    dom.projectDialogOverlay.classList.remove("hidden");
    window.setTimeout(() => {
      dom.projectNameInput.focus();
      dom.projectNameInput.select();
    }, 0);
  }

  function hideProjectMetadataDialog() {
    dom.projectMetadataOverlay.classList.add("hidden");
    dom.projectMetadataMessage.textContent = "";
    dom.projectMetadataMessage.classList.add("hidden");
    dom.projectMetadataError.textContent = "";
    dom.projectMetadataError.classList.add("hidden");
    projectMetadataProject = null;
  }

  function setProjectMetadataError(message) {
    dom.projectMetadataError.textContent = message;
    dom.projectMetadataError.classList.remove("hidden");
  }

  async function showProjectMetadataDialog(project) {
    projectMetadataProject = project;
    dom.projectMetadataTitle.textContent = `${project.name} Booking Details`;
    dom.projectMetadataMessage.textContent = "";
    dom.projectMetadataMessage.classList.add("hidden");
    dom.projectMetadataError.textContent = "";
    dom.projectMetadataError.classList.add("hidden");

    let metadata = await loadProjectMetadata(project.path);
    if (state.isDesktopApp && (!metadata.orderId || !metadata.projectDate || !metadata.projectStatus)) {
      const projects = await listDesktopProjects();
      const projectIndex = projects.findIndex((entry) => entry.path?.toLowerCase() === project.path?.toLowerCase());
      metadata = {
        ...metadata,
        orderId: metadata.orderId || String(Math.max(0, projectIndex) + 1).padStart(4, "0"),
        clientName: metadata.clientName || project.name,
        projectDate: metadata.projectDate || new Date(project.createdAt || Date.now()).toISOString().slice(0, 10),
        projectStatus: metadata.projectStatus || "New"
      };
      await saveProjectMetadata(project.path, metadata);
    }

    dom.projectFolderNameInput.value = project.name;
    dom.projectOrderInput.value = metadata.orderId;
    dom.projectClientNameInput.value = metadata.clientName;
    dom.projectDateInput.value = metadata.projectDate;
    dom.projectStatusInput.value = metadata.projectStatus;
    dom.projectPhoneInput.value = metadata.phone;
    dom.projectEmailInput.value = metadata.email;
    dom.projectAddressInput.value = metadata.address;
    dom.projectNotesInput.value = metadata.notes;
    dom.projectMetadataOverlay.classList.remove("hidden");
    window.setTimeout(() => dom.projectOrderInput.focus(), 0);
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

    const shouldSave = await requestConfirmation({
      title: "Unsaved Video",
      message: `Save video before ${actionLabel}?`,
      confirmLabel: "Yes",
      cancelLabel: "No"
    });

    if (!shouldSave) {
      discardCurrentRecording();
      return true;
    }

    return saveCurrentRecording();
  }

  function discardCurrentRecording() {
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
  }

  async function refreshMediaDeviceOptions() {
    const { videoInputs, audioInputs, audioOutputs } = await enumerateInputDevices();
    operatorScreen.populateMediaDeviceOptions({
      videoOptions: buildVideoInputOptions(videoInputs),
      audioOptions: buildAudioInputOptions(audioInputs),
      audioOutputOptions: buildAudioOutputOptions(audioOutputs)
    });
    persistSettings(state);
  }

  async function refreshHardwareOptions() {
    await Promise.allSettled([
      refreshMediaDeviceOptions(),
      operatorScreen.loadMonitorOptions()
    ]);
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
    try {
      return await loadSavedRecordingsFromDirectory(source);
    } catch (error) {
      void logger.exception("Loading gallery entries failed.", error, {
        source: typeof source === "string" ? source : source?.name || ""
      });
      throw error;
    }
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
    try {
      void logger.audit("Project list requested.", { saveDirectoryPath: state.saveDirectoryPath });
      const projectList = await listDesktopProjects();
      void logger.info("Project list loaded.", { count: projectList.length });
      return projectList;
    } catch (error) {
      void logger.exception("Project list load failed.", error, { saveDirectoryPath: state.saveDirectoryPath });
      throw error;
    }
  }
  function setActiveProject(projectPath, projectName, persistSelection = true) {
    state.saveDirectoryHandle = null;
    state.saveDirectoryPath = projectPath;
    state.saveDirectoryName = projectName || String(projectPath || "").split(/[\\/]/).filter(Boolean).pop() || APP_STRINGS.saveFolderDefault;
    state.activeProjectPath = projectPath;
    if (persistSelection) {
      persistSettings(state);
    }
  }

  async function loadProjectConfiguration(projectPath = state.activeProjectPath) {
    const normalizedProjectPath = String(projectPath || "").trim();
    if (!normalizedProjectPath) {
      return;
    }

    const projectSettings = state.isDesktopApp
      ? await loadDesktopPersistedSettings(normalizedProjectPath)
      : loadPersistedSettings(normalizedProjectPath);

    applyPersistedSettings(state, { ...APP_DEFAULTS, saveFolderDefault: APP_STRINGS.saveFolderDefault }, projectSettings);
    state.saveDirectoryPath = normalizedProjectPath;
    state.saveDirectoryName = projectSettings?.saveDirectoryName
      || String(normalizedProjectPath).split(/[\\/]/).filter(Boolean).pop()
      || APP_STRINGS.saveFolderDefault;
    state.activeProjectPath = normalizedProjectPath;
    operatorScreen.syncControlsFromState();
    operatorScreen.renderFrameTray();
    editorScreen.syncOrientationUi();
    editorScreen.renderOverlayPreview();
    syncModeUi();
  }

  async function openProject(project) {
    const canProceed = await confirmDiscardIfNeeded("switching projects");
    if (!canProceed) {
      return;
    }

    setActiveProject(project.path, project.name, false);
    await loadProjectConfiguration(project.path);
    persistSettings(state);
    if (state.galleryPanelOpen) {
      await galleryScreen.refreshGallery();
    }
    hideAppDialog();
    syncModeUi();
  }

  async function openRecentProjectByIndex(index) {
    const project = recentProjects[index];
    if (!project) {
      return;
    }

    await openProject(project);
    hideProjectDialog();
  }
  async function openProjectFolder(project) {
    try {
      await openDesktopDirectory(project.path);
    } catch (error) {
      showErrorDialog("Folder unavailable", error, APP_STRINGS.openFolderUnavailable);
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
        state.activeProjectPath = "";
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
      showErrorDialog("Delete failed", error, "Echo could not delete the selected project.");
    }
  }

  async function openProjectMetadata(project) {
    try {
      await showProjectMetadataDialog(project);
    } catch (error) {
      showErrorDialog("Booking unavailable", error, "Echo could not load the project booking details.");
    }
  }

  async function closeProjectSlideshow(projectPath = state.activeProjectPath || state.saveDirectoryPath) {
    const normalizedProjectPath = String(projectPath || "").trim();
    if (!normalizedProjectPath) {
      return;
    }

    if (state.isDesktopApp) {
      removeProjectSlideshowFromCache(normalizedProjectPath);
      await closeExternalDesktopSlideshows(normalizedProjectPath);
      if (normalizeProjectPath(pendingSlideshowProjectPath) === normalizeProjectPath(normalizedProjectPath)) {
        pendingSlideshowProjectPath = "";
      }
      await getActiveSlideshows(true);
    }

    if (state.galleryPanelOpen) {
      await galleryScreen.syncSlideshowButton(true);
    }
  }

  async function closeAllSlideshows() {
    if (state.isDesktopApp) {
      await closeExternalDesktopSlideshows();
      pendingSlideshowProjectPath = "";
      activeSlideshowsCache = [];
      activeSlideshowsCacheTimestamp = Date.now();
      activeSlideshowsPromise = null;
    }

    if (state.galleryPanelOpen) {
      await galleryScreen.syncSlideshowButton();
    }
  }

  async function startProjectSlideshow() {
    const canProceed = await confirmDiscardIfNeeded("starting the slideshow");
    if (!canProceed) {
      return false;
    }

    if (!state.activeProjectPath) {
      showAppDialog("Slideshow unavailable", "Choose a project first.");
      return false;
    }

    try {
      if (!state.isDesktopApp) {
        showAppDialog("Slideshow unavailable", "Slideshows are available only in the desktop app.");
        return false;
      }

      if (await hasActiveSlideshowForProject(state.activeProjectPath, true)) {
        if (state.galleryPanelOpen) {
          await galleryScreen.syncSlideshowButton(true);
        }
        return true;
      }

      pendingSlideshowProjectPath = state.activeProjectPath;
      if (state.galleryPanelOpen) {
        await galleryScreen.syncSlideshowButton();
      }
      persistSettings(state);
      await openDesktopSlideshowWindow(state.activeProjectPath);
      markProjectSlideshowActive(state.activeProjectPath);
      pendingSlideshowProjectPath = "";
      if (state.galleryPanelOpen) {
        await galleryScreen.syncSlideshowButton(true);
      }
      return true;
    } catch (error) {
      pendingSlideshowProjectPath = "";
      invalidateActiveSlideshowsCache();
      if (state.galleryPanelOpen) {
        await galleryScreen.syncSlideshowButton(true);
      }
      showErrorDialog("Slideshow unavailable", error, "Echo could not open the slideshow.");
      return false;
    }
  }

  async function toggleCurrentProjectSlideshow() {
    if (state.activeProjectPath && await hasActiveSlideshowForProject(state.activeProjectPath, true)) {
      await closeProjectSlideshow(state.activeProjectPath);
      return;
    }

    await startProjectSlideshow();
  }

  const galleryScreen = createGalleryScreen(dom, state, {
    loadEntries: loadGalleryEntries,
    loadProjects,
    async ensureEntryReady(entry) {
      await ensureRecordingEntryUrl(entry);
      return entry;
    },
    async openEntry(entry) {
      const canProceed = await confirmDiscardIfNeeded("opening another video");
      if (!canProceed) {
        return;
      }

      await ensureRecordingEntryUrl(entry);
      galleryScreen.setGalleryPanelOpen(false);
      hideAppDialog();
      applyPreviewEntry(entry);
    },
    async deleteEntry(entry) {
      try {
        const confirmed = await requestConfirmation({
          title: "Delete Video",
          message: `Delete ${entry.filename}?`,
          confirmLabel: "Yes",
          cancelLabel: "No"
        });
        if (!confirmed) {
          return false;
        }

        await deleteGalleryEntry(entry);
        return true;
      } catch (error) {
        showErrorDialog("Delete failed", error, "Echo could not delete the selected video.");
        return false;
      }
    },
    openProject,
    openProjectFolder,
    deleteProject,
    openProjectMetadata,
    hasActiveSlideshowForProject,
    startProjectSlideshow,
    closeProjectSlideshow,
    openNewProjectDialog: showProjectDialog
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
    clearTimer(state.recordingTimeoutId);
    state.recordingTimeoutId = null;
  }

  function updateRecordingTimer() {
    dom.recordingTimer.textContent = formatElapsedTime(state.recordStartedAt);
    syncModeUi();
  }

  function flash() {
    restartAnimation(dom.flashOverlay, "flash-active");
  }

  async function applyMainWindowDisplaySettings() {
    if (state.isDesktopApp) {
      state.isFullscreen = await applyCurrentWindowDisplaySettings({
        monitorId: state.mainWindowMonitorId,
        fullscreen: state.mainWindowFullscreen
      });
      syncModeUi();
      return;
    }

    state.isFullscreen = await requestFullscreenIfPossible(state.mainWindowFullscreen);
    syncModeUi();
  }

  async function closeApp() {
    const confirmed = hasUnsavedRecording()
      ? await confirmDiscardIfNeeded("closing the app")
      : await requestConfirmation({
        title: "Close App",
        message: "Are you sure you want to close the app?",
        confirmLabel: "Yes",
        cancelLabel: "No"
      });

    if (!confirmed) {
      return;
    }

    try {
      showLaunchOverlay("Closing", "Closing slideshows...");
      await closeAllSlideshows();
      showLaunchOverlay("Closing", "Saving current state...");
      persistSettings(state);
      showLaunchOverlay("Closing", "Closing app window...");
      await closeDesktopApp();
    } catch (error) {
      hideLaunchOverlay();
      showErrorDialog("Unable to close app", error, "Echo could not close right now.");
    }
  }

  async function openGalleryPanel(initialView = "videos") {
    try {
      hideAppDialog();
      void galleryScreen.openGalleryPanel(initialView).catch((error) => {
        showErrorDialog("Gallery unavailable", error, "Echo could not open the gallery.");
      });
      syncModeUi();
    } catch (error) {
      showErrorDialog("Gallery unavailable", error, "Echo could not open the gallery.");
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
    state.recordingTimeoutSeconds = APP_DEFAULTS.recordingTimeoutSeconds;
    state.captureOrientation = APP_DEFAULTS.captureOrientation;
    state.activeFrameId = APP_DEFAULTS.activeFrameId;
    state.overlays = [];
    state.activeOverlayId = null;
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
    state.slideshowSoundEnabled = APP_DEFAULTS.slideshowSoundEnabled;
    state.slideshowFadeDurationMs = APP_DEFAULTS.slideshowFadeDurationMs;
    state.draggingOverlayTarget = null;
    state.draggingOverlayId = null;
    state.dragStartRotation = 0;
    state.dragStartPointerAngle = null;
    state.dragRotationCenter = null;
    state.overlayInteraction = null;
    state.dragPointerId = null;
    state.dragStartPointer = null;
    state.dragSurfaceSize = null;
    state.dragStartPosition = null;
    state.dragStartOverlayScale = { x: 1, y: 1 };
    dom.logoInput.value = "";
    operatorScreen.syncControlsFromState();
    operatorScreen.renderFrameTray();
    editorScreen.syncOrientationUi();
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
    stopStream();
    operatorScreen.setCameraToggleActive(false);
    state.operatorReturnMode = state.mode;
    dom.resultVideo.pause();
    operatorScreen.switchSection("editor");
    state.mode = "camera";
    operatorScreen.setOperatorPanelOpen(true);
    syncModeUi();
    try {
      await refreshMediaDeviceOptions();
    } catch {
      // Ignore device list failures here; startCamera will surface stream errors.
    }
  }

  function closeOperatorPanel() {
    stopStream();
    operatorScreen.setCameraToggleActive(false);
    operatorScreen.setOperatorPanelOpen(false);
    hideAppDialog();

    if (state.operatorReturnMode === "editor") {
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

  function scheduleRecordingTimeout() {
    clearTimer(state.recordingTimeoutId);
    state.recordingTimeoutId = null;

    if (state.recordingTimeoutSeconds <= 0) {
      return;
    }

    state.recordingTimeoutId = window.setTimeout(() => {
      stopRecording();
    }, state.recordingTimeoutSeconds * 1000);
  }

  function stopStream() {
    cameraSessionId += 1;
    stopCameraStream(state.stream, [dom.cameraPreview]);
    state.stream = null;
    state.captureReady = false;
    state.settingsCameraEnabled = false;
    cameraScreen.clearError();
    dom.emptyCamera.classList.remove("hidden");
  }

  async function startCamera(options = {}) {
    const cameraSource = options.source === "settings" ? "settings" : "default";
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
      state.settingsCameraEnabled = cameraSource === "settings";
      operatorScreen.setCameraToggleActive(state.settingsCameraEnabled);
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
      state.settingsCameraEnabled = false;
      operatorScreen.setCameraToggleActive(false);
      dom.emptyCamera.classList.add("hidden");
      const cameraErrorMessage = getCameraErrorMessage(error);
      showErrorDialog("Camera unavailable", error, cameraErrorMessage);
      cameraScreen.showError(cameraErrorMessage);
    }

    if (cameraSessionId === sessionId) {
      void applyMainWindowDisplaySettings();
    }
  }

  async function saveCurrentRecording() {
    if (!state.recordingBlob || !state.recordingFilename) {
      void logger.warn("Save requested without an active recording.");
      return false;
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
        return false;
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
      return true;
    } catch (error) {
      showErrorDialog("Save failed", error, "Echo could not save the recording.");
      return false;
    } finally {
      state.isSaving = false;
      syncModeUi();
    }
  }

  async function handleRecordingStop() {
    try {
      state.recordingBlob = createRecordingBlob(state.recordingChunks, state.recorder);
      state.recordingUrl = createObjectUrl(state.recordingBlob);
      state.recordingFilename = buildTimestampFilename(getRecordingExtension(state.recordingBlob.type || state.recorder?.mimeType || "video/mp4"));
      state.recordingPath = "";
      state.recordings.push({
        url: state.recordingUrl,
        blob: state.recordingBlob,
        filename: state.recordingFilename,
        saved: false
      });
      stopStream();
      editorScreen.showResult();
    } catch (error) {
      void logger.exception("Recording stop failed.", error, {
        recorderMimeType: state.recorder?.mimeType || "",
        chunkCount: state.recordingChunks.length
      });
      discardCurrentRecording();
      state.mode = "camera";
      showErrorDialog("Recording error", error, "Echo blocked the recording because it was not exported as MP4.");
      void startCamera();
    } finally {
      stopRecordingTimer();
      composedRecorder?.stop();
      composedRecorder = null;
      resetCaptureState();
      dom.snapButton.disabled = false;
      dom.recordingTimer.textContent = "00:00";
      syncModeUi();
    }
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
      operatorScreen.syncRecordingTimeoutFromControl();
      void logger.audit("Start recording requested.", {
        countdownSeconds: state.countdownSeconds,
        recordingTimeoutSeconds: state.recordingTimeoutSeconds,
        captureOrientation: state.captureOrientation,
        frameId: state.activeFrameId,
        overlayCount: getOverlays(state).length
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
      const needsComposition = state.captureOrientation === "portrait"
        || state.activeFrameId !== "none"
        || getOverlays(state).length > 0;
      composedRecorder = needsComposition ? createComposedRecorder(state, dom.cameraPreview, dom) : createDirectRecorder(dom.cameraPreview);
      state.recorder = createMediaRecorder(composedRecorder.stream, { preferStableCanvas: needsComposition });
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
      scheduleRecordingTimeout();
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

    discardCurrentRecording();
    state.mode = "camera";
    hideAppDialog();
    closeGalleryPanel();
    syncModeUi();
    void startCamera();
  }

  function handleResultEnded() {
    editorScreen.handlePlaybackStateChange();
  }

  async function handleMediaInputChange() {
    operatorScreen.syncMediaInputSelections();
    if (state.stream) {
      await startCamera({ source: state.settingsCameraEnabled ? "settings" : "default" });
    }
  }

  function switchSettingsSection(section) {
    if (section !== "editor") {
      stopStream();
      operatorScreen.setCameraToggleActive(false);
    }
    operatorScreen.switchSection(section);
  }

  async function toggleEditorCamera() {
    if (state.settingsCameraEnabled) {
      stopStream();
      operatorScreen.setCameraToggleActive(false);
      syncModeUi();
      return;
    }

    await startCamera({ source: "settings" });
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
      if (projectDialogMode === "create") {
        const canProceed = await confirmDiscardIfNeeded("replacing the current project");
        if (!canProceed) {
          return;
        }
      }

      if (projectDialogMode === "rename" && projectDialogProject) {
        const previousProjectPath = projectDialogProject.path;
        void logger.audit("Project rename requested.", {
          previousProjectName: projectDialogProject.name,
          projectName
        });
        const renamedPath = await renameDesktopProjectDirectory(previousProjectPath, projectName);
        if (state.saveDirectoryPath === previousProjectPath) {
          setActiveProject(renamedPath, projectName);
        }
        hideProjectDialog();
        void logger.info("Project renamed successfully.", {
          previousProjectPath,
          renamedPath,
          projectName
        });
        return;
      }

      void logger.audit("Project creation requested.", { projectName });
      if (state.isDesktopApp) {
        const existingProjects = await listDesktopProjects();
        const baseDirectory = await getDefaultRecordingsDirectory();
        const projectDirectory = await createDesktopProjectDirectory(projectName, baseDirectory);
        state.saveDirectoryPath = projectDirectory;
        state.saveDirectoryName = projectDirectory.split(/[\\/]/).filter(Boolean).pop() || projectName;
        state.activeProjectPath = projectDirectory;
        await saveProjectMetadata(projectDirectory, {
          orderId: String(existingProjects.length + 1).padStart(4, "0"),
          clientName: projectName,
          projectDate: new Date().toISOString().slice(0, 10),
          projectStatus: "New",
          phone: "",
          email: "",
          address: "",
          notes: ""
        });
      } else {
        state.saveDirectoryName = projectName;
        state.activeProjectPath = "";
      }

      resetProjectDesignState();
      persistSettings(state);
      hideProjectDialog();
      if (state.galleryPanelOpen) {
        void galleryScreen.refreshGallery();
      }
      void logger.info("Project created successfully.", {
        projectName,
        saveDirectoryPath: state.saveDirectoryPath,
        saveDirectoryName: state.saveDirectoryName
      });
    } catch (error) {
      const fallbackMessage = projectDialogMode === "rename"
        ? "Echo could not rename the selected project."
        : APP_STRINGS.projectCreateFailed;
      void logger.exception(projectDialogMode === "rename" ? "Project rename failed." : "Project creation failed.", error, {
        projectName,
        projectPath: projectDialogProject?.path || ""
      });
      showProjectError(formatErrorMessage(error, fallbackMessage));
    }
  }

  async function bootstrapApp() {
    editorScreen.showResult();
    syncModeUi();
    void logger.info("Bootstrap sequence started.");
    showLaunchOverlay("Starting", "Loading app...");

    try {
      const desktopSettings = await loadDesktopPersistedSettings();
      if (desktopSettings) {
        applyPersistedSettings(state, { ...APP_DEFAULTS, saveFolderDefault: APP_STRINGS.saveFolderDefault }, desktopSettings);
        syncActiveOverlayState(state);
      }
      await validateActiveProjectSelection();

      await operatorScreen.loadMonitorOptions();
      operatorScreen.syncControlsFromState();
      operatorScreen.renderFrameTray();
      editorScreen.syncOrientationUi();
      editorScreen.renderOverlayPreview();
      editorScreen.syncEmptyState();
      syncModeUi();

      await Promise.all([
        loadAppVersion(),
        refreshHardwareOptions(),
        applyMainWindowDisplaySettings()
      ]);
    } finally {
      await sleep(600);
      hideLaunchOverlay();
      await showProjectDialog();
      void logger.info("Bootstrap sequence completed.");
    }
  }

  dom.appDialogCancelButton.addEventListener("click", () => {
    hideAppDialog(false);
  });
  dom.appDialogConfirmButton.addEventListener("click", () => {
    hideAppDialog(dialogIsConfirmation);
  });
  dom.projectContinueButton.addEventListener("click", () => {
    void (async () => {
      if (state.activeProjectPath) {
        await loadProjectConfiguration(state.activeProjectPath);
      }
      hideProjectDialog();
    })();
  });
  dom.projectCreateButton.addEventListener("click", () => {
    void handleCreateProject();
  });
  dom.projectNameInput.addEventListener("focus", () => {
    if (dom.projectNameInput.dataset.autoclear === "true") {
      dom.projectNameInput.value = "";
      dom.projectNameInput.dataset.autoclear = "false";
    }
  });
  document.getElementById("projectRecentList")?.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest("[data-recent-index]") : null;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const index = Number.parseInt(target.dataset.recentIndex || "", 10);
    if (Number.isFinite(index)) {
      void openRecentProjectByIndex(index);
    }
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
  dom.projectMetadataCancelButton.addEventListener("click", hideProjectMetadataDialog);
  dom.projectMetadataSaveButton.addEventListener("click", async () => {
    if (!projectMetadataProject) {
      return;
    }

    try {
      const nextProjectName = dom.projectFolderNameInput.value.trim();
      const previousProjectPath = projectMetadataProject.path;
      const previousProjectName = projectMetadataProject.name;
      const metadata = {
        orderId: dom.projectOrderInput.value,
        clientName: dom.projectClientNameInput.value,
        projectDate: dom.projectDateInput.value,
        projectStatus: dom.projectStatusInput.value,
        phone: dom.projectPhoneInput.value,
        email: dom.projectEmailInput.value,
        address: dom.projectAddressInput.value,
        notes: dom.projectNotesInput.value
      };
      const validationError = validateProjectName(nextProjectName);
      if (validationError) {
        setProjectMetadataError(validationError);
        return;
      }

      let nextProjectPath = projectMetadataProject.path;
      if (state.isDesktopApp && nextProjectName !== previousProjectName) {
        nextProjectPath = await renameDesktopProjectDirectory(previousProjectPath, nextProjectName);
        projectMetadataProject = {
          ...projectMetadataProject,
          path: nextProjectPath,
          name: nextProjectName
        };
        if (state.saveDirectoryPath === previousProjectPath || state.activeProjectPath === previousProjectPath) {
          setActiveProject(nextProjectPath, nextProjectName);
        }
      } else if (nextProjectName !== previousProjectName) {
        projectMetadataProject = {
          ...projectMetadataProject,
          name: nextProjectName
        };
        if (state.saveDirectoryName === previousProjectName) {
          state.saveDirectoryName = nextProjectName;
          persistSettings(state);
        }
      }

      await saveProjectMetadata(nextProjectPath, metadata);
      hideProjectMetadataDialog();
      if (state.galleryPanelOpen) {
        await galleryScreen.refreshGallery();
      }
    } catch (error) {
      setProjectMetadataError(formatErrorMessage(error, "Echo could not save the booking details."));
    }
  });
  dom.projectMetadataDeleteButton.addEventListener("click", async () => {
    if (!projectMetadataProject) {
      return;
    }

    try {
      const projectToDelete = projectMetadataProject;
      hideProjectMetadataDialog();
      await deleteProject(projectToDelete);
      if (state.galleryPanelOpen && state.galleryView === "projects") {
        await galleryScreen.refreshGallery();
      }
    } catch (error) {
      showErrorDialog("Delete failed", error, "Echo could not delete the selected project.");
    }
  });
  navigator.mediaDevices?.addEventListener?.("devicechange", () => {
    void refreshHardwareOptions();
  });

  window.addEventListener("error", (event) => {
    if (!event.message && !event.error) {
      return;
    }

    void logger.exception("Unhandled window error.", event.error || event.message, {
      message: event.message || ""
    });
    showErrorDialog("Echo", event.error || event.message, "An unexpected error occurred.");
  });

  window.addEventListener("unhandledrejection", (event) => {
    void logger.exception("Unhandled promise rejection.", event.reason);
    showErrorDialog("Echo", event.reason, "An unexpected error occurred.");
  });

  window.addEventListener("beforeunload", (event) => {
    if (!hasUnsavedRecording()) {
      return;
    }

    event.preventDefault();
    event.returnValue = "";
  });

  document.body.dataset.mode = state.mode;
  document.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });
  operatorScreen.syncControlsFromState();
  operatorScreen.renderFrameTray();
  editorScreen.syncOrientationUi();
  editorScreen.renderOverlayPreview();
  editorScreen.syncPlaybackButton();
  editorScreen.syncEmptyState();
  void requestFullscreenIfPossible(state.mainWindowFullscreen).then((fullscreen) => {
    state.isFullscreen = fullscreen;
    syncModeUi();
  });
  document.addEventListener("pointerdown", () => {
    void requestFullscreenIfPossible(state.mainWindowFullscreen).then((fullscreen) => {
      state.isFullscreen = fullscreen;
      syncModeUi();
    });
  }, { once: true });
  document.addEventListener("keydown", () => {
    void requestFullscreenIfPossible(state.mainWindowFullscreen).then((fullscreen) => {
      state.isFullscreen = fullscreen;
      syncModeUi();
    });
  }, { once: true });
  window.addEventListener("focus", () => {
    void applyMainWindowDisplaySettings();
    void refreshHardwareOptions();
    if (state.galleryPanelOpen) {
      void galleryScreen.syncSlideshowButton(true);
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      void applyMainWindowDisplaySettings();
      void refreshHardwareOptions();
      if (state.galleryPanelOpen) {
        void galleryScreen.syncSlideshowButton(true);
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
    applyMainWindowDisplaySettings,
    registerPreviewAccessClick,
    closeAllSlideshows,
    openGalleryFolder,
    openGalleryPanel,
    openPreviewView,
    openSettingsView,
    saveCurrentRecording,
    openSlideshowWindow: toggleCurrentProjectSlideshow,
    refreshHardwareOptions,
    switchSettingsSection,
    toggleEditorCamera,
    closeApp,
    operatorScreen,
    editorScreen,
    galleryScreen
  });
  syncModeUi();
  void bootstrapApp();
}
