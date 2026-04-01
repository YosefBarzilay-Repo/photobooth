import { APP_STRINGS, APP_THRESHOLDS } from "../constants/appConfig.js";

const GALLERY_PAGE_SIZE = 18;
const GALLERY_METADATA_CONCURRENCY = 2;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatVideoStatus(count, visibleCount) {
  if (count === 0) {
    return "0 saved videos";
  }

  if (visibleCount >= count) {
    return count === 1 ? "1 saved video" : `${count} saved videos`;
  }

  return `Showing ${visibleCount} of ${count} saved videos`;
}

function formatProjectStatus(count) {
  if (count === 0) {
    return "0 projects";
  }

  return count === 1 ? "1 project" : `${count} projects`;
}

function formatFolderSize(sizeBytes) {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return "0.00 GB";
  }

  return `${(sizeBytes / (1024 ** 3)).toFixed(2)} GB`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "Unknown length";
  }

  const totalSeconds = Math.round(seconds);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const remainingSeconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function loadMetadata(url) {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    let settled = false;
    const timeoutId = window.setTimeout(() => finish({ thumbnail: "", duration: NaN }), 5000);

    function finish(payload) {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeoutId);
      video.pause();
      video.removeAttribute("src");
      video.load();
      resolve(payload);
    }

    function tryCaptureFrame() {
      const duration = video.duration;

      if (!(Number.isFinite(video.videoWidth) && video.videoWidth > 0 && Number.isFinite(video.videoHeight) && video.videoHeight > 0)) {
        finish({ thumbnail: "", duration });
        return;
      }

      try {
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 180;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          finish({ thumbnail: "", duration });
          return;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        finish({ thumbnail: canvas.toDataURL("image/jpeg", 0.84), duration });
      } catch {
        finish({ thumbnail: "", duration });
      }
    }

    function seekForThumbnail() {
      const duration = video.duration;
      const targetTime = Number.isFinite(duration) && duration > 0.5 ? Math.min(2, Math.max(0.8, duration * 0.35)) : 0;

      if (targetTime <= 0) {
        tryCaptureFrame();
        return;
      }

      const seekTimeoutId = window.setTimeout(() => tryCaptureFrame(), 1500);
      video.addEventListener("seeked", () => {
        window.clearTimeout(seekTimeoutId);
        tryCaptureFrame();
      }, { once: true });

      try {
        video.currentTime = targetTime;
      } catch {
        window.clearTimeout(seekTimeoutId);
        tryCaptureFrame();
      }
    }

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.addEventListener("loadeddata", seekForThumbnail, { once: true });
    video.addEventListener("loadedmetadata", () => {
      if (video.readyState >= 2) {
        seekForThumbnail();
      }
    }, { once: true });
    video.addEventListener("error", () => {
      finish({ thumbnail: "", duration: NaN });
    }, { once: true });

    video.src = url;
    video.load();
  });
}

function getViewportLimits() {
  return {
    minX: APP_THRESHOLDS.dialogEdgeMargin,
    minY: APP_THRESHOLDS.dialogEdgeMargin,
    maxX: Math.max(APP_THRESHOLDS.dialogEdgeMargin, window.innerWidth - APP_THRESHOLDS.dialogEdgeMargin),
    maxY: Math.max(APP_THRESHOLDS.dialogEdgeMargin, window.innerHeight - APP_THRESHOLDS.dialogEdgeMargin)
  };
}

function sortEntriesByOldest(entries) {
  return [...entries].sort((left, right) => {
    const modifiedDelta = (right.modifiedAt || 0) - (left.modifiedAt || 0);
    if (modifiedDelta !== 0) {
      return modifiedDelta;
    }

    return right.filename.localeCompare(left.filename, undefined, { numeric: true });
  });
}

