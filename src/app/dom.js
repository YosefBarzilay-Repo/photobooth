/**
 * @typedef {import("../types/dom.js").DomRefs} DomRefs
 */

/**
 * @template {Element} T
 * @param {string} id
 * @returns {T}
 */
function getRequiredElement(id) {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Missing required DOM element: #${id}`);
  }

  return /** @type {T} */ (element);
}

/**
 * @returns {DomRefs}
 */
export default function createDomRefs() {
  return {
    cameraStage: getRequiredElement("cameraStage"),
    editorStage: getRequiredElement("editorStage"),
    cameraPreview: getRequiredElement("cameraPreview"),
    operatorPreviewVideo: getRequiredElement("operatorPreviewVideo"),
    resultVideo: getRequiredElement("resultVideo"),
    operatorAccessTrigger: getRequiredElement("operatorAccessTrigger"),
    snapButton: getRequiredElement("snapButton"),
    resultRetakeButton: getRequiredElement("resultRetakeButton"),
    anotherShotButton: getRequiredElement("anotherShotButton"),
    downloadButton: getRequiredElement("downloadButton"),
    flashOverlay: getRequiredElement("flashOverlay"),
    countdownOverlay: getRequiredElement("countdownOverlay"),
    errorOverlay: getRequiredElement("errorOverlay"),
    emptyCamera: getRequiredElement("emptyCamera"),
    operatorPanel: getRequiredElement("operatorPanel"),
    operatorCloseButton: getRequiredElement("operatorCloseButton"),
    frameTray: getRequiredElement("frameTray"),
    countdownSelect: getRequiredElement("countdownSelect"),
    durationSelect: getRequiredElement("durationSelect"),
    cameraEffectSelect: getRequiredElement("cameraEffectSelect"),
    cameraEffectSpeedInput: getRequiredElement("cameraEffectSpeedInput"),
    setZoomDirectionButton: getRequiredElement("setZoomDirectionButton"),
    effectHint: getRequiredElement("effectHint"),
    textInput: getRequiredElement("textInput"),
    fontSelect: getRequiredElement("fontSelect"),
    colorInput: getRequiredElement("colorInput"),
    sizeInput: getRequiredElement("sizeInput"),
    placeHint: getRequiredElement("placeHint"),
    resultFrame: getRequiredElement("resultFrame"),
    resultText: getRequiredElement("resultText"),
    operatorFrame: getRequiredElement("operatorFrame"),
    operatorText: getRequiredElement("operatorText"),
    recordingProgress: getRequiredElement("recordingProgress"),
    kenBurnsToggle: getRequiredElement("kenBurnsToggle"),
    kenBurnsPreview: getRequiredElement("kenBurnsPreview")
  };
}
