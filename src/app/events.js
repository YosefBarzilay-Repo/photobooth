/**
 * @typedef {import("../types/app.js").AppState} AppState
 * @typedef {import("../types/dom.js").DomRefs} DomRefs
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

  [dom.textInput, dom.fontSelect].forEach((input) => {
    input.addEventListener("input", handlers.operatorScreen.syncOverlayControls);
  });

  dom.logoUploadButton.addEventListener("click", handlers.operatorScreen.triggerLogoUpload);
  dom.logoInput.addEventListener("change", () => {
    void handlers.operatorScreen.syncLogoUploadFromControl();
  });
  dom.saveFolderButton.addEventListener("click", () => {
    void handlers.operatorScreen.pickSaveFolder();
  });

  dom.operatorText.addEventListener("click", handlers.operatorScreen.handleOverlayClick);
  dom.operatorText.addEventListener("pointerdown", handlers.operatorScreen.startOverlayInteraction);
  window.addEventListener("pointermove", handlers.operatorScreen.updateOverlayFromPointer);
  window.addEventListener("pointerup", handlers.operatorScreen.stopOverlayInteraction);
  window.addEventListener("pointercancel", handlers.operatorScreen.stopOverlayInteraction);
}