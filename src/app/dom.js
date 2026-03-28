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
    operatorPreviewSurface: getRequiredElement("operatorPreviewSurface"),
    resultVideo: getRequiredElement("resultVideo"),
    operatorAccessTrigger: getRequiredElement("operatorAccessTrigger"),
    snapButton: getRequiredElement("snapButton"),
    resultRetakeButton: getRequiredElement("resultRetakeButton"),
    anotherShotButton: getRequiredElement("anotherShotButton"),
    flashOverlay: getRequiredElement("flashOverlay"),
    countdownOverlay: getRequiredElement("countdownOverlay"),
    errorOverlay: getRequiredElement("errorOverlay"),
    emptyCamera: getRequiredElement("emptyCamera"),
    operatorPanel: getRequiredElement("operatorPanel"),
    operatorCloseButton: getRequiredElement("operatorCloseButton"),
    frameTray: getRequiredElement("frameTray"),
    countdownInput: getRequiredElement("countdownInput"),
    countdownMinusButton: getRequiredElement("countdownMinusButton"),
    countdownPlusButton: getRequiredElement("countdownPlusButton"),
    durationSelect: getRequiredElement("durationSelect"),
    logoUploadButton: getRequiredElement("logoUploadButton"),
    logoInput: getRequiredElement("logoInput"),
    textInput: getRequiredElement("textInput"),
    fontSelect: getRequiredElement("fontSelect"),
    colorInput: getRequiredElement("colorInput"),
    sizeInput: getRequiredElement("sizeInput"),
    resultFrame: getRequiredElement("resultFrame"),
    resultText: getRequiredElement("resultText"),
    operatorFrame: getRequiredElement("operatorFrame"),
    operatorText: getRequiredElement("operatorText"),
    recordingProgress: getRequiredElement("recordingProgress")
  };
}