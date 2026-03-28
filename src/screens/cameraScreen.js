import { APP_STRINGS } from "../constants/appConfig.js";

/**
 * @typedef {import("../types/app.js").AppState} AppState
 * @typedef {import("../types/dom.js").DomRefs} DomRefs
 */

export default function createCameraScreen(dom, state) {
  function syncModeUi() {
    document.body.dataset.mode = state.mode;
    const cameraMode = state.mode === "camera";
    const editorVisible = state.mode === "editor";
    const countdownActive = state.countdownValue !== null;
    const showResultActions = state.mode === "editor";
    const hideConsole = state.operatorPanelOpen || state.galleryPanelOpen;
    const resultActionsDisabled = state.isSaving;

    dom.cameraStage.classList.toggle("hidden", editorVisible);
    dom.editorStage.classList.toggle("hidden", !editorVisible);
    dom.console.classList.toggle("hidden", hideConsole);
    dom.recordControl.classList.toggle("hidden", !cameraMode);
    dom.openPreviewButton.classList.toggle("hidden", !cameraMode);
    dom.openPreviewButton.disabled = state.isRecording || state.captureInProgress || state.isSaving;
    dom.snapButton.classList.toggle("hidden", !cameraMode);
    dom.snapButton.classList.toggle("shutter-exit", false);
    dom.snapButton.classList.toggle("is-recording", state.isRecording);
    dom.snapButton.classList.toggle("is-countdown", countdownActive);
    dom.snapButton.ariaLabel = state.isRecording ? "Stop recording" : "Start recording";
    dom.snapButton.disabled = state.isSaving;

    const showLabel = countdownActive || state.isRecording;
    dom.snapButtonIcon.classList.toggle("hidden", showLabel);
    dom.snapButtonLabel.classList.toggle("hidden", !showLabel);

    if (countdownActive) {
      dom.snapButtonLabel.textContent = String(state.countdownValue);
    } else if (state.isRecording) {
      dom.snapButtonLabel.textContent = dom.recordingTimer.textContent || "00:00";
    } else {
      dom.snapButtonIcon.textContent = "videocam";
      dom.snapButtonLabel.textContent = "";
    }

    dom.recordingTimer.classList.add("hidden");
    dom.resultNewButton.classList.toggle("hidden", !showResultActions);
    dom.previewSeparatorPrimary.classList.toggle("hidden", !showResultActions);
    dom.resultSaveButton.classList.toggle("hidden", !showResultActions);
    dom.resultSaveButton.disabled = !state.recordingBlob || resultActionsDisabled;
    dom.resultSaveButton.classList.toggle("is-busy", state.isSaving);
    dom.resultSaveIcon.textContent = state.isSaving ? "progress_activity" : "download";
    dom.resultSaveLabel.textContent = state.isSaving ? "Saving..." : "Save";
    dom.resultPlayButton.classList.toggle("hidden", !showResultActions);
    dom.resultPlayButton.disabled = !state.recordingUrl || resultActionsDisabled;
    dom.resultGalleryButton.classList.toggle("hidden", !showResultActions);
    dom.resultGalleryButton.disabled = resultActionsDisabled;
    dom.previewSeparatorSecondary.classList.toggle("hidden", !showResultActions);
    dom.resultProjectsButton.classList.toggle("hidden", !showResultActions);
    dom.resultProjectsButton.disabled = resultActionsDisabled;
    dom.previewSeparatorTertiary.classList.toggle("hidden", !showResultActions);
    dom.resultSlideshowButton.classList.toggle("hidden", !showResultActions);
    dom.resultSlideshowButton.disabled = resultActionsDisabled;
    dom.previewSeparatorQuaternary.classList.toggle("hidden", !showResultActions);
    dom.resultSettingsButton.classList.toggle("hidden", !showResultActions);
    dom.resultSettingsButton.disabled = resultActionsDisabled;
    dom.resultNewButton.disabled = resultActionsDisabled;
  }

  function showError(message) {
    dom.errorOverlay.replaceChildren();
    const wrapper = document.createElement("div");
    const icon = document.createElement("span");
    const text = document.createElement("p");

    icon.className = "material-symbols-outlined";
    icon.textContent = "warning";
    text.textContent = message || APP_STRINGS.cameraAccessDenied;

    wrapper.append(icon, text);
    dom.errorOverlay.appendChild(wrapper);
    dom.errorOverlay.classList.remove("hidden");
    dom.emptyCamera.classList.add("hidden");
    state.captureReady = false;
  }

  function clearError() {
    dom.errorOverlay.classList.add("hidden");
  }

  return {
    syncModeUi,
    showError,
    clearError
  };
}
