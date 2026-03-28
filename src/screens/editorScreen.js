import renderFrameMarkup from "../components/frameMarkup.js";
import { renderOverlayLayer } from "../components/overlayRenderer.js";

/**
 * @typedef {import("../types/app.js").AppState} AppState
 * @typedef {import("../types/dom.js").DomRefs} DomRefs
 */

/**
 * @param {DomRefs} dom
 * @param {AppState} state
 */
export default function createEditorScreen(dom, state) {
  function syncPlaybackButton() {
    const paused = dom.resultVideo.paused || dom.resultVideo.ended;
    dom.resultPlayIcon.textContent = paused ? "play_arrow" : "pause";
    dom.resultPlayButton.setAttribute("aria-label", paused ? "Play video" : "Pause video");
  }

  function renderOverlayPreview() {
    dom.cameraFrame.innerHTML = renderFrameMarkup(state.activeFrameId);
    dom.resultFrame.innerHTML = renderFrameMarkup(state.activeFrameId);
    renderOverlayLayer(dom.cameraText, state, { interactive: state.operatorPanelOpen && state.mode === "camera" });
    renderOverlayLayer(dom.resultText, state);
  }

  function showResult() {
    if (state.recordingUrl) {
      dom.resultVideo.src = state.recordingUrl;
      dom.resultVideo.currentTime = 0;
      dom.resultVideo.pause();
      dom.resultVideo.style.transform = "none";
      syncPlaybackButton();
    }

    state.mode = "editor";
    renderOverlayPreview();
  }

  function togglePlayback() {
    if (!state.recordingUrl) {
      return;
    }

    if (dom.resultVideo.paused || dom.resultVideo.ended) {
      if (dom.resultVideo.ended) {
        dom.resultVideo.currentTime = 0;
      }
      dom.resultVideo.play().catch((error) => {
        console.warn("Result video playback did not start.", error);
      });
    } else {
      dom.resultVideo.pause();
    }

    syncPlaybackButton();
  }

  function resetResultVideo() {
    dom.resultVideo.pause();
    dom.resultVideo.removeAttribute("src");
    dom.resultVideo.load();
    syncPlaybackButton();
  }

  function handlePlaybackStateChange() {
    syncPlaybackButton();
  }

  return {
    renderOverlayPreview,
    showResult,
    togglePlayback,
    resetResultVideo,
    handlePlaybackStateChange,
    syncPlaybackButton
  };
}
