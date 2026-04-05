import { APP_THRESHOLDS, DISABLED_AUDIO_INPUT_ID } from "../constants/appConfig.js";
import renderFrameTray from "../components/frameTray.js";
import { renderInstructionPage } from "../components/instructionRenderer.js";
import { isDesktopApp, listDesktopMonitors } from "../services/desktopService.js";
import { logger } from "../services/logger.js";
import { createInstructionElement, createInstructionPage } from "../utils/instructionState.js";
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

function clampInstructionAutoAdvance(value) {
  return Math.max(1, Math.min(30, Math.round(Number(value) || 4)));
}

function clampInstructionTransition(value) {
  return Math.max(0, Math.round(Number(value) || 0));
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
  let activeInstructionPageId = "";
  let activeInstructionElementId = "";
  let pendingInstructionImageTarget = null;
  let showInstructionColorPalette = false;
  let instructionDragPointerId = null;
  let instructionDragStartPointer = null;
  let instructionDragStartPosition = null;
  let instructionInteraction = null;
  let instructionDragSurfaceSize = null;
  let instructionDragStartScale = { x: 1, y: 1 };
  let instructionDragStartRect = null;
  let instructionDragStartRotation = 0;
  let instructionDragRotationCenter = null;
  let instructionDragStartPointerAngle = null;

  function syncCameraToggleButton() {
    const isOn = state.settingsCameraEnabled === true;
    const icon = dom.editorCameraToggleButton.querySelector(".material-symbols-outlined");
    if (icon) {
      icon.textContent = isOn ? "videocam_off" : "videocam";
    }
    dom.editorCameraToggleLabel.textContent = isOn ? "Turn Off Camera" : "Turn On Camera";
    dom.editorCameraToggleButton.setAttribute("aria-pressed", String(isOn));
  }

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
      instructions: dom.settingsSectionInstructions,
      inputs: dom.settingsSectionInputs,
      slideshow: dom.settingsSectionSlideshow
    };
    const tabs = {
      editor: dom.settingsTabEditor,
      instructions: dom.settingsTabInstructions,
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

  function getInstructionPages() {
    return Array.isArray(state.instructionPages) ? state.instructionPages : [];
  }

  function getActiveInstructionPage() {
    const pages = getInstructionPages();
    if (!pages.length) {
      activeInstructionPageId = "";
      return null;
    }

    const existingPage = pages.find((page) => page.id === activeInstructionPageId);
    if (existingPage) {
      return existingPage;
    }

    activeInstructionPageId = pages[0].id;
    return pages[0];
  }

  function getActiveInstructionElement() {
    const page = getActiveInstructionPage();
    if (!page?.elements?.length) {
      activeInstructionElementId = "";
      return null;
    }

    const existingElement = page.elements.find((element) => element.id === activeInstructionElementId);
    if (existingElement) {
      return existingElement;
    }

    activeInstructionElementId = page.elements[0].id;
    return page.elements[0];
  }

  function setActiveInstructionPage(pageId) {
    activeInstructionPageId = pageId;
    activeInstructionElementId = "";
    showInstructionColorPalette = false;
    renderInstructionPageEditor();
  }

  function renderInstructionPreview() {
    renderInstructionPage(dom.instructionPagePreview, getActiveInstructionPage(), {
      interactive: true,
      selectedId: activeInstructionElementId,
      showColorPalette: showInstructionColorPalette
    });
  }

  function syncInstructionControlsFromState() {
    const page = getActiveInstructionPage();
    const pages = getInstructionPages();
    const activeElement = getActiveInstructionElement();

    dom.instructionPageRemoveButton.disabled = !page;
    dom.instructionPagePrevButton.disabled = pages.length <= 1;
    dom.instructionPageNextButton.disabled = pages.length <= 1;
    dom.instructionPageNameInput.disabled = !page;
    dom.instructionPagePhaseSelect.disabled = !page;
    dom.instructionPageNavigationSelect.disabled = !page;
    dom.instructionPageAutoAdvanceInput.disabled = !page;
    dom.instructionAutoAdvanceMinusButton.disabled = !page;
    dom.instructionAutoAdvancePlusButton.disabled = !page;
    dom.instructionTransitionInput.disabled = false;
    dom.instructionTransitionMinusButton.disabled = false;
    dom.instructionTransitionPlusButton.disabled = false;
    dom.instructionAddTextElementButton.disabled = !page;
    dom.instructionAddMediaElementButton.disabled = !page;
    dom.instructionTextInput.disabled = !activeElement || activeElement.type !== "text";
    dom.instructionFontSelect.disabled = !activeElement || activeElement.type !== "text";

    if (!page) {
      dom.instructionPageCounter.textContent = "No pages yet";
      dom.instructionPageNameInput.value = "";
      dom.instructionPagePhaseSelect.value = "before";
      dom.instructionPageNavigationSelect.value = "tap";
      dom.instructionPageAutoAdvanceInput.value = "4";
      dom.instructionTransitionInput.value = String(clampInstructionTransition(state.instructionTransitionMs));
      dom.instructionTextInput.value = "";
      dom.instructionFontSelect.value = "Space Grotesk";
      dom.instructionPageAutoAdvanceRow.classList.add("hidden");
      renderInstructionPage(dom.instructionPagePreview, null);
      return;
    }

    const currentIndex = pages.findIndex((entry) => entry.id === page.id);
    dom.instructionPageCounter.textContent = `Page ${currentIndex + 1} of ${pages.length}`;
    if (document.activeElement !== dom.instructionPageNameInput) {
      dom.instructionPageNameInput.value = page.name;
    }
    if (document.activeElement !== dom.instructionPagePhaseSelect) {
      dom.instructionPagePhaseSelect.value = page.phase;
    }
    if (document.activeElement !== dom.instructionPageNavigationSelect) {
      dom.instructionPageNavigationSelect.value = page.navigation;
    }
    if (document.activeElement !== dom.instructionPageAutoAdvanceInput) {
      dom.instructionPageAutoAdvanceInput.value = String(clampInstructionAutoAdvance(page.autoAdvanceSeconds));
    }
    if (document.activeElement !== dom.instructionTransitionInput) {
      dom.instructionTransitionInput.value = String(clampInstructionTransition(state.instructionTransitionMs));
    }
    dom.instructionPageAutoAdvanceRow.classList.toggle("hidden", page.navigation !== "auto");

    if (activeElement?.type === "text") {
      if (document.activeElement !== dom.instructionTextInput) {
        dom.instructionTextInput.value = activeElement.content || "";
      }
      if (document.activeElement !== dom.instructionFontSelect) {
        dom.instructionFontSelect.value = activeElement.font || "Space Grotesk";
      }
    } else {
      dom.instructionTextInput.value = "";
      dom.instructionFontSelect.value = "Space Grotesk";
    }

    renderInstructionPreview();
  }

  function renderInstructionPageEditor() {
    syncInstructionControlsFromState();
  }

  function getInstructionDragBounds(elementId) {
    const fallback = { minX: 6, maxX: 94, minY: 6, maxY: 94 };
    const element = dom.instructionPagePreview.querySelector(`.overlay-item-body[data-instruction-id="${elementId}"]`);
    if (!(element instanceof HTMLElement) || !instructionDragSurfaceSize) {
      return fallback;
    }

    const rect = element.getBoundingClientRect();
    const halfWidthPercent = (rect.width / 2 / instructionDragSurfaceSize.x) * 100;
    const halfHeightPercent = (rect.height / 2 / instructionDragSurfaceSize.y) * 100;
    return {
      minX: Math.max(0, halfWidthPercent),
      maxX: Math.min(100, 100 - halfWidthPercent),
      minY: Math.max(0, halfHeightPercent),
      maxY: Math.min(100, 100 - halfHeightPercent)
    };
  }

  function syncSelectedInstructionElement() {
    const element = getActiveInstructionElement();
    if (!element) {
      return;
    }

    const elementNode = dom.instructionPagePreview.querySelector(`[data-instruction-id="${element.id}"]`);
    const overlayElement = elementNode instanceof HTMLElement ? elementNode.closest(".overlay-item") : null;
    if (!(overlayElement instanceof HTMLElement)) {
      return;
    }

    overlayElement.style.left = `${element.position.x}%`;
    overlayElement.style.top = `${element.position.y}%`;
    overlayElement.style.transform = "translate(-50%, -50%)";
    const overlayShell = overlayElement.querySelector(".overlay-item-shell");
    if (overlayShell instanceof HTMLElement) {
      overlayShell.style.transform = `rotate(${element.rotation}deg)`;
    }

    if (element.type === "image") {
      const image = overlayElement.querySelector(".overlay-logo-image");
      if (image instanceof HTMLElement) {
        image.style.transform = `scale(${element.scaleX}, ${element.scaleY})`;
      }
      return;
    }

    const caption = overlayElement.querySelector(".overlay-caption");
    if (caption instanceof HTMLElement) {
      caption.style.color = element.color;
      caption.style.fontFamily = `"${element.font}", sans-serif`;
      caption.style.transform = `scale(${element.scaleX}, ${element.scaleY})`;
    }
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
    const overlayShell = overlayElement.querySelector(".overlay-item-shell");

    if (overlay.type === "logo") {
      const scaleX = Number.isFinite(overlay.scaleX) ? overlay.scaleX : 1;
      const scaleY = Number.isFinite(overlay.scaleY) ? overlay.scaleY : 1;
      overlayElement.style.transform = "translate(-50%, -50%)";
      if (overlayShell instanceof HTMLElement) {
        overlayShell.style.transform = `rotate(${overlay.rotation}deg)`;
      }
      const image = overlayElement.querySelector(".overlay-logo-image");
      if (image instanceof HTMLElement) {
        image.style.transform = `scale(${scaleX}, ${scaleY})`;
      }
      return;
    }

    overlayElement.style.transform = "translate(-50%, -50%)";
    if (overlayShell instanceof HTMLElement) {
      overlayShell.style.transform = `rotate(${overlay.rotation}deg)`;
    }
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
    syncCameraToggleButton();
    syncDialogRect();
    syncSectionUi();
    renderInstructionPageEditor();
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
    if (["editor", "instructions", "inputs", "slideshow"].includes(section)) {
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

  function syncInstructionSettings(options = {}) {
    renderInstructionPageEditor();
    notifySettingsChanged();
  }

  function addInstructionPage() {
    const nextPage = createInstructionPage({
      name: `Page ${getInstructionPages().length + 1}`,
      elements: [createInstructionElement({ type: "text", content: "Add your message here", size: "large" })]
    });
    state.instructionPages = [...getInstructionPages(), nextPage];
    activeInstructionPageId = nextPage.id;
    activeInstructionElementId = nextPage.elements[0]?.id || "";
    syncInstructionSettings();
  }

  function removeInstructionPage() {
    const page = getActiveInstructionPage();
    if (!page) {
      return;
    }

    const pages = getInstructionPages();
    const nextPages = pages.filter((entry) => entry.id !== page.id);
    state.instructionPages = nextPages;
    activeInstructionPageId = nextPages[Math.max(0, pages.findIndex((entry) => entry.id === page.id) - 1)]?.id || "";
    activeInstructionElementId = "";
    syncInstructionSettings();
  }

  function stepInstructionPage(delta) {
    const pages = getInstructionPages();
    const page = getActiveInstructionPage();
    if (!page || pages.length <= 1) {
      return;
    }

    const currentIndex = pages.findIndex((entry) => entry.id === page.id);
    const nextIndex = (currentIndex + delta + pages.length) % pages.length;
    setActiveInstructionPage(pages[nextIndex].id);
  }

  function syncInstructionPageFields(options = {}) {
    const page = getActiveInstructionPage();
    if (!page) {
      return;
    }

    const rawName = dom.instructionPageNameInput.value;
    page.name = options.finalize ? (rawName.trim() || "Instruction Page") : rawName;
    page.phase = dom.instructionPagePhaseSelect.value === "after" ? "after" : "before";
    page.navigation = ["tap", "auto"].includes(dom.instructionPageNavigationSelect.value)
      ? dom.instructionPageNavigationSelect.value
      : "tap";
    page.autoAdvanceSeconds = clampInstructionAutoAdvance(dom.instructionPageAutoAdvanceInput.value);
    syncInstructionSettings(options);
  }

  function stepInstructionAutoAdvance(delta) {
    dom.instructionPageAutoAdvanceInput.value = String(clampInstructionAutoAdvance((Number(dom.instructionPageAutoAdvanceInput.value) || 4) + delta));
    syncInstructionPageFields();
  }

  function syncInstructionTransitionFromControl() {
    state.instructionTransitionMs = clampInstructionTransition(dom.instructionTransitionInput.value);
    dom.instructionTransitionInput.value = String(state.instructionTransitionMs);
    notifySettingsChanged();
  }

  function stepInstructionTransition(delta) {
    dom.instructionTransitionInput.value = String(clampInstructionTransition((Number(dom.instructionTransitionInput.value) || 0) + (delta * 100)));
    syncInstructionTransitionFromControl();
  }

  function addInstructionTextElement() {
    const page = getActiveInstructionPage();
    if (!page) {
      addInstructionPage();
      return;
    }

    const nextElement = createInstructionElement({
      type: "text",
      content: "Instruction text",
      font: dom.instructionFontSelect.value || "Space Grotesk",
      size: "medium"
    });
    page.elements = [...page.elements, nextElement];
    activeInstructionElementId = nextElement.id;
    showInstructionColorPalette = false;
    syncInstructionSettings();
  }

  function triggerInstructionMediaUpload(target = { mode: "new" }) {
    pendingInstructionImageTarget = target;
    dom.instructionElementImageInput.value = "";
    dom.instructionElementImageInput.click();
  }

  async function syncInstructionMediaUploadFromControl() {
    const [file] = dom.instructionElementImageInput.files || [];
    const page = getActiveInstructionPage();
    if (!file || !page) {
      pendingInstructionImageTarget = null;
      return;
    }

    const reader = new FileReader();
    const dataUrl = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(reader.error || new Error("Instruction media upload failed."));
      reader.readAsDataURL(file);
    });

    if (!dataUrl) {
      pendingInstructionImageTarget = null;
      return;
    }

    if (pendingInstructionImageTarget?.mode === "replace" && Number.isInteger(pendingInstructionImageTarget.index) && page.elements[pendingInstructionImageTarget.index]) {
      const targetElement = page.elements[pendingInstructionImageTarget.index];
      targetElement.type = "image";
      targetElement.dataUrl = dataUrl;
      targetElement.content = file.name;
      targetElement.size = targetElement.size || "large";
      activeInstructionElementId = targetElement.id;
    } else {
      const nextElement = createInstructionElement({
        type: "image",
        dataUrl,
        content: file.name,
        size: "large"
      });
      page.elements = [...page.elements, nextElement];
      activeInstructionElementId = nextElement.id;
    }

    pendingInstructionImageTarget = null;
    showInstructionColorPalette = false;
    syncInstructionSettings();
  }

  function syncInstructionElementFields() {
    const element = getActiveInstructionElement();
    if (!element) {
      return;
    }

    if (element.type === "text") {
      element.content = dom.instructionTextInput.value;
      element.font = dom.instructionFontSelect.value || "Space Grotesk";
    }

    renderInstructionPreview();
    notifySettingsChanged();
  }

  function removeInstructionElement(elementId) {
    const page = getActiveInstructionPage();
    if (!page?.elements?.length) {
      return;
    }

    const nextElements = page.elements.filter((element) => element.id !== elementId);
    page.elements = nextElements;
    activeInstructionElementId = nextElements[nextElements.length - 1]?.id || "";
    showInstructionColorPalette = false;
    syncInstructionSettings();
  }

  function handleInstructionPreviewClick(event) {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) {
      return;
    }

    const colorSwatch = target.closest("[data-instruction-color]");
    if (colorSwatch instanceof HTMLElement) {
      const element = getActiveInstructionElement();
      if (element?.type === "text") {
        element.color = colorSwatch.dataset.instructionColor || element.color;
        showInstructionColorPalette = false;
        syncInstructionSettings();
      }
      return;
    }

    const actionButton = target.closest("[data-instruction-action]");
    if (actionButton instanceof HTMLElement) {
      const elementId = actionButton.dataset.instructionId || activeInstructionElementId;
      const element = getActiveInstructionPage()?.elements.find((entry) => entry.id === elementId) || null;
      if (!element) {
        return;
      }

      if (actionButton.dataset.instructionAction === "delete") {
        removeInstructionElement(element.id);
      } else if (actionButton.dataset.instructionAction === "color" && element.type === "text") {
        activeInstructionElementId = element.id;
        showInstructionColorPalette = !showInstructionColorPalette;
        syncInstructionSettings();
      }
      return;
    }

    const overlayBody = target.closest(".overlay-item-body");
    const elementId = overlayBody instanceof HTMLElement ? overlayBody.dataset.instructionId : "";
    if (elementId) {
      activeInstructionElementId = elementId;
      showInstructionColorPalette = false;
      renderInstructionPageEditor();
      return;
    }

    showInstructionColorPalette = false;
    renderInstructionPageEditor();
  }

  function startInstructionPreviewDrag(event) {
    const page = getActiveInstructionPage();
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!page || !target) {
      return;
    }

    const colorSwatch = target.closest("[data-instruction-color]");
    const actionButton = target.closest("[data-instruction-action]");
    if (colorSwatch || actionButton) {
      return;
    }

    const handle = target.closest("[data-instruction-handle]");
    const overlayBody = target.closest(".overlay-item-body");
    const elementId = handle instanceof HTMLElement
      ? handle.dataset.instructionId
      : overlayBody instanceof HTMLElement
        ? overlayBody.dataset.instructionId
        : "";
    const element = page.elements.find((entry) => entry.id === elementId);
    if (!element) {
      return;
    }

    activeInstructionElementId = element.id;
    showInstructionColorPalette = false;
    instructionDragPointerId = event.pointerId;
    instructionDragStartPointer = { x: event.clientX, y: event.clientY };
    instructionDragStartPosition = { ...element.position };
    instructionInteraction = handle instanceof HTMLElement
      ? (handle.dataset.instructionHandle === "rotate" ? "rotate" : "resize")
      : "move";
    const previewRect = dom.instructionPagePreview.getBoundingClientRect();
    instructionDragSurfaceSize = { x: previewRect.width, y: previewRect.height };
    instructionDragStartScale = { x: element.scaleX, y: element.scaleY };
    instructionDragStartRotation = element.rotation;
    instructionDragRotationCenter = null;
    instructionDragStartPointerAngle = null;
    const bodyElement = overlayBody instanceof HTMLElement
      ? overlayBody
      : handle?.closest(".overlay-item")?.querySelector(".overlay-item-body");
    if (bodyElement instanceof HTMLElement) {
      const bodyRect = bodyElement.getBoundingClientRect();
      instructionDragStartRect = {
        left: ((bodyRect.left - previewRect.left) / previewRect.width) * 100,
        top: ((bodyRect.top - previewRect.top) / previewRect.height) * 100,
        width: (bodyRect.width / previewRect.width) * 100,
        height: (bodyRect.height / previewRect.height) * 100
      };
    } else {
      instructionDragStartRect = null;
    }
    if (instructionInteraction === "rotate") {
      const selectedElement = handle?.closest(".overlay-item") ?? overlayBody?.closest(".overlay-item");
      if (selectedElement instanceof HTMLElement) {
        const overlayRect = selectedElement.getBoundingClientRect();
        const centerX = overlayRect.left + (overlayRect.width / 2);
        const centerY = overlayRect.top + (overlayRect.height / 2);
        instructionDragRotationCenter = { x: centerX, y: centerY };
        instructionDragStartPointerAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX) * (180 / Math.PI);
      }
    }
    (overlayBody || handle || target).setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  function updateInstructionPreviewDrag(event) {
    if (
      instructionDragPointerId !== event.pointerId
      || !instructionDragStartPointer
      || !instructionDragStartPosition
      || !instructionInteraction
      || !instructionDragSurfaceSize
    ) {
      return;
    }

    const page = getActiveInstructionPage();
    const element = getActiveInstructionElement();
    if (!page || !element) {
      return;
    }

    const dxPercent = ((event.clientX - instructionDragStartPointer.x) / instructionDragSurfaceSize.x) * 100;
    const dyPercent = ((event.clientY - instructionDragStartPointer.y) / instructionDragSurfaceSize.y) * 100;

    if (instructionInteraction === "move") {
      const bounds = getInstructionDragBounds(element.id);
      element.position = {
        x: clamp(instructionDragStartPosition.x + dxPercent, bounds.minX, bounds.maxX),
        y: clamp(instructionDragStartPosition.y + dyPercent, bounds.minY, bounds.maxY)
      };
    } else if (instructionInteraction === "rotate") {
      const rotationCenter = instructionDragRotationCenter;
      if (rotationCenter && Number.isFinite(instructionDragStartPointerAngle)) {
        const currentAngle = Math.atan2(event.clientY - rotationCenter.y, event.clientX - rotationCenter.x) * (180 / Math.PI);
        element.rotation = Math.round((instructionDragStartRotation + currentAngle - instructionDragStartPointerAngle) * 10) / 10;
      }
    } else {
      const nextScaleX = Math.max(APP_THRESHOLDS.minLogoScale, instructionDragStartScale.x + (dxPercent / 10));
      const nextScaleY = Math.max(APP_THRESHOLDS.minLogoScale, instructionDragStartScale.y + (dyPercent / 10));
      element.scaleX = nextScaleX;
      element.scaleY = nextScaleY;
      if (instructionDragStartRect) {
        const nextWidth = instructionDragStartRect.width * (nextScaleX / Math.max(instructionDragStartScale.x, 0.001));
        const nextHeight = instructionDragStartRect.height * (nextScaleY / Math.max(instructionDragStartScale.y, 0.001));
        element.position = {
          x: clamp(instructionDragStartRect.left + (nextWidth / 2), nextWidth / 2, 100 - (nextWidth / 2)),
          y: clamp(instructionDragStartRect.top + (nextHeight / 2), nextHeight / 2, 100 - (nextHeight / 2))
        };
      }
    }
    syncSelectedInstructionElement();
    event.preventDefault();
  }

  function stopInstructionPreviewDrag(event) {
    if (instructionDragPointerId === null) {
      return;
    }

    if (!event || event.pointerId === instructionDragPointerId) {
      instructionDragPointerId = null;
      instructionDragStartPointer = null;
      instructionDragStartPosition = null;
      instructionInteraction = null;
      instructionDragSurfaceSize = null;
      instructionDragStartScale = { x: 1, y: 1 };
      instructionDragStartRect = null;
      instructionDragStartRotation = 0;
      instructionDragRotationCenter = null;
      instructionDragStartPointerAngle = null;
      renderInstructionPageEditor();
      notifySettingsChanged();
    }
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
    addInstructionPage,
    removeInstructionPage,
    stepInstructionPage,
    syncInstructionPageFields,
    syncInstructionElementFields,
    stepInstructionAutoAdvance,
    syncInstructionTransitionFromControl,
    stepInstructionTransition,
    addInstructionTextElement,
    triggerInstructionMediaUpload,
    syncInstructionMediaUploadFromControl,
    handleInstructionPreviewClick,
    startInstructionPreviewDrag,
    updateInstructionPreviewDrag,
    stopInstructionPreviewDrag,
    handleOverlayClick,
    startOverlayInteraction,
    updateOverlayFromPointer,
    stopOverlayInteraction,
    startDialogInteraction,
    updateDialogInteraction,
    stopDialogInteraction,
    handleWindowResize,
    syncCameraToggleButton,
    setCameraToggleActive(isActive) {
      state.settingsCameraEnabled = isActive;
      syncCameraToggleButton();
    },
    getActiveSection() {
      return activeSection;
    }
  };
}
