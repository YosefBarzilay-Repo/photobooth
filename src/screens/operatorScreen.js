import { APP_THRESHOLDS, DISABLED_AUDIO_INPUT_ID } from "../constants/appConfig.js";
import renderFrameTray from "../components/frameTray.js";
import { isDesktopApp, listDesktopMonitors } from "../services/desktopService.js";
import { logger } from "../services/logger.js";
import {
  createLogoOverlay,
  createTextOverlay,
  getActiveOverlay,
  getOverlayById,
  getOverlays,
  removeOverlayById,
  syncActiveOverlayState
} from "../utils/overlayState.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getViewportLimits() {
  return {
    minX: APP_THRESHOLDS.dialogEdgeMargin,
    minY: APP_THRESHOLDS.dialogEdgeMargin,
    maxX: Math.max(APP_THRESHOLDS.dialogEdgeMargin, window.innerWidth - APP_THRESHOLDS.dialogEdgeMargin),
    maxY: Math.max(APP_THRESHOLDS.dialogEdgeMargin, window.innerHeight - APP_THRESHOLDS.dialogEdgeMargin)
  };
}

function replaceSelectOptions(select, options, selectedValue) {
  select.replaceChildren();

  options.forEach((option) => {
    const optionElement = document.createElement("option");
    optionElement.value = option.value;
    optionElement.textContent = option.label;
    select.appendChild(optionElement);
  });

  const hasSelected = options.some((option) => option.value === selectedValue);
  select.value = hasSelected ? selectedValue : options[0]?.value || "";
}

