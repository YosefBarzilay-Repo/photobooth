
/**
 * @typedef {import("../types/app.js").AppState} AppState
 * @typedef {import("../types/dom.js").DomRefs} DomRefs
 */

/**
 * @param {DomRefs} dom
 * @param {AppState} state
 * @param {{
 *   captureVideo: () => Promise<void>,
 *   handleResultReset: () => Promise<void>,
 *   downloadVideo: () => void,
 *   operatorScreen: {
 *     setOperatorPanelOpen: (isOpen: boolean) => void,
 *     registerOperatorAccessClick: () => void,
 *     syncCountdownFromControl: () => void,
 *     syncDurationFromControl: () => void,
 *     syncCameraEffectFromControl: () => void,
 *     syncCameraEffectSpeedFromControl: () => void,
 *     syncOverlayControls: () => void,
 *     syncEffectUiState: () => void,
 *     setEffectDirectionFromPointer: (event: PointerEvent) => void
 *   }
 * }} handlers
 */
export default function wireEvents(dom, state, handlers) {
  dom.snapButton.addEventListener("click", () => {
    void handlers.captureVideo();
  });

  dom.cameraStage.addEventListener("click", (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    if (target.closest("#operatorAccessTrigger") || target.closest("button")) {
      return;
    }

    if (state.mode === "camera" && !state.captureInProgress) {
      void handlers.captureVideo();
    }
  });

  dom.resultRetakeButton.addEventListener("click", () => {
    void handlers.handleResultReset();
  });

  dom.anotherShotButton.addEventListener("click", () => {
    void handlers.handleResultReset();
  });

  dom.downloadButton.addEventListener("click", handlers.downloadVideo);

  dom.operatorCloseButton.addEventListener("click", () => {
    handlers.operatorScreen.setOperatorPanelOpen(false);
  });

  dom.operatorAccessTrigger.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    handlers.operatorScreen.registerOperatorAccessClick();
  });

  dom.countdownSelect.addEventListener("change", handlers.operatorScreen.syncCountdownFromControl);
  dom.durationSelect.addEventListener("change", handlers.operatorScreen.syncDurationFromControl);
  dom.cameraEffectSelect.addEventListener("change", handlers.operatorScreen.syncCameraEffectFromControl);
  dom.cameraEffectSpeedInput.addEventListener("input", handlers.operatorScreen.syncCameraEffectSpeedFromControl);
  dom.setZoomDirectionButton.addEventListener("click", () => {
    if (state.cameraEffect === "none") {
      return;
    }

    state.settingEffectDirection = !state.settingEffectDirection;
    handlers.operatorScreen.syncEffectUiState();
  });

  [dom.textInput, dom.fontSelect, dom.colorInput, dom.sizeInput].forEach((input) => {
    input.addEventListener("input", handlers.operatorScreen.syncOverlayControls);
  });

  dom.operatorPreviewVideo.addEventListener("pointerdown", (event) => {
    handlers.operatorScreen.setEffectDirectionFromPointer(event);
  });

  dom.kenBurnsToggle.addEventListener("change", () => {
    state.kenBurnsEnabled = dom.kenBurnsToggle.checked;
    dom.resultVideo.classList.toggle("ken-burns-effect", state.kenBurnsEnabled);
    dom.kenBurnsPreview.classList.toggle("ken-burns-effect", state.kenBurnsEnabled);
    localStorage.setItem("kenBurnsEnabled", String(state.kenBurnsEnabled));
  });
}
