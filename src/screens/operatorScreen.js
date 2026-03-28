import { APP_STRINGS, APP_THRESHOLDS } from "../constants/appConfig.js";
import renderFrameTray from "../components/frameTray.js";

/**
 * @typedef {import("../types/app.js").AppState} AppState
 * @typedef {import("../types/app.js").OverlayTarget} OverlayTarget
 * @typedef {import("../types/dom.js").DomRefs} DomRefs
 */

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * @param {OverlayTarget} target
 * @param {AppState} state
 * @returns {{ x: number, y: number }}
 */
function getOverlayPosition(target, state) {
  return target === "logo" ? state.logoPosition : state.overlayTextPosition;
}

/**
 * @param {OverlayTarget} target
 * @param {AppState} state
 * @param {{ x: number, y: number }} position
 */
function setOverlayPosition(target, state, position) {
  if (target === "logo") {
    state.logoPosition = position;
    return;
  }

  state.overlayTextPosition = position;
}

/**
 * @param {DomRefs} dom
 * @param {AppState} state
 * @param {{ renderOverlayPreview: () => void }} editorScreen
 */
export default function createOperatorScreen(dom, state, editorScreen) {
  let operatorAccessClickCount = 0;
  /** @type {number | null} */
  let operatorAccessClickTimer = null;

  function renderPreview() {
    editorScreen.renderOverlayPreview();
  }

  function clampCountdown(value) {
    return Math.max(0, Math.min(120, Math.round(value)));
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

  function stepCountdown(delta) {
    dom.countdownInput.value = String(clampCountdown((Number(dom.countdownInput.value) || 0) + delta));
    syncCountdownFromControl();
  }

  function syncDurationFromControl() {
    state.recordingDurationSeconds = Number(dom.durationSelect.value) || 0;
  }

  function syncOverlayControls() {
    state.overlayText = dom.textInput.value.trim();
    state.overlayFont = dom.fontSelect.value;
    state.overlayColor = dom.colorInput.value;
    state.overlaySize = Number(dom.sizeInput.value) || 44;

    if (state.overlayText && !state.activeOverlayTarget) {
      state.activeOverlayTarget = "text";
    }

    renderPreview();
  }

  function syncControlsFromState() {
    dom.countdownInput.value = String(state.countdownSeconds);
    dom.durationSelect.value = String(state.recordingDurationSeconds);
    dom.textInput.value = state.overlayText;
    dom.fontSelect.value = state.overlayFont;
    dom.colorInput.value = state.overlayColor;
    dom.sizeInput.value = String(state.overlaySize);
    syncCountdownFromControl();
    syncDurationFromControl();
    renderPreview();
  }

  function setOperatorPanelOpen(isOpen) {
    state.operatorPanelOpen = isOpen;
    dom.operatorPanel.classList.toggle("hidden", !isOpen);
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
    renderPreview();
  }

  function applyOverlayAction(target, action) {
    if (!target) {
      return;
    }

    if (target === "text") {
      if (action === "delete") {
        state.overlayText = "";
        dom.textInput.value = "";
        state.activeOverlayTarget = state.logoDataUrl ? "logo" : null;
      } else if (action === "grow") {
        state.overlaySize = clamp(state.overlaySize + APP_THRESHOLDS.textResizeStep, 24, 160);
        dom.sizeInput.value = String(state.overlaySize);
      } else if (action === "shrink") {
        state.overlaySize = clamp(state.overlaySize - APP_THRESHOLDS.textResizeStep, 24, 160);
        dom.sizeInput.value = String(state.overlaySize);
      } else if (action === "rotate-left") {
        state.overlayTextRotation -= APP_THRESHOLDS.overlayRotationStep;
      } else if (action === "rotate-right") {
        state.overlayTextRotation += APP_THRESHOLDS.overlayRotationStep;
      }
    }

    if (target === "logo") {
      if (action === "delete") {
        state.logoDataUrl = "";
        dom.logoInput.value = "";
        state.activeOverlayTarget = state.overlayText ? "text" : null;
      } else if (action === "grow") {
        state.logoScale = clamp(state.logoScale + APP_THRESHOLDS.logoScaleStep, APP_THRESHOLDS.minLogoScale, APP_THRESHOLDS.maxLogoScale);
      } else if (action === "shrink") {
        state.logoScale = clamp(state.logoScale - APP_THRESHOLDS.logoScaleStep, APP_THRESHOLDS.minLogoScale, APP_THRESHOLDS.maxLogoScale);
      } else if (action === "rotate-left") {
        state.logoRotation -= APP_THRESHOLDS.overlayRotationStep;
      } else if (action === "rotate-right") {
        state.logoRotation += APP_THRESHOLDS.overlayRotationStep;
      }
    }

    renderPreview();
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

    state.logoDataUrl = dataUrl;
    state.logoScale = 1;
    state.logoRotation = 0;
    state.logoPosition = { x: 50, y: 20 };
    state.activeOverlayTarget = "logo";
    renderPreview();
  }

  function handleOverlayClick(event) {
    const target = /** @type {HTMLElement | null} */ (event.target instanceof HTMLElement ? event.target : null);
    const actionButton = target?.closest("[data-overlay-action]");

    if (actionButton instanceof HTMLElement) {
      applyOverlayAction(
        /** @type {OverlayTarget} */ (actionButton.dataset.overlayType || state.activeOverlayTarget),
        actionButton.dataset.overlayAction || ""
      );
      return;
    }

    const overlayBody = target?.closest(".overlay-item-body");
    const overlayType = overlayBody instanceof HTMLElement ? overlayBody.dataset.overlayType : null;

    if (overlayType === "text" || overlayType === "logo") {
      setActiveOverlayTarget(overlayType);
    }
  }

  function startOverlayDrag(event) {
    const target = /** @type {HTMLElement | null} */ (event.target instanceof HTMLElement ? event.target : null);

    if (!target || target.closest("[data-overlay-action]")) {
      return;
    }

    const overlayBody = target.closest(".overlay-item-body");
    const overlayType = overlayBody instanceof HTMLElement ? overlayBody.dataset.overlayType : null;

    if (overlayType !== "text" && overlayType !== "logo") {
      return;
    }

    const rect = dom.operatorPreviewSurface.getBoundingClientRect();
    const position = getOverlayPosition(overlayType, state);
    state.activeOverlayTarget = overlayType;
    state.draggingOverlayTarget = overlayType;
    state.dragStartPointer = {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100
    };
    state.dragStartPosition = { ...position };
    renderPreview();
  }

  function dragOverlay(event) {
    if (!state.draggingOverlayTarget || !state.dragStartPointer || !state.dragStartPosition) {
      return;
    }

    const rect = dom.operatorPreviewSurface.getBoundingClientRect();
    const pointer = {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100
    };

    setOverlayPosition(state.draggingOverlayTarget, state, {
      x: clamp(state.dragStartPosition.x + (pointer.x - state.dragStartPointer.x), APP_THRESHOLDS.minOverlayX, APP_THRESHOLDS.maxOverlayX),
      y: clamp(state.dragStartPosition.y + (pointer.y - state.dragStartPointer.y), APP_THRESHOLDS.minOverlayY, APP_THRESHOLDS.maxOverlayY)
    });

    renderPreview();
  }

  function stopOverlayDrag() {
    state.draggingOverlayTarget = null;
    state.dragStartPointer = null;
    state.dragStartPosition = null;
  }

  return {
    syncControlsFromState,
    syncOverlayControls,
    syncCountdownFromControl,
    stepCountdown,
    syncDurationFromControl,
    setOperatorPanelOpen,
    registerOperatorAccessClick,
    renderFrameTray: renderFrameTrayView,
    triggerLogoUpload,
    syncLogoUploadFromControl,
    handleOverlayClick,
    startOverlayDrag,
    dragOverlay,
    stopOverlayDrag
  };
}