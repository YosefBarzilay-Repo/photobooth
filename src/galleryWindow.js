import { loadSavedRecordingsFromDirectory } from "./services/downloadService.js";
import { getDefaultRecordingsDirectory, isDesktopApp, openDesktopDirectory } from "./services/desktopService.js";
import { loadPersistedSettings } from "./services/settingsPersistence.js";
import { logger } from "./services/logger.js";

function getSaveDirectory() {
  const settings = loadPersistedSettings();
  return settings?.saveDirectoryPath || null;
}

async function openGalleryFolder() {
  if (!isDesktopApp()) {
    void logger.warn("Standalone gallery open folder requested outside desktop app.");
    return;
  }

  const directoryPath = getSaveDirectory() || await getDefaultRecordingsDirectory();
  void logger.audit("Standalone gallery open folder requested.", { directoryPath });
  await openDesktopDirectory(directoryPath);
  void logger.info("Standalone gallery folder opened.", { directoryPath });
}

async function loadGallery() {
  const galleryGrid = document.getElementById("galleryGrid");
  const emptyState = document.getElementById("galleryEmptyState");
  const saveDirectory = getSaveDirectory();
  void logger.debug("Standalone gallery loading entries.", { saveDirectory });
  const entries = await loadSavedRecordingsFromDirectory(saveDirectory);
  void logger.info("Standalone gallery loaded entries.", { count: entries.length, saveDirectory });

  galleryGrid.replaceChildren();
  emptyState.classList.toggle("hidden", entries.length > 0);
  galleryGrid.classList.toggle("hidden", entries.length === 0);

  entries.forEach((entry, index) => {
    const card = document.createElement("article");
    card.className = "gallery-card";

    const video = document.createElement("video");
    video.className = "gallery-video";
    video.src = entry.url;
    video.controls = true;
    video.preload = "metadata";
    video.playsInline = true;

    const footer = document.createElement("div");
    footer.className = "gallery-card-footer";

    const name = document.createElement("p");
    name.className = "gallery-card-name";
    name.textContent = entry.filename;

    const order = document.createElement("span");
    order.className = "gallery-card-index";
    order.textContent = `${index + 1} of ${entries.length}`;

    footer.append(name, order);
    card.append(video, footer);
    galleryGrid.appendChild(card);
  });
}

window.addEventListener("focus", () => {
  void logger.debug("Standalone gallery window focused. Refreshing entries.");
  void loadGallery();
});

document.getElementById("galleryRefreshButton")?.addEventListener("click", () => {
  void logger.audit("Standalone gallery refresh requested.");
  void loadGallery();
});

document.getElementById("galleryOpenFolderButton")?.addEventListener("click", () => {
  void openGalleryFolder().catch((error) => {
    void logger.exception("Standalone gallery failed to open folder.", error, {
      saveDirectory: getSaveDirectory()
    });
  });
});

void loadGallery();
