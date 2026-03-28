import { APP_STRINGS, APP_THRESHOLDS } from "../constants/appConfig.js";

const GALLERY_PAGE_SIZE = 18;
const GALLERY_METADATA_CONCURRENCY = 2;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatGalleryStatus(count, visibleCount) {
  if (count === 0) {
    return "0 saved videos";
  }

  if (visibleCount >= count) {
    return count === 1 ? "1 saved video" : `${count} saved videos`;
  }

  return `Showing ${visibleCount} of ${count} saved videos`;
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
    const modifiedDelta = (left.modifiedAt || 0) - (right.modifiedAt || 0);
    if (modifiedDelta !== 0) {
      return modifiedDelta;
    }

    return left.filename.localeCompare(right.filename, undefined, { numeric: true });
  });
}

export default function createGalleryScreen(dom, state, handlers) {
  let entries = [];
  let visibleCount = GALLERY_PAGE_SIZE;
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
    dom.galleryStatus.textContent = formatGalleryStatus(entries.length, renderedEntries.length);
    dom.galleryEmptyState.classList.toggle("hidden", entries.length > 0);

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
    entries = sortEntriesByOldest(await handlers.loadEntries());
    visibleCount = Math.min(entries.length, GALLERY_PAGE_SIZE);
    renderEntries();
  }

  async function openGalleryPanel() {
    dialogRect.width = APP_THRESHOLDS.dialogDefaultWidth;
    dialogRect.height = Math.max(APP_THRESHOLDS.dialogMinHeight, window.innerHeight - APP_THRESHOLDS.dialogEdgeMargin * 2);
    dialogRect.x = APP_THRESHOLDS.dialogEdgeMargin;
    dialogRect.y = APP_THRESHOLDS.dialogEdgeMargin;
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
    const entry = entries[index];
    if (!entry) {
      return;
    }

    if (actionElement.dataset.action === "open") {
      handlers.openEntry(entry);
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
      dialogRect.height = dialogStartRect.height + dy;
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


  return {
    setGalleryPanelOpen,
    openGalleryPanel,
    refreshGallery,
    startDialogInteraction,
    updateDialogInteraction,
    stopDialogInteraction,
    handleWindowResize
  };
}
