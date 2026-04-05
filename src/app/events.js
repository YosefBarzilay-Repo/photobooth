/**
 * @typedef {import("../types/app.js").AppState} AppState
 * @typedef {import("../types/dom.js").DomRefs} DomRefs
 */

import { logger } from "../services/logger.js";

export default function wireEvents(dom, state, handlers) {
  dom.appBrandButton.addEventListener("click", () => {
    void logger.audit("App brand button clicked.", { mode: state.mode });
    handlers.registerPreviewAccessClick();
  });
  dom.operatorAccessHotspot.addEventListener("click", () => {
    void logger.audit("Operator access hotspot clicked.", { mode: state.mode });
    handlers.registerPreviewAccessClick();
  });

  dom.navTakeNewButton.addEventListener("click", () => {
    void logger.audit("Primary nav start event clicked.");
    void handlers.openTakeNewView();
  });

  dom.navLibraryButton.addEventListener("click", () => {
    void logger.audit("Primary nav library clicked.");
    void handlers.openGalleryPanel("videos");
  });

  dom.navInstructionsButton.addEventListener("click", () => {
    void logger.audit("Primary nav instructions clicked.");
    void handlers.openInstructionsView();
  });

  dom.navSettingsButton.addEventListener("click", () => {
    void logger.audit("Primary nav settings clicked.");
    void handlers.openSettingsView();
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
    handlers.switchSettingsSection("editor");
  });

  dom.settingsTabInputs.addEventListener("click", () => {
    void logger.audit("Settings recordings tab clicked.");
    void handlers.refreshHardwareOptions?.();
    handlers.switchSettingsSection("inputs");
  });
  dom.settingsTabSlideshow.addEventListener("click", () => {
    void logger.audit("Settings slideshow tab clicked.");
    void handlers.refreshHardwareOptions?.();
    handlers.switchSettingsSection("slideshow");
  });

  dom.resultSaveButton.addEventListener("click", () => {
    void logger.audit("Result save button clicked.", { filename: state.recordingFilename });
    void handlers.saveCurrentRecording();
  });

  dom.resultNewButton.addEventListener("click", () => {
    void logger.audit("Result new button clicked.");
    void handlers.handleResultReset();
  });

  dom.instructionRetakeButton.addEventListener("click", () => {
    void logger.audit("Post-recording retake button clicked.");
    void handlers.handlePostRecordingRetake();
  });

  dom.instructionSaveButton.addEventListener("click", () => {
    void logger.audit("Post-recording save button clicked.", { filename: state.recordingFilename });
    void handlers.handlePostRecordingSave();
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
  dom.addTextOverlayButton.addEventListener("click", () => {
    void logger.audit("Add text overlay button clicked.");
    handlers.operatorScreen.addTextOverlay();
  });
  dom.editorCameraToggleButton.addEventListener("click", () => {
    void logger.audit("Editor camera toggle button clicked.", { enabled: state.settingsCameraEnabled });
    void handlers.toggleEditorCamera();
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
  dom.slideshowFadeDurationInput.addEventListener("input", () => {
    void logger.audit("Slideshow fade duration input changed.", { value: dom.slideshowFadeDurationInput.value });
    handlers.operatorScreen.syncSlideshowFadeDurationFromControl();
  });
  dom.slideshowFadeDurationInput.addEventListener("change", () => {
    void logger.audit("Slideshow fade duration input committed.", { value: dom.slideshowFadeDurationInput.value });
    handlers.operatorScreen.syncSlideshowFadeDurationFromControl();
  });
  dom.slideshowFadeDurationMinusButton.addEventListener("click", () => {
    void logger.audit("Slideshow fade duration decrement button clicked.");
    handlers.operatorScreen.stepSlideshowFadeDuration(-1);
  });
  dom.slideshowFadeDurationPlusButton.addEventListener("click", () => {
    void logger.audit("Slideshow fade duration increment button clicked.");
    handlers.operatorScreen.stepSlideshowFadeDuration(1);
  });
  dom.closeSlideshowButton.addEventListener("click", () => {
    void logger.audit("Close all slideshows button clicked.");
    void handlers.closeAllSlideshows();
  });

  [dom.textInput, dom.fontSelect, dom.orientationSelect, dom.slideshowFullscreenSelect, dom.slideshowMonitorSelect, dom.slideshowAudioOutputSelect, dom.slideshowSoundEnabledSelect, dom.mainWindowFullscreenSelect, dom.mainWindowMonitorSelect].forEach((input) => {
    input.addEventListener("input", () => {
      void logger.audit("Overlay input changed.", { id: input.id, value: input.value });
      handlers.operatorScreen.syncOverlayControls();
    });
    input.addEventListener("change", () => {
      void logger.audit("Overlay input committed.", { id: input.id, value: input.value });
      handlers.operatorScreen.syncOverlayControls();
    });
  });

  [dom.mainWindowFullscreenSelect, dom.mainWindowMonitorSelect].forEach((input) => {
    input.addEventListener("change", () => {
      void handlers.applyMainWindowDisplaySettings();
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

  dom.instructionPagePrevButton.addEventListener("click", () => {
    handlers.operatorScreen.stepInstructionPage(-1);
  });
  dom.instructionPageNextButton.addEventListener("click", () => {
    handlers.operatorScreen.stepInstructionPage(1);
  });
  dom.instructionPageAddButton.addEventListener("click", () => {
    handlers.operatorScreen.addInstructionPage();
  });
  dom.instructionPageRemoveButton.addEventListener("click", () => {
    handlers.operatorScreen.removeInstructionPage();
  });
  [dom.instructionPageNameInput, dom.instructionPagePhaseSelect, dom.instructionPageNavigationSelect, dom.instructionPageAutoAdvanceInput, dom.instructionTextInput, dom.instructionFontSelect, dom.instructionTransitionInput].forEach((input) => {
    input.addEventListener("input", () => {
      if (input === dom.instructionTransitionInput) {
        handlers.operatorScreen.syncInstructionTransitionFromControl();
        return;
      }
      if (input === dom.instructionTextInput || input === dom.instructionFontSelect) {
        handlers.operatorScreen.syncInstructionElementFields({ render: false });
        return;
      }
      handlers.operatorScreen.syncInstructionPageFields({ render: input !== dom.instructionPageNameInput });
    });
    input.addEventListener("change", () => {
      if (input === dom.instructionTransitionInput) {
        handlers.operatorScreen.syncInstructionTransitionFromControl();
        return;
      }
      if (input === dom.instructionTextInput || input === dom.instructionFontSelect) {
        handlers.operatorScreen.syncInstructionElementFields();
        return;
      }
      handlers.operatorScreen.syncInstructionPageFields({ finalize: input === dom.instructionPageNameInput });
    });
  });
  dom.instructionAutoAdvanceMinusButton.addEventListener("click", () => {
    handlers.operatorScreen.stepInstructionAutoAdvance(-1);
  });
  dom.instructionAutoAdvancePlusButton.addEventListener("click", () => {
    handlers.operatorScreen.stepInstructionAutoAdvance(1);
  });
  dom.instructionTransitionMinusButton.addEventListener("click", () => {
    handlers.operatorScreen.stepInstructionTransition(-1);
  });
  dom.instructionTransitionPlusButton.addEventListener("click", () => {
    handlers.operatorScreen.stepInstructionTransition(1);
  });
  dom.instructionAddTextElementButton.addEventListener("click", () => {
    handlers.operatorScreen.addInstructionTextElement();
  });
  dom.instructionAddMediaElementButton.addEventListener("click", () => {
    handlers.operatorScreen.triggerInstructionMediaUpload({ mode: "new" });
  });
  dom.instructionElementImageInput.addEventListener("change", () => {
    void handlers.operatorScreen.syncInstructionMediaUploadFromControl();
  });
  dom.instructionPagePreview.addEventListener("click", handlers.operatorScreen.handleInstructionPreviewClick);
  dom.instructionPagePreview.addEventListener("pointerdown", handlers.operatorScreen.startInstructionPreviewDrag);
  window.addEventListener("pointermove", handlers.operatorScreen.updateInstructionPreviewDrag);
  window.addEventListener("pointerup", handlers.operatorScreen.stopInstructionPreviewDrag);
  window.addEventListener("pointercancel", handlers.operatorScreen.stopInstructionPreviewDrag);

  dom.cameraText.addEventListener("click", handlers.operatorScreen.handleOverlayClick);
  dom.cameraText.addEventListener("pointerdown", handlers.operatorScreen.startOverlayInteraction);
  dom.settingsCameraText.addEventListener("click", handlers.operatorScreen.handleOverlayClick);
  dom.settingsCameraText.addEventListener("pointerdown", handlers.operatorScreen.startOverlayInteraction);
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
