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
    openPreviewButton: getRequiredElement("openPreviewButton"),
    recordControl: getRequiredElement("recordControl"),
    snapButton: getRequiredElement("snapButton"),
    snapButtonIcon: getRequiredElement("snapButtonIcon"),
    snapButtonLabel: getRequiredElement("snapButtonLabel"),
    resultPlayButton: getRequiredElement("resultPlayButton"),
    resultSaveButton: getRequiredElement("resultSaveButton"),
    resultPlayIcon: getRequiredElement("resultPlayIcon"),
    resultNewButton: getRequiredElement("resultNewButton"),
    resultSlideshowButton: getRequiredElement("resultSlideshowButton"),
    resultSettingsButton: getRequiredElement("resultSettingsButton"),
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
    operatorCloseAppButton: getRequiredElement("operatorCloseAppButton"),
    appVersionLabel: getRequiredElement("appVersionLabel"),
    appDialogOverlay: getRequiredElement("appDialogOverlay"),
    appDialogTitle: getRequiredElement("appDialogTitle"),
    appDialogMessage: getRequiredElement("appDialogMessage"),
    appDialogCloseButton: getRequiredElement("appDialogCloseButton"),
    frameTray: getRequiredElement("frameTray"),
    countdownInput: getRequiredElement("countdownInput"),
    countdownMinusButton: getRequiredElement("countdownMinusButton"),
    countdownPlusButton: getRequiredElement("countdownPlusButton"),
    slideshowIdleInput: getRequiredElement("slideshowIdleInput"),
    slideshowIdleMinusButton: getRequiredElement("slideshowIdleMinusButton"),
    slideshowIdlePlusButton: getRequiredElement("slideshowIdlePlusButton"),
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
