/**
 * @typedef {import("../types/app.js").AppState} AppState
 * @typedef {import("../types/dom.js").DomRefs} DomRefs
 */

import { logger } from "../services/logger.js";

export default function wireEvents(dom, state, handlers) {
  dom.openPreviewButton.addEventListener("click", () => {
    void logger.audit("Open preview button clicked.", { mode: state.mode });
    handlers.openPreviewView();
  });

  dom.snapButton.addEventListener("click", () => {
    void logger.audit("Snap/record button clicked.", {
      isRecording: state.isRecording,
      captureReady: state.captureReady,
      mode: state.mode
    });
    void handlers.captureVideo();
  });

  dom.resultPlayButton.addEventListener("click", () => {
    void logger.audit("Result play button clicked.", { filename: state.recordingFilename });
    handlers.editorScreen.togglePlayback();
  });

  dom.resultGalleryButton.addEventListener("click", () => {
    void logger.audit("Result gallery button clicked.");
    void handlers.openGalleryPanel("videos");
  });

  dom.resultSlideshowButton.addEventListener("click", () => {
    void logger.audit("Result slideshow button clicked.");
    void handlers.openSlideshowWindow();
  });

  dom.galleryCloseButton.addEventListener("click", () => {
    void logger.audit("Gallery close button clicked.");
    handlers.closeGalleryPanel();
  });

  dom.galleryOpenFolderButton.addEventListener("click", () => {
    void logger.audit("Gallery open folder button clicked.");
    void handlers.openGalleryFolder();
  });

  dom.galleryTabVideos.addEventListener("click", () => {
    void logger.audit("Library videos tab clicked.");
    void handlers.galleryScreen.switchView("videos");
  });

  dom.galleryTabProjects.addEventListener("click", () => {
    void logger.audit("Library projects tab clicked.");
    void handlers.galleryScreen.switchView("projects");
  });

  dom.settingsTabEditor.addEventListener("click", () => {
    void logger.audit("Settings video editor tab clicked.");
    handlers.operatorScreen.switchSection("editor");
  });

  dom.settingsTabCountdown.addEventListener("click", () => {
    void logger.audit("Settings recording countdown tab clicked.");
    handlers.operatorScreen.switchSection("countdown");
  });

  dom.settingsTabInputs.addEventListener("click", () => {
    void logger.audit("Settings recording inputs tab clicked.");
    handlers.operatorScreen.switchSection("inputs");
  });

  dom.resultSaveButton.addEventListener("click", () => {
    void logger.audit("Result save button clicked.", { filename: state.recordingFilename });
    void handlers.saveCurrentRecording();
  });

  dom.resultNewButton.addEventListener("click", () => {
    void logger.audit("Result new button clicked.");
    void handlers.handleResultReset();
  });

  dom.resultSettingsButton.addEventListener("click", () => {
    void logger.audit("Result settings button clicked.");
    handlers.openSettingsView();
  });

  dom.resultVideo.addEventListener("play", handlers.editorScreen.handlePlaybackStateChange);
  dom.resultVideo.addEventListener("pause", handlers.editorScreen.handlePlaybackStateChange);
  dom.resultVideo.addEventListener("ended", handlers.handleResultEnded);

  dom.operatorCloseButton.addEventListener("click", () => {
    void logger.audit("Operator close button clicked.");
    handlers.closeOperatorPanel();
  });
  dom.operatorCloseAppButton.addEventListener("click", () => {
    void logger.audit("Close app button clicked.");
    void handlers.closeApp();
  });

  dom.appDialogCloseButton.addEventListener("click", () => {
    void logger.audit("App dialog close button clicked.");
    handlers.hideAppDialog();
  });

  dom.countdownInput.addEventListener("input", () => {
    void logger.audit("Countdown input changed.", { value: dom.countdownInput.value });
    handlers.operatorScreen.syncCountdownFromControl();
  });
  dom.countdownInput.addEventListener("change", () => {
    void logger.audit("Countdown input committed.", { value: dom.countdownInput.value });
    handlers.operatorScreen.syncCountdownFromControl();
  });
  dom.countdownMinusButton.addEventListener("click", () => {
    void logger.audit("Countdown decrement button clicked.");
    handlers.operatorScreen.stepCountdown(-1);
  });
  dom.countdownPlusButton.addEventListener("click", () => {
    void logger.audit("Countdown increment button clicked.");
    handlers.operatorScreen.stepCountdown(1);
  });
  dom.recordingTimeoutInput.addEventListener("input", () => {
    void logger.audit("Recording timeout input changed.", { value: dom.recordingTimeoutInput.value });
    handlers.operatorScreen.syncRecordingTimeoutFromControl();
  });
  dom.recordingTimeoutInput.addEventListener("change", () => {
    void logger.audit("Recording timeout input committed.", { value: dom.recordingTimeoutInput.value });
    handlers.operatorScreen.syncRecordingTimeoutFromControl();
  });
  dom.recordingTimeoutMinusButton.addEventListener("click", () => {
    void logger.audit("Recording timeout decrement button clicked.");
    handlers.operatorScreen.stepRecordingTimeout(-1);
  });
  dom.recordingTimeoutPlusButton.addEventListener("click", () => {
    void logger.audit("Recording timeout increment button clicked.");
    handlers.operatorScreen.stepRecordingTimeout(1);
  });

  [dom.textInput, dom.fontSelect, dom.orientationSelect].forEach((input) => {
    input.addEventListener("input", () => {
      void logger.audit("Overlay input changed.", { id: input.id, value: input.value });
      handlers.operatorScreen.syncOverlayControls();
    });
    input.addEventListener("change", () => {
      void logger.audit("Overlay input committed.", { id: input.id, value: input.value });
      handlers.operatorScreen.syncOverlayControls();
    });
  });

  dom.logoUploadButton.addEventListener("click", () => {
    void logger.audit("Logo upload button clicked.");
    handlers.operatorScreen.triggerLogoUpload();
  });
  dom.logoInput.addEventListener("change", () => {
    void logger.audit("Logo file input changed.");
    void handlers.operatorScreen.syncLogoUploadFromControl();
  });
  dom.saveFolderButton.addEventListener("click", () => {
    void logger.audit("Choose folder button clicked.", {
      currentSaveDirectoryPath: state.saveDirectoryPath,
      currentSaveDirectoryName: state.saveDirectoryName
    });
    void handlers.pickSaveFolder();
  });

  dom.cameraText.addEventListener("click", handlers.operatorScreen.handleOverlayClick);
  dom.cameraText.addEventListener("pointerdown", handlers.operatorScreen.startOverlayInteraction);
  dom.operatorDialogHeader.addEventListener("pointerdown", handlers.operatorScreen.startDialogInteraction);
  dom.operatorDialogResize.addEventListener("pointerdown", handlers.operatorScreen.startDialogInteraction);
  dom.galleryDialogHeader.addEventListener("pointerdown", handlers.galleryScreen.startDialogInteraction);
  dom.galleryDialogResize.addEventListener("pointerdown", handlers.galleryScreen.startDialogInteraction);
  window.addEventListener("pointermove", handlers.operatorScreen.updateOverlayFromPointer);
  window.addEventListener("pointerup", handlers.operatorScreen.stopOverlayInteraction);
  window.addEventListener("pointercancel", handlers.operatorScreen.stopOverlayInteraction);
  window.addEventListener("pointermove", handlers.operatorScreen.updateDialogInteraction);
  window.addEventListener("pointerup", handlers.operatorScreen.stopDialogInteraction);
  window.addEventListener("pointercancel", handlers.operatorScreen.stopDialogInteraction);
  window.addEventListener("pointermove", handlers.galleryScreen.updateDialogInteraction);
  window.addEventListener("pointerup", handlers.galleryScreen.stopDialogInteraction);
  window.addEventListener("pointercancel", handlers.galleryScreen.stopDialogInteraction);
  window.addEventListener("resize", handlers.operatorScreen.handleWindowResize);
  window.addEventListener("resize", handlers.galleryScreen.handleWindowResize);
}
