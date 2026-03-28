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
 *   operatorScreen: {
 *     setOperatorPanelOpen: (isOpen: boolean) => void,
 *     registerOperatorAccessClick: () => void,
 *     syncCountdownFromControl: () => void,
 *     stepCountdown: (delta: number) => void,
 *     syncDurationFromControl: () => void,
 *     syncOverlayControls: () => void,
 *     renderFrameTray: () => void,
 *     triggerLogoUpload: () => void,
 *     syncLogoUploadFromControl: () => Promise<void>,
 *     handleOverlayClick: (event: MouseEvent) => void,
 *     startOverlayDrag: (event: PointerEvent) => void,
 *     dragOverlay: (event: PointerEvent) => void,
 *     stopOverlayDrag: () => void
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

  dom.operatorCloseButton.addEventListener("click", () => {
    handlers.operatorScreen.setOperatorPanelOpen(false);
  });

  dom.operatorAccessTrigger.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    handlers.operatorScreen.registerOperatorAccessClick();
  });

  dom.countdownInput.addEventListener("input", handlers.operatorScreen.syncCountdownFromControl);
  dom.countdownInput.addEventListener("change", handlers.operatorScreen.syncCountdownFromControl);
  dom.countdownMinusButton.addEventListener("click", () => {
    handlers.operatorScreen.stepCountdown(-1);
  });
  dom.countdownPlusButton.addEventListener("click", () => {
    handlers.operatorScreen.stepCountdown(1);
  });
  dom.durationSelect.addEventListener("change", handlers.operatorScreen.syncDurationFromControl);

  [dom.textInput, dom.fontSelect, dom.colorInput, dom.sizeInput].forEach((input) => {
    input.addEventListener("input", handlers.operatorScreen.syncOverlayControls);
  });

  dom.logoUploadButton.addEventListener("click", handlers.operatorScreen.triggerLogoUpload);
  dom.logoInput.addEventListener("change", () => {
    void handlers.operatorScreen.syncLogoUploadFromControl();
  });

  dom.operatorText.addEventListener("click", handlers.operatorScreen.handleOverlayClick);
  dom.operatorText.addEventListener("pointerdown", handlers.operatorScreen.startOverlayDrag);
  window.addEventListener("pointermove", handlers.operatorScreen.dragOverlay);
  window.addEventListener("pointerup", handlers.operatorScreen.stopOverlayDrag);
  window.addEventListener("pointercancel", handlers.operatorScreen.stopOverlayDrag);
}