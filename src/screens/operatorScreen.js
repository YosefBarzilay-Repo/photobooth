import { APP_STRINGS, APP_THRESHOLDS } from "../constants/appConfig.js";
import renderFrameTray from "../components/frameTray.js";

/**
 * @typedef {import("../types/app.js").AppState} AppState
 * @typedef {import("../types/dom.js").DomRefs} DomRefs
 */

/**
 * @param {DomRefs} dom
 * @param {AppState} state
 * @param {{ renderOverlayPreview: () => void }} editorScreen
 */
export default function createOperatorScreen(dom, state, editorScreen) {
  let operatorAccessClickCount = 0;
  /** @type {number | null} */
  let operatorAccessClickTimer = null;

  function resetOperatorAccessClicks() {
    operatorAccessClickCount = 0;
    if (operatorAccessClickTimer !== null) {
      window.clearTimeout(operatorAccessClickTimer);
      operatorAccessClickTimer = null;
    }
  }

  function syncCountdownFromControl() {
    state.countdownSeconds = Number(dom.countdownSelect.value) || 0;
  }

  function syncDurationFromControl() {
    state.recordingDurationSeconds = Number(dom.durationSelect.value) || 0;
  }

  function syncCameraEffectFromControl() {
    state.cameraEffect = dom.cameraEffectSelect.value === "zoom-in" || dom.cameraEffectSelect.value === "zoom-out"
      ? dom.cameraEffectSelect.value
      : "none";

    if (state.cameraEffect === "none") {
      state.settingEffectDirection = false;
    }

    syncEffectUiState();
  }

  function syncCameraEffectSpeedFromControl() {
    state.cameraEffectSpeed = Number(dom.cameraEffectSpeedInput.value) || 1;
  }

  function syncOverlayControls() {
    state.overlayText = dom.textInput.value.trim();
    state.overlayFont = dom.fontSelect.value;
    state.overlayColor = dom.colorInput.value;
    state.overlaySize = Number(dom.sizeInput.value) || 44;
    editorScreen.renderOverlayPreview();
  }

  function syncEffectUiState() {
    const enabled = state.cameraEffect !== "none";
    dom.cameraEffectSpeedInput.disabled = !enabled;
    dom.setZoomDirectionButton.disabled = !enabled;

    if (!enabled) {
      dom.effectHint.textContent = APP_STRINGS.effectHintDisabled;
      return;
    }

    dom.effectHint.textContent = state.settingEffectDirection
      ? APP_STRINGS.effectHintPicking
      : APP_STRINGS.effectHintIdle;
  }

  function loadKenBurnsSetting() {
    const savedSetting = localStorage.getItem("kenBurnsEnabled");
    if (savedSetting !== null) {
      state.kenBurnsEnabled = savedSetting === "true";
      dom.kenBurnsToggle.checked = state.kenBurnsEnabled;
    }
    dom.resultVideo.classList.toggle("ken-burns-effect", state.kenBurnsEnabled);
    dom.kenBurnsPreview.classList.toggle("ken-burns-effect", state.kenBurnsEnabled);
  }

  /**
   * @param {boolean} isOpen
   */
  function setOperatorPanelOpen(isOpen) {
    state.operatorPanelOpen = isOpen;
    dom.operatorPanel.classList.toggle("hidden", !isOpen);
    editorScreen.renderOverlayPreview();
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

    operatorAccessClickTimer = window.setTimeout(
      resetOperatorAccessClicks,
      APP_THRESHOLDS.operatorAccessTimeoutMs
    );
  }

  function renderFrameTrayView() {
    renderFrameTray(dom.frameTray, state.activeFrameId, (frameId) => {
      state.activeFrameId = frameId;
      renderFrameTrayView();
      editorScreen.renderOverlayPreview();
    });
  }

  function syncControlsFromState() {
    dom.countdownSelect.value = String(state.countdownSeconds);
    dom.durationSelect.value = String(state.recordingDurationSeconds);
    dom.cameraEffectSelect.value = state.cameraEffect;
    dom.cameraEffectSpeedInput.value = String(state.cameraEffectSpeed);
    dom.textInput.value = state.overlayText;
    dom.fontSelect.value = state.overlayFont;
    dom.colorInput.value = state.overlayColor;
    dom.sizeInput.value = String(state.overlaySize);
    dom.placeHint.textContent = "This text displays over the saved preview.";

    syncCountdownFromControl();
    syncDurationFromControl();
    syncCameraEffectFromControl();
    syncCameraEffectSpeedFromControl();
    syncEffectUiState();
    loadKenBurnsSetting();
  }

  /**
   * @param {PointerEvent} event
   */
  function setEffectDirectionFromPointer(event) {
    if (!state.settingEffectDirection) {
      return;
    }

    const rect = dom.operatorPreviewVideo.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    const distance = Math.hypot(dx, dy);

    if (distance < APP_THRESHOLDS.directionIgnoreRadiusPx) {
      return;
    }

    state.cameraEffectDirection = { x: dx / distance, y: dy / distance };
    state.settingEffectDirection = false;
    syncEffectUiState();
  }

  return {
    syncControlsFromState,
    syncEffectUiState,
    syncOverlayControls,
    setOperatorPanelOpen,
    registerOperatorAccessClick,
    renderFrameTray: renderFrameTrayView,
    syncCountdownFromControl,
    syncDurationFromControl,
    syncCameraEffectFromControl,
    syncCameraEffectSpeedFromControl,
    setEffectDirectionFromPointer,
  };
}