export default function createGalleryScreen(dom, state, handlers) {
  let entries = [];
  let projects = [];
  let visibleCount = GALLERY_PAGE_SIZE;
  let isLoading = false;
  const metadataCache = new Map();
  const metadataPromiseCache = new Map();
  let activeMetadataLoads = 0;
  const metadataQueue = [];
  let dialogRect = {
    x: APP_THRESHOLDS.dialogEdgeMargin,
    y: APP_THRESHOLDS.dialogEdgeMargin,
    width: APP_THRESHOLDS.dialogDefaultWidth,
    height: APP_THRESHOLDS.dialogDefaultHeight
  };
  let dialogPointerId = null;
  let dialogInteraction = null;
  let dialogStartPointer = null;
  let dialogStartRect = null;

  function syncDialogRect() {
    const limits = getViewportLimits();
    const maxWidth = Math.max(APP_THRESHOLDS.dialogMinWidth, window.innerWidth - APP_THRESHOLDS.dialogEdgeMargin * 2);
    const maxHeight = Math.max(APP_THRESHOLDS.dialogMinHeight, window.innerHeight - APP_THRESHOLDS.dialogEdgeMargin * 2);

    dialogRect.width = clamp(dialogRect.width, APP_THRESHOLDS.dialogMinWidth, maxWidth);
    dialogRect.height = clamp(dialogRect.height, APP_THRESHOLDS.dialogMinHeight, maxHeight);
    dialogRect.x = clamp(dialogRect.x, limits.minX, Math.max(limits.minX, window.innerWidth - dialogRect.width - APP_THRESHOLDS.dialogEdgeMargin));
    dialogRect.y = clamp(dialogRect.y, limits.minY, Math.max(limits.minY, window.innerHeight - dialogRect.height - APP_THRESHOLDS.dialogEdgeMargin));

    dom.galleryDialog.style.left = `${dialogRect.x}px`;
    dom.galleryDialog.style.top = `${dialogRect.y}px`;
    dom.galleryDialog.style.width = `${dialogRect.width}px`;
    dom.galleryDialog.style.height = `${dialogRect.height}px`;
  }

  function setGalleryPanelOpen(isOpen) {
    state.galleryPanelOpen = isOpen;
    dom.galleryPanel.classList.toggle("hidden", !isOpen);
    if (isOpen) {
      syncDialogRect();
    }
  }

  function syncViewUi() {
    const isVideosView = state.galleryView === "videos";
    dom.galleryTabVideos.classList.toggle("is-active", isVideosView);
    dom.galleryTabVideos.setAttribute("aria-selected", String(isVideosView));
    dom.galleryTabProjects.classList.toggle("is-active", !isVideosView);
    dom.galleryTabProjects.setAttribute("aria-selected", String(!isVideosView));
    dom.galleryOpenFolderLabel.textContent = isVideosView ? "Open Folder" : "Open Projects Folder";
    dom.gallerySlideshowButton.classList.toggle("hidden", isVideosView);
    dom.gallerySlideshowButton.disabled = isVideosView || !state.saveDirectoryPath;
    dom.galleryFooterLabel.textContent = isVideosView
      ? `Current project: ${state.saveDirectoryName || APP_STRINGS.saveFolderDefault}`
      : `Current project: ${state.saveDirectoryName || APP_STRINGS.saveFolderDefault}`;
  }

  function renderLoadingState(message) {
    dom.galleryList.replaceChildren();
    dom.galleryStatus.textContent = state.galleryView === "projects" ? "Loading projects..." : "Loading videos...";
    dom.galleryEmptyState.classList.remove("hidden");
    dom.galleryEmptyState.classList.add("is-loading");
    dom.galleryEmptyIcon.textContent = "progress_activity";
    dom.galleryEmptyText.textContent = message;
  }

  function pumpMetadataQueue() {
    while (activeMetadataLoads < GALLERY_METADATA_CONCURRENCY && metadataQueue.length > 0) {
      const nextTask = metadataQueue.shift();
      if (!nextTask) {
        return;
      }

      activeMetadataLoads += 1;
      nextTask().finally(() => {
        activeMetadataLoads -= 1;
        pumpMetadataQueue();
      });
    }
  }

  function queueMetadataLoad(entry, updateUi) {
    const metadataKey = entry.path || entry.url;
    const cachedMetadata = metadataCache.get(metadataKey);
    if (cachedMetadata) {
      updateUi(cachedMetadata);
      return;
    }

    const cachedPromise = metadataPromiseCache.get(metadataKey);
    if (cachedPromise) {
      void cachedPromise.then(updateUi);
      return;
    }

    const promise = new Promise((resolve) => {
      metadataQueue.push(async () => {
        await handlers.ensureEntryReady(entry);
        const metadata = await loadMetadata(entry.url);
        metadataCache.set(metadataKey, metadata);
        metadataPromiseCache.delete(metadataKey);
        resolve(metadata);
      });
      pumpMetadataQueue();
    });

    metadataPromiseCache.set(metadataKey, promise);
    void promise.then(updateUi);
  }

  function renderEntries(options = {}) {
    const { preserveScroll = false, previousScrollTop = 0 } = options;
    const renderedEntries = entries.slice(0, visibleCount);
    dom.galleryList.replaceChildren();
    dom.galleryStatus.textContent = formatVideoStatus(entries.length, renderedEntries.length);
    dom.galleryEmptyState.classList.remove("is-loading");
    dom.galleryEmptyState.classList.toggle("hidden", entries.length > 0);
    dom.galleryEmptyIcon.textContent = "video_library";
    dom.galleryEmptyText.textContent = "No saved videos yet. Save a recording to show it here.";

    renderedEntries.forEach((entry, index) => {
      const card = document.createElement("article");
      card.className = "gallery-row";

      const openButton = document.createElement("button");
      openButton.type = "button";
      openButton.className = "gallery-row-open";
      openButton.dataset.action = "open";
      openButton.dataset.index = String(index);

      const thumb = document.createElement("div");
      thumb.className = "gallery-row-thumb";

      const thumbImage = document.createElement("img");
      thumbImage.className = "gallery-row-thumb-image hidden";
      thumbImage.alt = `${entry.filename} thumbnail`;
      thumbImage.loading = "lazy";

      const thumbFallback = document.createElement("div");
      thumbFallback.className = "gallery-row-thumb-fallback";
      thumbFallback.innerHTML = '<span class="material-symbols-outlined">movie</span>';

      thumb.append(thumbImage, thumbFallback);

      const details = document.createElement("div");
      details.className = "gallery-row-details";

      const name = document.createElement("p");
      name.className = "gallery-row-name";
      name.textContent = entry.filename;

      const meta = document.createElement("p");
      meta.className = "gallery-row-meta";
      meta.textContent = "Loading video details...";

      details.append(name, meta);
      openButton.append(thumb, details);

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "gallery-delete-button";
      deleteButton.dataset.action = "delete";
      deleteButton.dataset.index = String(index);
      deleteButton.innerHTML = '<span class="material-symbols-outlined">delete</span><span>Delete</span>';

      card.append(openButton, deleteButton);
      dom.galleryList.appendChild(card);

      queueMetadataLoad(entry, (metadata) => {
        if (!card.isConnected) {
          return;
        }

        meta.textContent = `Length ${formatDuration(metadata.duration)}`;
        if (metadata.thumbnail) {
          thumbImage.src = metadata.thumbnail;
          thumbImage.classList.remove("hidden");
          thumbFallback.classList.add("hidden");
        }
      });
    });

    if (visibleCount < entries.length) {
      const loadMoreButton = document.createElement("button");
      loadMoreButton.type = "button";
      loadMoreButton.className = "gallery-load-more";
      loadMoreButton.textContent = "Load More";
      loadMoreButton.addEventListener("click", (event) => {
        event.preventDefault();
        loadMoreButton.blur();
        const scrollTop = dom.galleryList.scrollTop;
        visibleCount = Math.min(entries.length, visibleCount + GALLERY_PAGE_SIZE);
        renderEntries({ preserveScroll: true, previousScrollTop: scrollTop });
      }, { once: true });
      dom.galleryList.appendChild(loadMoreButton);
    }

    if (preserveScroll) {
      window.requestAnimationFrame(() => {
        dom.galleryList.scrollTop = previousScrollTop;
        window.requestAnimationFrame(() => {
          dom.galleryList.scrollTop = previousScrollTop;
        });
      });
    }
  }

  async function refreshGallery() {
    isLoading = true;
    renderLoadingState(state.galleryView === "projects" ? "Loading project folders..." : "Loading saved videos...");
    await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));

    if (state.galleryView === "projects") {
      try {
        void console.time?.("gallery-projects-load");
        projects = await handlers.loadProjects();
        renderProjects();
      } finally {
        void console.timeEnd?.("gallery-projects-load");
        isLoading = false;
      }
      return;
    }

    try {
      void console.time?.("gallery-videos-load");
      entries = sortEntriesByOldest(await handlers.loadEntries());
      visibleCount = Math.min(entries.length, GALLERY_PAGE_SIZE);
      renderEntries();
    } finally {
      void console.timeEnd?.("gallery-videos-load");
      isLoading = false;
    }
  }

  function renderProjects() {
    dom.galleryList.replaceChildren();
    dom.galleryStatus.textContent = formatProjectStatus(projects.length);
    dom.galleryEmptyState.classList.remove("is-loading");
    dom.galleryEmptyState.classList.toggle("hidden", projects.length > 0);
    dom.galleryEmptyIcon.textContent = "folder_copy";
    dom.galleryEmptyText.textContent = "No projects found yet. Create one to organize recordings.";

    projects.forEach((project, index) => {
      const card = document.createElement("article");
      card.className = "gallery-row gallery-project-row";

      const thumb = document.createElement("div");
      thumb.className = "gallery-row-thumb gallery-project-thumb";
      thumb.innerHTML = '<div class="gallery-row-thumb-fallback"><span class="material-symbols-outlined">folder</span></div>';

      const details = document.createElement("div");
      details.className = "gallery-row-details";

      const heading = document.createElement("div");
      heading.className = "gallery-project-heading";

      const name = document.createElement("p");
      name.className = "gallery-row-name";
      name.textContent = project.name;

      const size = document.createElement("p");
      size.className = "gallery-project-size";
      size.textContent = formatFolderSize(project.totalSizeBytes || 0);

      const meta = document.createElement("p");
      meta.className = "gallery-row-meta gallery-project-meta";
      meta.textContent = `${project.videoCount || 0} videos`;

      const path = document.createElement("p");
      path.className = "gallery-row-path";
      path.textContent = project.path;

      const actions = document.createElement("div");
      actions.className = "gallery-project-actions";

      const chooseButton = document.createElement("button");
      chooseButton.type = "button";
      chooseButton.className = "gallery-delete-button";
      chooseButton.dataset.action = "choose-project";
      chooseButton.dataset.index = String(index);
      chooseButton.innerHTML = '<span class="material-symbols-outlined">check_circle</span><span>Choose Project</span>';

      const openFolderButton = document.createElement("button");
      openFolderButton.type = "button";
      openFolderButton.className = "gallery-delete-button";
      openFolderButton.dataset.action = "open-project-folder";
      openFolderButton.dataset.index = String(index);
      openFolderButton.innerHTML = '<span class="material-symbols-outlined">folder_open</span><span>Open Folder</span>';

      const renameButton = document.createElement("button");
      renameButton.type = "button";
      renameButton.className = "gallery-delete-button";
      renameButton.dataset.action = "rename-project";
      renameButton.dataset.index = String(index);
      renameButton.innerHTML = '<span class="material-symbols-outlined">edit</span><span>Rename</span>';

      const metadataButton = document.createElement("button");
      metadataButton.type = "button";
      metadataButton.className = "gallery-delete-button";
      metadataButton.dataset.action = "project-booking";
      metadataButton.dataset.index = String(index);
      metadataButton.innerHTML = '<span class="material-symbols-outlined">badge</span><span>Booking</span>';

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "gallery-delete-button";
      deleteButton.dataset.action = "delete-project";
      deleteButton.dataset.index = String(index);
      deleteButton.innerHTML = '<span class="material-symbols-outlined">delete</span><span>Delete</span>';

      if (state.saveDirectoryPath && project.path.toLowerCase() === state.saveDirectoryPath.toLowerCase()) {
        chooseButton.disabled = true;
        chooseButton.innerHTML = '<span class="material-symbols-outlined">task_alt</span><span>Current Project</span>';
      }

      heading.append(name, size);
      actions.append(chooseButton, openFolderButton, renameButton, metadataButton, deleteButton);
      details.append(heading, meta, path, actions);
      card.append(thumb, details);
      dom.galleryList.appendChild(card);
    });
  }

  async function switchView(view) {
    state.galleryView = view === "projects" ? "projects" : "videos";
    syncViewUi();
    await refreshGallery();
  }

  async function openGalleryPanel(initialView = "videos") {
    dialogRect.width = APP_THRESHOLDS.dialogDefaultWidth;
    dialogRect.height = Math.max(APP_THRESHOLDS.dialogMinHeight, window.innerHeight - APP_THRESHOLDS.dialogEdgeMargin * 2);
    dialogRect.x = APP_THRESHOLDS.dialogEdgeMargin;
    dialogRect.y = APP_THRESHOLDS.dialogEdgeMargin;
    state.galleryView = initialView === "projects" ? "projects" : "videos";
    syncViewUi();
    await refreshGallery();
    setGalleryPanelOpen(true);
  }

  async function handleListClick(event) {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) {
      return;
    }

    const actionElement = target.closest("[data-action]");
    if (!(actionElement instanceof HTMLElement)) {
      return;
    }

    const index = Number.parseInt(actionElement.dataset.index || "", 10);
    if (state.galleryView === "projects") {
      const project = projects[index];
      if (!project) {
        return;
      }

      if (actionElement.dataset.action === "choose-project") {
        await handlers.openProject(project);
        await switchView("videos");
        return;
      }

      if (actionElement.dataset.action === "open-project-folder") {
        await handlers.openProjectFolder(project);
        return;
      }

      if (actionElement.dataset.action === "rename-project") {
        await handlers.renameProject(project);
        await refreshGallery();
        return;
      }

      if (actionElement.dataset.action === "project-booking") {
        await handlers.openProjectMetadata(project);
        return;
      }

      if (actionElement.dataset.action === "delete-project") {
        await handlers.deleteProject(project);
        await refreshGallery();
      }

      return;
    }

    const entry = entries[index];
    if (!entry) {
      return;
    }

    if (actionElement.dataset.action === "open") {
      await handlers.openEntry(entry);
      return;
    }

    if (actionElement.dataset.action === "delete") {
      await handlers.deleteEntry(entry);
      await refreshGallery();
    }
  }

  function startDialogInteraction(event) {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) {
      return;
    }

    if (isLoading) {
      return;
    }

    if (target.closest("button") && !target.closest("#galleryDialogResize")) {
      return;
    }

    if (target.closest("#galleryDialogHeader")) {
      dialogInteraction = "move";
    } else if (target.closest("#galleryDialogResize")) {
      dialogInteraction = "resize";
    } else {
      return;
    }

    dialogPointerId = event.pointerId;
    dialogStartPointer = { x: event.clientX, y: event.clientY };
    dialogStartRect = { ...dialogRect };
    event.preventDefault();
    dom.galleryDialog.setPointerCapture?.(event.pointerId);
  }

  function updateDialogInteraction(event) {
    if (!dialogInteraction || dialogPointerId !== event.pointerId || !dialogStartPointer || !dialogStartRect) {
      return;
    }

    const dx = event.clientX - dialogStartPointer.x;
    const dy = event.clientY - dialogStartPointer.y;

    if (dialogInteraction === "move") {
      dialogRect.x = dialogStartRect.x + dx;
      dialogRect.y = dialogStartRect.y + dy;
    } else {
      dialogRect.width = dialogStartRect.width + dx;
    }

    syncDialogRect();
  }

  function stopDialogInteraction(event) {
    if (!dialogInteraction) {
      return;
    }

    if (event && dialogPointerId === event.pointerId) {
      dom.galleryDialog.releasePointerCapture?.(event.pointerId);
    }

    dialogInteraction = null;
    dialogPointerId = null;
    dialogStartPointer = null;
    dialogStartRect = null;
  }

  function handleWindowResize() {
    if (state.galleryPanelOpen) {
      syncDialogRect();
    }
  }

  dom.galleryList.addEventListener("click", (event) => {
    void handleListClick(event);
  });

  dom.gallerySlideshowButton.addEventListener("click", () => {
    void handlers.startProjectSlideshow();
  });


  return {
    setGalleryPanelOpen,
    openGalleryPanel,
    switchView,
    refreshGallery,
    startDialogInteraction,
    updateDialogInteraction,
    stopDialogInteraction,
    handleWindowResize
  };
}
