/**
 * @typedef {import("../types/app.js").AppState} AppState
 * @typedef {import("../types/dom.js").DomRefs} DomRefs
 */

export default function wireEvents(dom, state, handlers) {
  dom.snapButton.addEventListener("click", () => {
    void handlers.captureVideo();
  });

  dom.resultPlayButton.addEventListener("click", () => {
    handlers.editorScreen.togglePlayback();
  });

  dom.resultSaveButton.addEventListener("click", () => {
    void handlers.saveCurrentRecording();
  });

  dom.resultNewButton.addEventListener("click", () => {
    void handlers.handleResultReset();
  });

  dom.resultSlideshowButton.addEventListener("click", () => {
    void handlers.startSlideshow();
  });

  dom.resultVideo.addEventListener("play", handlers.editorScreen.handlePlaybackStateChange);
  dom.resultVideo.addEventListener("pause", handlers.editorScreen.handlePlaybackStateChange);
  dom.resultVideo.addEventListener("ended", handlers.handleResultEnded);

  dom.operatorCloseButton.addEventListener("click", () => {
    handlers.operatorScreen.setOperatorPanelOpen(false);
    handlers.handleSlideshowIdleSettingChange();
  });

  dom.operatorAccessTrigger.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    handlers.operatorScreen.setOperatorPanelOpen(true);
    handlers.handleSlideshowIdleSettingChange();
  });

  dom.countdownInput.addEventListener("input", handlers.operatorScreen.syncCountdownFromControl);
  dom.countdownInput.addEventListener("change", handlers.operatorScreen.syncCountdownFromControl);
  dom.countdownMinusButton.addEventListener("click", () => {
    handlers.operatorScreen.stepCountdown(-1);
  });
  dom.countdownPlusButton.addEventListener("click", () => {
    handlers.operatorScreen.stepCountdown(1);
  });

  dom.slideshowIdleInput.addEventListener("input", handlers.operatorScreen.syncSlideshowIdleFromControl);
  dom.slideshowIdleInput.addEventListener("change", handlers.handleSlideshowIdleSettingChange);
  dom.slideshowIdleMinusButton.addEventListener("click", () => {
    handlers.operatorScreen.stepSlideshowIdle(-1);
    handlers.handleSlideshowIdleSettingChange();
  });
  dom.slideshowIdlePlusButton.addEventListener("click", () => {
    handlers.operatorScreen.stepSlideshowIdle(1);
    handlers.handleSlideshowIdleSettingChange();
  });

  [dom.textInput, dom.fontSelect].forEach((input) => {
    input.addEventListener("input", handlers.operatorScreen.syncOverlayControls);
  });

  dom.logoUploadButton.addEventListener("click", handlers.operatorScreen.triggerLogoUpload);
  dom.logoInput.addEventListener("change", () => {
    void handlers.operatorScreen.syncLogoUploadFromControl();
  });
  dom.saveFolderButton.addEventListener("click", () => {
    void handlers.pickSaveFolder();
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
