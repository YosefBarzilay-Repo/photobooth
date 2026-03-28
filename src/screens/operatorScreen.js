import { APP_STRINGS, APP_THRESHOLDS } from "../constants/appConfig.js";
import renderFrameTray from "../components/frameTray.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getOverlayPosition(target, state) {
  return target === "logo" ? state.logoPosition : state.overlayTextPosition;
}

function setOverlayPosition(target, state, position) {
  if (target === "logo") {
    state.logoPosition = position;
    return;
  }
  state.overlayTextPosition = position;
}

function getOverlayInteractionElement(dom, target) {
  return dom.cameraText.querySelector(`.overlay-item-${target}`);
}

function getViewportLimits() {
  return {
    minX: APP_THRESHOLDS.dialogEdgeMargin,
    minY: APP_THRESHOLDS.dialogEdgeMargin,
    maxX: Math.max(APP_THRESHOLDS.dialogEdgeMargin, window.innerWidth - APP_THRESHOLDS.dialogEdgeMargin),
    maxY: Math.max(APP_THRESHOLDS.dialogEdgeMargin, window.innerHeight - APP_THRESHOLDS.dialogEdgeMargin)
  };
}

export default function createOperatorScreen(dom, state, editorScreen) {
  let operatorAccessClickCount = 0;
  let operatorAccessClickTimer = null;
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

  function renderPreview() {
    editorScreen.renderOverlayPreview();
    dom.saveFolderLabel.textContent = state.saveDirectoryName;
    dom.console.classList.toggle("hidden", state.operatorPanelOpen);
    syncDialogRect();
  }

  function syncSelectedOverlayElement() {
    if (!state.draggingOverlayTarget) {
      return;
    }

    const element = getOverlayInteractionElement(dom, state.draggingOverlayTarget);
    if (!(element instanceof HTMLElement)) {
      return;
    }

    const position = getOverlayPosition(state.draggingOverlayTarget, state);
    element.style.left = `${position.x}%`;
    element.style.top = `${position.y}%`;

    if (state.draggingOverlayTarget === "logo") {
      element.style.transform = `translate(-50%, -50%) rotate(${state.logoRotation}deg) scale(${state.logoScale})`;
      return;
    }

    element.style.transform = `translate(-50%, -50%) rotate(${state.overlayTextRotation}deg)`;
    const caption = element.querySelector(".overlay-caption");
    if (caption instanceof HTMLElement) {
      caption.style.fontSize = `${state.overlaySize}px`;
      caption.style.color = state.overlayColor;
      caption.style.fontFamily = `"${state.overlayFont}", sans-serif`;
    }
  }

  function clampCountdown(value) {
    return Math.max(0, Math.min(120, Math.round(value)));
  }

  function clampSlideshowIdle(value) {
    return clamp(Math.round(value), APP_THRESHOLDS.minSlideshowIdleSeconds, APP_THRESHOLDS.maxSlideshowIdleSeconds);
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
    dom.countdownInput.value = String(countdownValue);
    state.countdownSeconds = countdownValue;
  }

  function syncSlideshowIdleFromControl() {
    const idleValue = clampSlideshowIdle(Number(dom.slideshowIdleInput.value) || 0);
    dom.slideshowIdleInput.value = String(idleValue);
    state.slideshowIdleSeconds = idleValue;
  }

  function stepCountdown(delta) {
    dom.countdownInput.value = String(clampCountdown((Number(dom.countdownInput.value) || 0) + delta));
    syncCountdownFromControl();
  }

  function stepSlideshowIdle(delta) {
    dom.slideshowIdleInput.value = String(clampSlideshowIdle((Number(dom.slideshowIdleInput.value) || 0) + delta));
    syncSlideshowIdleFromControl();
  }

  function syncOverlayControls() {
    state.overlayText = dom.textInput.value.trim();
    state.overlayFont = dom.fontSelect.value;

    if (state.overlayText && !state.activeOverlayTarget) {
      state.activeOverlayTarget = "text";
    }

    if (!state.overlayText && state.activeOverlayTarget === "text") {
      state.activeOverlayTarget = state.logoDataUrl ? "logo" : null;
    }

    renderPreview();
  }

  function syncControlsFromState() {
    dom.countdownInput.value = String(state.countdownSeconds);
    dom.slideshowIdleInput.value = String(state.slideshowIdleSeconds);
    dom.textInput.value = state.overlayText;
    dom.fontSelect.value = state.overlayFont;
    dialogRect.width = APP_THRESHOLDS.dialogDefaultWidth;
    dialogRect.height = Math.max(APP_THRESHOLDS.dialogMinHeight, window.innerHeight - APP_THRESHOLDS.dialogEdgeMargin * 2);
    syncCountdownFromControl();
    syncSlideshowIdleFromControl();
    syncDialogRect();
    renderPreview();
  }

  function setOperatorPanelOpen(isOpen) {
    state.operatorPanelOpen = isOpen;
    dom.operatorPanel.classList.toggle("hidden", !isOpen);
    dom.console.classList.toggle("hidden", isOpen);
    renderPreview();
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
    });
  }

  function setActiveOverlayTarget(target) {
    if (target === "logo" && !state.logoDataUrl) {
      return;
    }

    if (target === "text" && !state.overlayText) {
      return;
    }

    state.activeOverlayTarget = target;
    state.showTextColorPalette = false;
    renderPreview();
  }

  function rotateOverlay(target, direction) {
    if (target === "logo") {
      state.logoRotation += direction * APP_THRESHOLDS.overlayRotationStep;
    } else if (target === "text") {
      state.overlayTextRotation += direction * APP_THRESHOLDS.overlayRotationStep;
    }
    renderPreview();
  }

  function deleteOverlay(target) {
    if (target === "logo") {
      state.logoDataUrl = "";
      dom.logoInput.value = "";
      state.activeOverlayTarget = state.overlayText ? "text" : null;
    }

    if (target === "text") {
      state.overlayText = "";
      dom.textInput.value = "";
      state.activeOverlayTarget = state.logoDataUrl ? "logo" : null;
      state.showTextColorPalette = false;
    }

    renderPreview();
  }

  function triggerLogoUpload() {
    dom.logoInput.click();
  }

  async function pickSaveFolder() {
    if (!("showDirectoryPicker" in window)) {
      state.saveDirectoryHandle = null;
      state.saveDirectoryName = APP_STRINGS.folderUnsupported;
      renderPreview();
      return;
    }

    try {
      const directoryHandle = await window.showDirectoryPicker();
      state.saveDirectoryHandle = directoryHandle;
      state.saveDirectoryName = directoryHandle.name || APP_STRINGS.saveFolderDefault;
      renderPreview();
    } catch {
      // Ignore user cancellation.
    }
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

    state.logoDataUrl = dataUrl;
    state.logoScale = 1;
    state.logoRotation = 0;
    state.logoPosition = { x: 50, y: 20 };
    state.activeOverlayTarget = "logo";
    renderPreview();
  }

  function handleOverlayClick(event) {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const colorSwatch = target?.closest("[data-overlay-color]");
    if (colorSwatch instanceof HTMLElement) {
      state.overlayColor = colorSwatch.dataset.overlayColor || state.overlayColor;
      state.showTextColorPalette = false;
      renderPreview();
      return;
    }

    const actionButton = target?.closest("[data-overlay-action]");
    if (actionButton instanceof HTMLElement) {
      const overlayType = actionButton.dataset.overlayType || state.activeOverlayTarget;
      const action = actionButton.dataset.overlayAction || "";

      if (action === "delete") {
        deleteOverlay(overlayType);
      } else if (action === "rotate-left") {
        rotateOverlay(overlayType, -1);
      } else if (action === "rotate-right") {
        rotateOverlay(overlayType, 1);
      } else if (action === "color" && overlayType === "text") {
        state.showTextColorPalette = !state.showTextColorPalette;
        renderPreview();
      }
      return;
    }

    const overlayBody = target?.closest(".overlay-item-body");
    const overlayType = overlayBody instanceof HTMLElement ? overlayBody.dataset.overlayType : null;
    if (overlayType === "text" || overlayType === "logo") {
      setActiveOverlayTarget(overlayType);
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
    const overlayType = handle instanceof HTMLElement
      ? handle.dataset.overlayType
      : overlayElement instanceof HTMLElement
        ? overlayElement.dataset.overlayType
        : null;

    if (overlayType !== "text" && overlayType !== "logo") {
      return;
    }

    const rect = dom.cameraStage.getBoundingClientRect();
    state.activeOverlayTarget = overlayType;
    state.showTextColorPalette = false;
    state.draggingOverlayTarget = overlayType;
    state.overlayInteraction = handle instanceof HTMLElement ? "resize" : "move";
    state.dragPointerId = event.pointerId;
    state.dragStartPointer = { x: event.clientX, y: event.clientY };
    state.dragSurfaceSize = { x: rect.width, y: rect.height };
    state.dragStartPosition = { ...getOverlayPosition(overlayType, state) };
    state.dragStartScale = state.logoScale;
    state.dragStartTextSize = state.overlaySize;
    event.preventDefault();
    renderPreview();
    const interactionElement = getOverlayInteractionElement(dom, overlayType);
    interactionElement?.setPointerCapture?.(event.pointerId);
  }

  function updateOverlayFromPointer(event) {
    if (
      !state.draggingOverlayTarget ||
      !state.dragStartPointer ||
      !state.dragStartPosition ||
      !state.overlayInteraction ||
      state.dragPointerId !== event.pointerId ||
      !state.dragSurfaceSize
    ) {
      return;
    }

    const dxPercent = ((event.clientX - state.dragStartPointer.x) / state.dragSurfaceSize.x) * 100;
    const dyPercent = ((event.clientY - state.dragStartPointer.y) / state.dragSurfaceSize.y) * 100;

    if (state.overlayInteraction === "move") {
      setOverlayPosition(state.draggingOverlayTarget, state, {
        x: clamp(state.dragStartPosition.x + dxPercent, APP_THRESHOLDS.minOverlayX, APP_THRESHOLDS.maxOverlayX),
        y: clamp(state.dragStartPosition.y + dyPercent, APP_THRESHOLDS.minOverlayY, APP_THRESHOLDS.maxOverlayY)
      });
    } else if (state.draggingOverlayTarget === "logo") {
      state.logoScale = clamp(
        state.dragStartScale + ((dxPercent + dyPercent) / 10),
        APP_THRESHOLDS.minLogoScale,
        APP_THRESHOLDS.maxLogoScale
      );
    } else {
      state.overlaySize = clamp(
        state.dragStartTextSize + ((dxPercent + dyPercent) * 2.4),
        APP_THRESHOLDS.minTextSize,
        APP_THRESHOLDS.maxTextSize
      );
    }

    event.preventDefault();
    syncSelectedOverlayElement();
  }

  function stopOverlayInteraction(event) {
    if (!state.draggingOverlayTarget && !state.overlayInteraction) {
      return;
    }

    if (event && state.dragPointerId === event.pointerId) {
      const interactionElement = state.draggingOverlayTarget
        ? getOverlayInteractionElement(dom, state.draggingOverlayTarget)
        : null;
      interactionElement?.releasePointerCapture?.(event.pointerId);
    }

    state.draggingOverlayTarget = null;
    state.overlayInteraction = null;
    state.dragPointerId = null;
    state.dragStartPointer = null;
    state.dragSurfaceSize = null;
    state.dragStartPosition = null;
    renderPreview();
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
    syncSlideshowIdleFromControl,
    stepCountdown,
    stepSlideshowIdle,
    setOperatorPanelOpen,
    registerOperatorAccessClick,
    renderFrameTray: renderFrameTrayView,
    triggerLogoUpload,
    syncLogoUploadFromControl,
    pickSaveFolder,
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
