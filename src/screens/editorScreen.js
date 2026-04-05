import renderFrameMarkup from "../components/frameMarkup.js";
import { renderOverlayLayer } from "../components/overlayRenderer.js";
import { logger } from "../services/logger.js";

/**
 * @typedef {import("../types/app.js").AppState} AppState
 * @typedef {import("../types/dom.js").DomRefs} DomRefs
 */

/**
 * @param {DomRefs} dom
 * @param {AppState} state
 */
export default function createEditorScreen(dom, state) {
  function syncResultVideoOrientation() {
    const isPortraitVideo = dom.resultVideo.videoWidth > 0
      && dom.resultVideo.videoHeight > 0
      && dom.resultVideo.videoHeight > dom.resultVideo.videoWidth;

    dom.editorStage.classList.toggle("stage-card-portrait", isPortraitVideo);
  }

  function syncOrientationUi() {
    const portrait = state.captureOrientation === "portrait";
    dom.cameraStage.classList.toggle("stage-card-portrait", portrait);
    dom.settingsEditorPreviewStage.classList.toggle("stage-card-portrait", portrait);
    if (!state.recordingUrl) {
      dom.editorStage.classList.toggle("stage-card-portrait", portrait);
      return;
    }

    syncResultVideoOrientation();
  }

  function syncEmptyState() {
    const shouldShowEmptyState = !state.recordingUrl;
    dom.resultEmptyState.classList.toggle("hidden", !shouldShowEmptyState);
    dom.resultVideo.classList.toggle("hidden", shouldShowEmptyState);
  }

  function syncPlaybackButton() {
    const paused = dom.resultVideo.paused || dom.resultVideo.ended;
    dom.resultPlayIcon.textContent = paused ? "play_arrow" : "pause";
    dom.resultPlayButton.setAttribute("aria-label", paused ? "Play video" : "Pause video");
  }

  function renderOverlayPreview() {
    syncOrientationUi();
    dom.cameraFrame.innerHTML = renderFrameMarkup(state.activeFrameId);
    dom.settingsCameraFrame.innerHTML = state.settingsCameraEnabled ? renderFrameMarkup(state.activeFrameId) : "";
    dom.resultFrame.innerHTML = "";
    dom.cameraText.classList.toggle("operator-grid", state.operatorPanelOpen && state.mode === "camera");
    dom.settingsCameraText.classList.toggle("operator-grid", state.operatorPanelOpen && state.mode === "camera" && state.settingsCameraEnabled);
    renderOverlayLayer(dom.cameraText, state, { interactive: state.operatorPanelOpen && state.mode === "camera" && state.appView !== "settings" });
    if (state.settingsCameraEnabled) {
      renderOverlayLayer(dom.settingsCameraText, state, { interactive: state.operatorPanelOpen && state.mode === "camera" && state.appView === "settings" });
    } else {
      dom.settingsCameraText.innerHTML = "";
    }
    dom.resultText.innerHTML = "";
  }

  function loadResultSource(url) {
    if (!url) {
      syncEmptyState();
      return;
    }

    dom.resultVideo.pause();
    dom.resultVideo.src = url;
    dom.resultVideo.currentTime = 0;
    dom.resultVideo.style.transform = "none";
    dom.resultVideo.loop = false;
    dom.resultVideo.onloadedmetadata = () => {
      syncResultVideoOrientation();
    };
    dom.resultVideo.load();
    syncEmptyState();
    syncPlaybackButton();
  }

  function showResult() {
    if (state.recordingUrl) {
      loadResultSource(state.recordingUrl);
    } else {
      syncEmptyState();
    }

    state.mode = "editor";
    syncOrientationUi();
    renderOverlayPreview();
    syncEmptyState();
  }

  function togglePlayback() {
    if (!state.recordingUrl || state.mode !== "editor") {
      return;
    }

    if (dom.resultVideo.paused || dom.resultVideo.ended) {
      if (dom.resultVideo.ended) {
        dom.resultVideo.currentTime = 0;
      }
      dom.resultVideo.play().catch((error) => {
        logger.warn("Result video playback did not start.", {
          errorMessage: error instanceof Error ? error.message : String(error)
        });
      });
    } else {
      dom.resultVideo.pause();
    }

    syncPlaybackButton();
  }

  function resetResultVideo() {
    dom.resultVideo.pause();
    dom.resultVideo.removeAttribute("src");
    dom.resultVideo.onloadedmetadata = null;
    dom.resultVideo.load();
    syncEmptyState();
    syncPlaybackButton();
  }

  function handlePlaybackStateChange() {
    syncPlaybackButton();
  }

  return {
    renderOverlayPreview,
    syncOrientationUi,
    showResult,
    togglePlayback,
    resetResultVideo,
    handlePlaybackStateChange,
    syncPlaybackButton,
    syncEmptyState
  };
}
