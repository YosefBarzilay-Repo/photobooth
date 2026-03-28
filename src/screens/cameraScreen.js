import { APP_STRINGS } from "../constants/appConfig.js";

/**
 * @typedef {import("../types/app.js").AppState} AppState
 * @typedef {import("../types/dom.js").DomRefs} DomRefs
 */

export default function createCameraScreen(dom, state) {
  function syncModeUi() {
    document.body.dataset.mode = state.mode;
    const editorVisible = state.mode === "editor";
    const hideShutter = state.mode !== "camera" || (state.captureInProgress && !state.shutterAnimatingOut && !state.isRecording);
    const showResultActions = state.mode === "editor";

    dom.cameraStage.classList.toggle("hidden", editorVisible);
    dom.editorStage.classList.toggle("hidden", !editorVisible);
    dom.snapButton.classList.toggle("hidden", hideShutter);
    dom.snapButton.classList.toggle("shutter-exit", state.shutterAnimatingOut);
    dom.snapButton.classList.toggle("is-recording", state.isRecording);
    dom.snapButton.ariaLabel = state.isRecording ? "Stop recording" : "Start recording";
    dom.snapButtonIcon.textContent = state.isRecording ? "stop" : "videocam";
    dom.recordingTimer.classList.toggle("hidden", !state.isRecording);
    dom.resultRetakeButton.classList.toggle("hidden", !showResultActions);
    dom.anotherShotButton.classList.toggle("hidden", !showResultActions);
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