export default function createOperatorScreen(dom, state, editorScreen, onSettingsChanged = () => {}) {
  let operatorAccessClickCount = 0;
  let operatorAccessClickTimer = null;
  let activeSection = "editor";
  let dialogRect = {
    x: APP_THRESHOLDS.dialogEdgeMargin,
    y: APP_THRESHOLDS.dialogEdgeMargin,
    width: APP_THRESHOLDS.dialogDefaultWidth,
    height: APP_THRESHOLDS.dialogDefaultHeight
  };
  let dialogPointerId = null;
  let dialogInteraction = null;
  let dialogStartPointer = null;
  let dialogStartRect = null;
  let monitorOptions = [{ value: "", label: "Current Monitor" }];
  let audioOutputOptions = [{ value: "", label: "System Default Output" }];

  function notifySettingsChanged() {
    onSettingsChanged(state);
  }

  function getActiveOverlayOrSync() {
    return syncActiveOverlayState(state);
  }

  function setActiveOverlay(overlayId) {
    state.activeOverlayId = overlayId;
    state.showTextColorPalette = false;
    syncControlsFromState();
    renderPreview();
  }

  function createInitialTextOverlay() {
    const overlay = createTextOverlay({
      text: dom.textInput.value.trim() || "New Text",
      font: dom.fontSelect.value,
      color: state.overlayColor,
      size: state.overlaySize
    });
    state.overlays = [...getOverlays(state), overlay];
    setActiveOverlay(overlay.id);
    notifySettingsChanged();
  }

  function syncDialogRect() {
    const limits = getViewportLimits();
    const maxWidth = Math.max(APP_THRESHOLDS.dialogMinWidth, window.innerWidth - APP_THRESHOLDS.dialogEdgeMargin * 2);
    const maxHeight = Math.max(APP_THRESHOLDS.dialogMinHeight, window.innerHeight - APP_THRESHOLDS.dialogEdgeMargin * 2);

    dialogRect.width = clamp(dialogRect.width, APP_THRESHOLDS.dialogMinWidth, maxWidth);
    dialogRect.height = clamp(dialogRect.height, APP_THRESHOLDS.dialogMinHeight, maxHeight);
    dialogRect.x = clamp(dialogRect.x, limits.minX, Math.max(limits.minX, window.innerWidth - dialogRect.width - APP_THRESHOLDS.dialogEdgeMargin));
    dialogRect.y = clamp(dialogRect.y, limits.minY, Math.max(limits.minY, window.innerHeight - dialogRect.height - APP_THRESHOLDS.dialogEdgeMargin));

    dom.operatorDialog.style.left = `${dialogRect.x}px`;
    dom.operatorDialog.style.top = `${dialogRect.y}px`;
    dom.operatorDialog.style.width = `${dialogRect.width}px`;
    dom.operatorDialog.style.height = `${dialogRect.height}px`;
  }

  function syncSectionUi() {
    const sections = {
      editor: dom.settingsSectionEditor,
      inputs: dom.settingsSectionInputs,
      slideshow: dom.settingsSectionSlideshow
    };
    const tabs = {
      editor: dom.settingsTabEditor,
      inputs: dom.settingsTabInputs,
      slideshow: dom.settingsTabSlideshow
    };

    Object.entries(sections).forEach(([section, element]) => {
      element.classList.toggle("hidden", section !== activeSection);
    });

    Object.entries(tabs).forEach(([section, element]) => {
      const isActive = section === activeSection;
      element.classList.toggle("is-active", isActive);
      element.setAttribute("aria-selected", String(isActive));
    });
  }

  function renderPreview() {
    editorScreen.renderOverlayPreview();
    dom.console.classList.toggle("hidden", state.operatorPanelOpen);
    syncDialogRect();
  }

  function getOverlayDragBounds(overlayId) {
    const fallback = {
      minX: APP_THRESHOLDS.minOverlayX,
      maxX: APP_THRESHOLDS.maxOverlayX,
      minY: APP_THRESHOLDS.minOverlayY,
      maxY: APP_THRESHOLDS.maxOverlayY
    };
    const element = dom.cameraText.querySelector(`.overlay-item-body[data-overlay-id="${overlayId}"]`);
    if (!(element instanceof HTMLElement) || !state.dragSurfaceSize) {
      return fallback;
    }

    const rect = element.getBoundingClientRect();
    const halfWidthPercent = (rect.width / 2 / state.dragSurfaceSize.x) * 100;
    const halfHeightPercent = (rect.height / 2 / state.dragSurfaceSize.y) * 100;
    return {
      minX: Math.max(0, halfWidthPercent),
      maxX: Math.min(100, 100 - halfWidthPercent),
      minY: Math.max(0, halfHeightPercent),
      maxY: Math.min(100, 100 - halfHeightPercent)
    };
  }

  function syncSelectedOverlayElement() {
    const overlay = state.draggingOverlayId ? getOverlayById(state, state.draggingOverlayId) : null;
    if (!overlay) {
      return;
    }

    const element = dom.cameraText.querySelector(`[data-overlay-id="${overlay.id}"]`);
    const overlayElement = element instanceof HTMLElement ? element.closest(".overlay-item") : null;
    if (!(overlayElement instanceof HTMLElement)) {
      return;
    }

    overlayElement.style.left = `${overlay.position.x}%`;
    overlayElement.style.top = `${overlay.position.y}%`;

    if (overlay.type === "logo") {
      const scaleX = Number.isFinite(overlay.scaleX) ? overlay.scaleX : 1;
      const scaleY = Number.isFinite(overlay.scaleY) ? overlay.scaleY : 1;
      overlayElement.style.transform = `translate(-50%, -50%) rotate(${overlay.rotation}deg)`;
      const image = overlayElement.querySelector(".overlay-logo-image");
      if (image instanceof HTMLElement) {
        image.style.transform = `scale(${scaleX}, ${scaleY})`;
      }
      return;
    }

    overlayElement.style.transform = `translate(-50%, -50%) rotate(${overlay.rotation}deg)`;
    const caption = overlayElement.querySelector(".overlay-caption");
    if (caption instanceof HTMLElement) {
      caption.style.fontSize = `${overlay.size}px`;
      caption.style.color = overlay.color;
      caption.style.fontFamily = `"${overlay.font}", sans-serif`;
      caption.style.transform = `scale(${Number.isFinite(overlay.scaleX) ? overlay.scaleX : 1}, ${Number.isFinite(overlay.scaleY) ? overlay.scaleY : 1})`;
    }
  }

  function clampCountdown(value) {
    return Math.max(0, Math.min(120, Math.round(value)));
  }

  function clampSlideshowFadeDuration(value) {
    return Math.max(0, Math.min(5000, Math.round(value / 50) * 50));
  }

  function syncOffField(input, value) {
    input.value = value > 0 ? String(value) : "";
    input.placeholder = "Off";
    input.dataset.off = value <= 0 ? "true" : "false";
  }

  function resetOperatorAccessClicks() {
    operatorAccessClickCount = 0;
    if (operatorAccessClickTimer !== null) {
      window.clearTimeout(operatorAccessClickTimer);
      operatorAccessClickTimer = null;
    }
  }

  function syncCountdownFromControl() {
    const countdownValue = clampCountdown(Number(dom.countdownInput.value) || 0);
    state.countdownSeconds = countdownValue;
    syncOffField(dom.countdownInput, countdownValue);
    notifySettingsChanged();
  }

  function syncRecordingTimeoutFromControl() {
    const timeoutValue = clampCountdown(Number(dom.recordingTimeoutInput.value) || 0);
    state.recordingTimeoutSeconds = timeoutValue;
    syncOffField(dom.recordingTimeoutInput, timeoutValue);
    notifySettingsChanged();
  }

  function stepCountdown(delta) {
    dom.countdownInput.value = String(clampCountdown(state.countdownSeconds + delta));
    syncCountdownFromControl();
  }

  function stepRecordingTimeout(delta) {
    dom.recordingTimeoutInput.value = String(clampCountdown(state.recordingTimeoutSeconds + delta));
    syncRecordingTimeoutFromControl();
  }

  function syncSlideshowFadeDurationFromControl() {
    const fadeDurationValue = clampSlideshowFadeDuration(Number(dom.slideshowFadeDurationInput.value) || 0);
    state.slideshowFadeDurationMs = fadeDurationValue;
    syncOffField(dom.slideshowFadeDurationInput, fadeDurationValue);
    notifySettingsChanged();
  }

  function stepSlideshowFadeDuration(delta) {
    dom.slideshowFadeDurationInput.value = String(clampSlideshowFadeDuration(state.slideshowFadeDurationMs + (delta * 50)));
    syncSlideshowFadeDurationFromControl();
  }

  function syncOverlayControls() {
    state.captureOrientation = dom.orientationSelect.value === "portrait" ? "portrait" : "landscape";
    state.mainWindowFullscreen = dom.mainWindowFullscreenSelect.value !== "false";
    state.mainWindowMonitorId = dom.mainWindowMonitorSelect.value;
    state.slideshowFullscreen = dom.slideshowFullscreenSelect.value !== "false";
    state.slideshowMonitorId = dom.slideshowMonitorSelect.value;
    state.slideshowAudioOutputId = dom.slideshowAudioOutputSelect.value;
    state.slideshowSoundEnabled = dom.slideshowSoundEnabledSelect.value === "true";
    state.slideshowFadeDurationMs = clampSlideshowFadeDuration(Number(dom.slideshowFadeDurationInput.value) || 0);
    syncOffField(dom.slideshowFadeDurationInput, state.slideshowFadeDurationMs);
    const activeOverlay = getActiveOverlayOrSync();

    if (activeOverlay?.type === "text") {
      activeOverlay.text = dom.textInput.value.trim();
      activeOverlay.font = dom.fontSelect.value;
      state.overlayText = activeOverlay.text;
      state.overlayFont = activeOverlay.font;
      state.overlayColor = activeOverlay.color;
      state.overlaySize = activeOverlay.size;
      state.overlayTextPosition = { ...activeOverlay.position };
      state.overlayTextRotation = activeOverlay.rotation;
    } else {
      state.overlayText = dom.textInput.value.trim();
      state.overlayFont = dom.fontSelect.value;
    }

    renderPreview();
    notifySettingsChanged();
  }

  function syncMediaInputSelections() {
    state.videoInputId = dom.cameraInputSelect.value;
    state.audioInputId = dom.audioInputSelect.value || DISABLED_AUDIO_INPUT_ID;
    notifySettingsChanged();
  }

  function populateMediaDeviceOptions({ videoOptions, audioOptions, audioOutputOptions: nextAudioOutputOptions = audioOutputOptions }) {
    replaceSelectOptions(dom.cameraInputSelect, videoOptions, state.videoInputId);
    replaceSelectOptions(dom.audioInputSelect, audioOptions, state.audioInputId);
    audioOutputOptions = nextAudioOutputOptions;
    replaceSelectOptions(dom.slideshowAudioOutputSelect, audioOutputOptions, state.slideshowAudioOutputId);
    state.videoInputId = dom.cameraInputSelect.value;
    state.audioInputId = dom.audioInputSelect.value;
    state.slideshowAudioOutputId = dom.slideshowAudioOutputSelect.value;
  }

  async function loadMonitorOptions() {
    if (!isDesktopApp()) {
      return;
    }

    try {
      const monitors = await listDesktopMonitors();
      monitorOptions = [
        { value: "", label: "Current Monitor" },
        ...monitors.map((monitor, index) => ({
          value: monitor.id,
          label: `${monitor.name || `Monitor ${index + 1}`}${monitor.isPrimary ? " (Primary)" : ""}`
        }))
      ];
      replaceSelectOptions(dom.mainWindowMonitorSelect, monitorOptions, state.mainWindowMonitorId);
      replaceSelectOptions(dom.slideshowMonitorSelect, monitorOptions, state.slideshowMonitorId);
      state.mainWindowMonitorId = dom.mainWindowMonitorSelect.value;
      state.slideshowMonitorId = dom.slideshowMonitorSelect.value;
    } catch (error) {
      void logger.warn("Monitor list load failed.", {
        error: error instanceof Error ? error.message : String(error || "")
      });
    }
  }

  function syncControlsFromState() {
    syncOffField(dom.countdownInput, state.countdownSeconds);
    syncOffField(dom.recordingTimeoutInput, state.recordingTimeoutSeconds);
    const activeOverlay = getActiveOverlayOrSync();
    dom.textInput.value = activeOverlay?.type === "text" ? activeOverlay.text : "";
    dom.fontSelect.value = activeOverlay?.type === "text" ? activeOverlay.font : state.overlayFont;
    dom.orientationSelect.value = state.captureOrientation;
    dom.mainWindowFullscreenSelect.value = String(state.mainWindowFullscreen);
    replaceSelectOptions(dom.mainWindowMonitorSelect, monitorOptions, state.mainWindowMonitorId);
    dom.slideshowFullscreenSelect.value = String(state.slideshowFullscreen);
    replaceSelectOptions(dom.slideshowMonitorSelect, monitorOptions, state.slideshowMonitorId);
    replaceSelectOptions(dom.slideshowAudioOutputSelect, audioOutputOptions, state.slideshowAudioOutputId);
    dom.slideshowSoundEnabledSelect.value = String(state.slideshowSoundEnabled);
    syncOffField(dom.slideshowFadeDurationInput, clampSlideshowFadeDuration(state.slideshowFadeDurationMs));
    dom.cameraInputSelect.value = state.videoInputId;
    dom.audioInputSelect.value = state.audioInputId || DISABLED_AUDIO_INPUT_ID;
    dialogRect.width = APP_THRESHOLDS.dialogDefaultWidth;
    dialogRect.height = Math.max(APP_THRESHOLDS.dialogMinHeight, window.innerHeight - APP_THRESHOLDS.dialogEdgeMargin * 2);
    syncCountdownFromControl();
    syncRecordingTimeoutFromControl();
    syncDialogRect();
    syncSectionUi();
    renderPreview();
  }

  function setOperatorPanelOpen(isOpen) {
    state.operatorPanelOpen = isOpen;
    dom.operatorPanel.classList.toggle("hidden", !isOpen);
    dom.console.classList.toggle("hidden", isOpen);
    if (isOpen) {
      syncSectionUi();
    }
    renderPreview();
  }

  function switchSection(section) {
    if (["editor", "inputs", "slideshow"].includes(section)) {
      activeSection = section;
      syncSectionUi();
    }
  }

  function registerOperatorAccessClick() {
    operatorAccessClickCount += 1;
    if (operatorAccessClickCount >= APP_THRESHOLDS.operatorAccessClickCount) {
      resetOperatorAccessClicks();
      setOperatorPanelOpen(true);
      return;
    }

    if (operatorAccessClickTimer !== null) {
      window.clearTimeout(operatorAccessClickTimer);
    }

    operatorAccessClickTimer = window.setTimeout(resetOperatorAccessClicks, APP_THRESHOLDS.operatorAccessTimeoutMs);
  }

  function renderFrameTrayView() {
    renderFrameTray(dom.frameTray, state.activeFrameId, (frameId) => {
      state.activeFrameId = frameId;
      renderFrameTrayView();
      renderPreview();
      notifySettingsChanged();
    });
  }

  function deleteOverlay(overlayId) {
    removeOverlayById(state, overlayId);
    state.showTextColorPalette = false;
    syncControlsFromState();
    renderPreview();
    notifySettingsChanged();
  }

  function triggerLogoUpload() {
    dom.logoInput.click();
  }

  async function syncLogoUploadFromControl() {
    const [file] = dom.logoInput.files || [];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    const dataUrl = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(reader.error || new Error(APP_STRINGS.recordingFailed));
      reader.readAsDataURL(file);
    });

    const logoOverlay = createLogoOverlay({ dataUrl });
    state.overlays = [...getOverlays(state), logoOverlay];

    state.logoDataUrl = logoOverlay.dataUrl;
    state.logoScale = logoOverlay.scaleX;
    state.logoRotation = logoOverlay.rotation;
    state.logoPosition = { ...logoOverlay.position };
    setActiveOverlay(logoOverlay.id);
    notifySettingsChanged();
  }

  function handleOverlayClick(event) {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const colorSwatch = target?.closest("[data-overlay-color]");
    const activeOverlay = getActiveOverlayOrSync();

    if (colorSwatch instanceof HTMLElement && activeOverlay?.type === "text") {
      activeOverlay.color = colorSwatch.dataset.overlayColor || activeOverlay.color;
      state.overlayColor = activeOverlay.color;
      state.showTextColorPalette = false;
      renderPreview();
      notifySettingsChanged();
      return;
    }

    const actionButton = target?.closest("[data-overlay-action]");
    if (actionButton instanceof HTMLElement) {
      const overlayId = actionButton.dataset.overlayId || state.activeOverlayId;
      const overlay = overlayId ? getOverlayById(state, overlayId) : null;
      const action = actionButton.dataset.overlayAction || "";

      if (!overlay) {
        return;
      }

      if (action === "delete") {
        deleteOverlay(overlay.id);
      } else if (action === "color" && overlay.type === "text") {
        state.showTextColorPalette = !state.showTextColorPalette;
        renderPreview();
      }
      return;
    }

    const overlayBody = target?.closest(".overlay-item-body");
    const overlayId = overlayBody instanceof HTMLElement ? overlayBody.dataset.overlayId : "";
    if (overlayId) {
      setActiveOverlay(overlayId);
      return;
    }

    state.showTextColorPalette = false;
    renderPreview();
  }

  function startOverlayInteraction(event) {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!state.operatorPanelOpen || !target || target.closest("[data-overlay-action]") || target.closest("[data-overlay-color]")) {
      return;
    }

    const handle = target.closest("[data-overlay-handle]");
    const overlayElement = target.closest(".overlay-item-body");
    const overlayId = handle instanceof HTMLElement
      ? handle.dataset.overlayId
      : overlayElement instanceof HTMLElement
        ? overlayElement.dataset.overlayId
        : "";
    const overlay = overlayId ? getOverlayById(state, overlayId) : null;
    if (!overlay) {
      return;
    }

    const rect = dom.cameraStage.getBoundingClientRect();
    state.activeOverlayId = overlay.id;
    state.activeOverlayTarget = overlay.type;
    state.showTextColorPalette = false;
    state.draggingOverlayTarget = overlay.type;
    state.draggingOverlayId = overlay.id;
    state.overlayInteraction = handle instanceof HTMLElement
      ? (handle.dataset.overlayHandle === "rotate" ? "rotate" : "resize")
      : "move";
    state.dragPointerId = event.pointerId;
    state.dragStartPointer = { x: event.clientX, y: event.clientY };
    state.dragSurfaceSize = { x: rect.width, y: rect.height };
    state.dragStartPosition = { ...overlay.position };
    state.dragStartRotation = overlay.rotation;
    state.dragStartOverlayScale = {
      x: Number.isFinite(overlay.scaleX) ? overlay.scaleX : 1,
      y: Number.isFinite(overlay.scaleY) ? overlay.scaleY : 1
    };
    state.dragStartPointerAngle = null;
    state.dragRotationCenter = null;
    const bodyElement = overlayElement instanceof HTMLElement
      ? overlayElement
      : handle?.closest(".overlay-item")?.querySelector(".overlay-item-body");
    if (bodyElement instanceof HTMLElement) {
      const bodyRect = bodyElement.getBoundingClientRect();
      state.dragStartOverlayRect = {
        left: ((bodyRect.left - rect.left) / rect.width) * 100,
        top: ((bodyRect.top - rect.top) / rect.height) * 100,
        width: (bodyRect.width / rect.width) * 100,
        height: (bodyRect.height / rect.height) * 100
      };
    } else {
      state.dragStartOverlayRect = null;
    }
    if (state.overlayInteraction === "rotate") {
      const selectedOverlayElement = handle?.closest(".overlay-item") ?? overlayElement?.closest(".overlay-item");
      if (selectedOverlayElement instanceof HTMLElement) {
        const overlayRect = selectedOverlayElement.getBoundingClientRect();
        const centerX = overlayRect.left + (overlayRect.width / 2);
        const centerY = overlayRect.top + (overlayRect.height / 2);
        state.dragRotationCenter = { x: centerX, y: centerY };
        state.dragStartPointerAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX) * (180 / Math.PI);
      }
    }
    event.preventDefault();
    renderPreview();
    dom.cameraText.querySelector(`[data-overlay-id="${overlay.id}"]`)?.setPointerCapture?.(event.pointerId);
  }

  function updateOverlayFromPointer(event) {
    const overlay = state.draggingOverlayId ? getOverlayById(state, state.draggingOverlayId) : null;
    if (!overlay || !state.dragStartPointer || !state.dragStartPosition || !state.overlayInteraction || state.dragPointerId !== event.pointerId || !state.dragSurfaceSize) {
      return;
    }

    const dxPercent = ((event.clientX - state.dragStartPointer.x) / state.dragSurfaceSize.x) * 100;
    const dyPercent = ((event.clientY - state.dragStartPointer.y) / state.dragSurfaceSize.y) * 100;

    if (state.overlayInteraction === "move") {
      const bounds = getOverlayDragBounds(overlay.id);
      overlay.position = {
        x: clamp(state.dragStartPosition.x + dxPercent, bounds.minX, bounds.maxX),
        y: clamp(state.dragStartPosition.y + dyPercent, bounds.minY, bounds.maxY)
      };
    } else if (state.overlayInteraction === "rotate") {
      const rotationCenter = state.dragRotationCenter;
      if (rotationCenter && Number.isFinite(state.dragStartPointerAngle)) {
        const currentAngle = Math.atan2(event.clientY - rotationCenter.y, event.clientX - rotationCenter.x) * (180 / Math.PI);
        overlay.rotation = Math.round((state.dragStartRotation + currentAngle - state.dragStartPointerAngle) * 10) / 10;
      }
    } else {
      const nextScaleX = Math.max(APP_THRESHOLDS.minLogoScale, state.dragStartOverlayScale.x + (dxPercent / 10));
      const nextScaleY = Math.max(APP_THRESHOLDS.minLogoScale, state.dragStartOverlayScale.y + (dyPercent / 10));
      overlay.scaleX = nextScaleX;
      overlay.scaleY = nextScaleY;
      if (state.dragStartOverlayRect) {
        const nextWidth = state.dragStartOverlayRect.width * (nextScaleX / Math.max(state.dragStartOverlayScale.x, 0.001));
        const nextHeight = state.dragStartOverlayRect.height * (nextScaleY / Math.max(state.dragStartOverlayScale.y, 0.001));
        overlay.position = {
          x: clamp(state.dragStartOverlayRect.left + (nextWidth / 2), nextWidth / 2, 100 - (nextWidth / 2)),
          y: clamp(state.dragStartOverlayRect.top + (nextHeight / 2), nextHeight / 2, 100 - (nextHeight / 2))
        };
      }
    }

    syncSelectedOverlayElement();
    event.preventDefault();
  }

  function stopOverlayInteraction(event) {
    if (!state.draggingOverlayId && !state.overlayInteraction) {
      return;
    }

    if (event && state.dragPointerId === event.pointerId) {
      dom.cameraText.querySelector(`[data-overlay-id="${state.draggingOverlayId}"]`)?.releasePointerCapture?.(event.pointerId);
    }

    state.draggingOverlayTarget = null;
    state.draggingOverlayId = null;
    state.overlayInteraction = null;
    state.dragPointerId = null;
    state.dragStartPointer = null;
    state.dragSurfaceSize = null;
    state.dragStartPosition = null;
    state.dragStartOverlayRect = null;
    state.dragStartRotation = 0;
    state.dragStartPointerAngle = null;
    state.dragRotationCenter = null;
    state.dragStartOverlayScale = { x: 1, y: 1 };
    syncControlsFromState();
    renderPreview();
    notifySettingsChanged();
  }

  function startDialogInteraction(event) {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) {
      return;
    }

    if (target.closest("button") && !target.closest("#operatorDialogResize")) {
      return;
    }

    if (target.closest("#operatorDialogHeader")) {
      dialogInteraction = "move";
    } else if (target.closest("#operatorDialogResize")) {
      dialogInteraction = "resize";
    } else {
      return;
    }

    dialogPointerId = event.pointerId;
    dialogStartPointer = { x: event.clientX, y: event.clientY };
    dialogStartRect = { ...dialogRect };
    event.preventDefault();
    dom.operatorDialog.setPointerCapture?.(event.pointerId);
  }

  function updateDialogInteraction(event) {
    if (!dialogInteraction || dialogPointerId !== event.pointerId || !dialogStartPointer || !dialogStartRect) {
      return;
    }

    const dx = event.clientX - dialogStartPointer.x;
    const dy = event.clientY - dialogStartPointer.y;

    if (dialogInteraction === "move") {
      dialogRect.x = dialogStartRect.x + dx;
      dialogRect.y = dialogStartRect.y + dy;
    } else {
      dialogRect.width = dialogStartRect.width + dx;
      dialogRect.height = dialogStartRect.height + dy;
    }

    syncDialogRect();
  }

  function stopDialogInteraction(event) {
    if (!dialogInteraction) {
      return;
    }

    if (event && dialogPointerId === event.pointerId) {
      dom.operatorDialog.releasePointerCapture?.(event.pointerId);
    }

    dialogInteraction = null;
    dialogPointerId = null;
    dialogStartPointer = null;
    dialogStartRect = null;
  }

  function handleWindowResize() {
    syncDialogRect();
  }

  return {
    syncControlsFromState,
    syncOverlayControls,
    syncCountdownFromControl,
    syncRecordingTimeoutFromControl,
    syncMediaInputSelections,
    populateMediaDeviceOptions,
    loadMonitorOptions,
    stepCountdown,
    stepRecordingTimeout,
    syncSlideshowFadeDurationFromControl,
    stepSlideshowFadeDuration,
    setOperatorPanelOpen,
    switchSection,
    registerOperatorAccessClick,
    renderFrameTray: renderFrameTrayView,
    addTextOverlay: createInitialTextOverlay,
    triggerLogoUpload,
    syncLogoUploadFromControl,
    handleOverlayClick,
    startOverlayInteraction,
    updateOverlayFromPointer,
    stopOverlayInteraction,
    startDialogInteraction,
    updateDialogInteraction,
    stopDialogInteraction,
    handleWindowResize
  };
}
