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
    resultVideo: getRequiredElement("resultVideo"),
    console: getRequiredElement("console"),
    operatorAccessTrigger: getRequiredElement("operatorAccessTrigger"),
    recordControl: getRequiredElement("recordControl"),
    snapButton: getRequiredElement("snapButton"),
    snapButtonIcon: getRequiredElement("snapButtonIcon"),
    resultPlayButton: getRequiredElement("resultPlayButton"),
    resultPlayIcon: getRequiredElement("resultPlayIcon"),
    resultNewButton: getRequiredElement("resultNewButton"),
    flashOverlay: getRequiredElement("flashOverlay"),
    countdownOverlay: getRequiredElement("countdownOverlay"),
    recordingTimer: getRequiredElement("recordingTimer"),
    errorOverlay: getRequiredElement("errorOverlay"),
    emptyCamera: getRequiredElement("emptyCamera"),
    operatorPanel: getRequiredElement("operatorPanel"),
    operatorDialog: getRequiredElement("operatorDialog"),
    operatorDialogHeader: getRequiredElement("operatorDialogHeader"),
    operatorDialogResize: getRequiredElement("operatorDialogResize"),
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
    cameraFrame: getRequiredElement("cameraFrame"),
    cameraText: getRequiredElement("cameraText"),
    resultFrame: getRequiredElement("resultFrame"),
    resultText: getRequiredElement("resultText")
  };
}
