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
    resultEmptyState: getRequiredElement("resultEmptyState"),
    console: getRequiredElement("console"),
    openPreviewButton: getRequiredElement("openPreviewButton"),
    recordControl: getRequiredElement("recordControl"),
    snapButton: getRequiredElement("snapButton"),
    snapButtonIcon: getRequiredElement("snapButtonIcon"),
    snapButtonLabel: getRequiredElement("snapButtonLabel"),
    resultNewButton: getRequiredElement("resultNewButton"),
    previewSeparatorPrimary: getRequiredElement("previewSeparatorPrimary"),
    resultSaveButton: getRequiredElement("resultSaveButton"),
    resultSaveIcon: getRequiredElement("resultSaveIcon"),
    resultSaveLabel: getRequiredElement("resultSaveLabel"),
    resultPlayButton: getRequiredElement("resultPlayButton"),
    resultGalleryButton: getRequiredElement("resultGalleryButton"),
    previewSeparatorSecondary: getRequiredElement("previewSeparatorSecondary"),
    resultProjectsButton: getRequiredElement("resultProjectsButton"),
    previewSeparatorTertiary: getRequiredElement("previewSeparatorTertiary"),
    resultSlideshowButton: getRequiredElement("resultSlideshowButton"),
    previewSeparatorQuaternary: getRequiredElement("previewSeparatorQuaternary"),
    resultSettingsButton: getRequiredElement("resultSettingsButton"),
    resultPlayIcon: getRequiredElement("resultPlayIcon"),
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
    galleryPanel: getRequiredElement("galleryPanel"),
    galleryDialog: getRequiredElement("galleryDialog"),
    galleryDialogHeader: getRequiredElement("galleryDialogHeader"),
    galleryDialogResize: getRequiredElement("galleryDialogResize"),
    galleryCloseButton: getRequiredElement("galleryCloseButton"),
    galleryStatus: getRequiredElement("galleryStatus"),
    galleryTabVideos: getRequiredElement("galleryTabVideos"),
    galleryTabProjects: getRequiredElement("galleryTabProjects"),
    galleryList: getRequiredElement("galleryList"),
    galleryEmptyState: getRequiredElement("galleryEmptyState"),
    galleryEmptyIcon: getRequiredElement("galleryEmptyIcon"),
    galleryEmptyText: getRequiredElement("galleryEmptyText"),
    galleryFooterLabel: getRequiredElement("galleryFooterLabel"),
    galleryOpenFolderButton: getRequiredElement("galleryOpenFolderButton"),
    launchOverlay: getRequiredElement("launchOverlay"),
    projectDialogOverlay: getRequiredElement("projectDialogOverlay"),
    projectDialogTitle: getRequiredElement("projectDialogTitle"),
    projectDialogMessage: getRequiredElement("projectDialogMessage"),
    projectNameInput: getRequiredElement("projectNameInput"),
    projectDialogError: getRequiredElement("projectDialogError"),
    projectContinueButton: getRequiredElement("projectContinueButton"),
    projectCreateButton: getRequiredElement("projectCreateButton"),
    appDialogOverlay: getRequiredElement("appDialogOverlay"),
    appDialogTitle: getRequiredElement("appDialogTitle"),
    appDialogMessage: getRequiredElement("appDialogMessage"),
    appDialogCloseButton: getRequiredElement("appDialogCloseButton"),
    appDialogActions: getRequiredElement("appDialogActions"),
    appDialogCancelButton: getRequiredElement("appDialogCancelButton"),
    appDialogConfirmButton: getRequiredElement("appDialogConfirmButton"),
    frameTray: getRequiredElement("frameTray"),
    countdownInput: getRequiredElement("countdownInput"),
    countdownMinusButton: getRequiredElement("countdownMinusButton"),
    countdownPlusButton: getRequiredElement("countdownPlusButton"),
    cameraInputSelect: getRequiredElement("cameraInputSelect"),
    audioInputSelect: getRequiredElement("audioInputSelect"),
    logoUploadButton: getRequiredElement("logoUploadButton"),
    logoInput: getRequiredElement("logoInput"),
    saveFolderButton: getRequiredElement("saveFolderButton"),
    textInput: getRequiredElement("textInput"),
    fontSelect: getRequiredElement("fontSelect"),
    cameraFrame: getRequiredElement("cameraFrame"),
    cameraText: getRequiredElement("cameraText"),
    resultFrame: getRequiredElement("resultFrame"),
    resultText: getRequiredElement("resultText")
  };
}

