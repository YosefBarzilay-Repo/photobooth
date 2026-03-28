/**
 * @typedef {import("../types/dom.js").DomRefs} DomRefs
 */

function getRequiredElement(id) {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Missing required DOM element: #${id}`);
  }

  return element;
}

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
    snapButtonIcon: getRequiredElement("snapButtonIcon"),
    resultRetakeButton: getRequiredElement("resultRetakeButton"),
    anotherShotButton: getRequiredElement("anotherShotButton"),
    flashOverlay: getRequiredElement("flashOverlay"),
    countdownOverlay: getRequiredElement("countdownOverlay"),
    recordingTimer: getRequiredElement("recordingTimer"),
    errorOverlay: getRequiredElement("errorOverlay"),
    emptyCamera: getRequiredElement("emptyCamera"),
    operatorPanel: getRequiredElement("operatorPanel"),
    operatorCloseButton: getRequiredElement("operatorCloseButton"),
    frameTray: getRequiredElement("frameTray"),
    countdownInput: getRequiredElement("countdownInput"),
    countdownMinusButton: getRequiredElement("countdownMinusButton"),
    countdownPlusButton: getRequiredElement("countdownPlusButton"),
    logoUploadButton: getRequiredElement("logoUploadButton"),
    logoInput: getRequiredElement("logoInput"),
    saveFolderButton: getRequiredElement("saveFolderButton"),
    saveFolderLabel: getRequiredElement("saveFolderLabel"),
    textInput: getRequiredElement("textInput"),
    fontSelect: getRequiredElement("fontSelect"),
    resultFrame: getRequiredElement("resultFrame"),
    resultText: getRequiredElement("resultText"),
    operatorFrame: getRequiredElement("operatorFrame"),
    operatorText: getRequiredElement("operatorText")
  };
}