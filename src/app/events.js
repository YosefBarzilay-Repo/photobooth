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
    if (
      target.closest("button") ||
      target.closest(".overlay-tool-button") ||
      target.closest(".overlay-color-swatch")
    ) {
      return;
    }

    if (state.mode === "camera" && !state.captureInProgress && !state.operatorPanelOpen) {
      void handlers.captureVideo();
    }
  });

  dom.resultPlayButton.addEventListener("click", () => {
    handlers.editorScreen.togglePlayback();
  });

  dom.resultNewButton.addEventListener("click", () => {
    void handlers.handleResultReset();
  });

  dom.resultVideo.addEventListener("play", handlers.editorScreen.handlePlaybackStateChange);
  dom.resultVideo.addEventListener("pause", handlers.editorScreen.handlePlaybackStateChange);
  dom.resultVideo.addEventListener("ended", handlers.editorScreen.handlePlaybackStateChange);

  dom.operatorCloseButton.addEventListener("click", () => {
    handlers.operatorScreen.setOperatorPanelOpen(false);
  });

  dom.operatorAccessTrigger.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    handlers.operatorScreen.setOperatorPanelOpen(true);
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

  dom.cameraText.addEventListener("click", handlers.operatorScreen.handleOverlayClick);
  dom.cameraText.addEventListener("pointerdown", handlers.operatorScreen.startOverlayInteraction);
  dom.operatorDialogHeader.addEventListener("pointerdown", handlers.operatorScreen.startDialogInteraction);
  dom.operatorDialogResize.addEventListener("pointerdown", handlers.operatorScreen.startDialogInteraction);
  window.addEventListener("pointermove", handlers.operatorScreen.updateOverlayFromPointer);
  window.addEventListener("pointerup", handlers.operatorScreen.stopOverlayInteraction);
  window.addEventListener("pointercancel", handlers.operatorScreen.stopOverlayInteraction);
  window.addEventListener("pointermove", handlers.operatorScreen.updateDialogInteraction);
  window.addEventListener("pointerup", handlers.operatorScreen.stopDialogInteraction);
  window.addEventListener("pointercancel", handlers.operatorScreen.stopDialogInteraction);
  window.addEventListener("resize", handlers.operatorScreen.handleWindowResize);
}
