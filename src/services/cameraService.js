import { APP_STRINGS, APP_THRESHOLDS, CAMERA_CONFIG, DISABLED_AUDIO_INPUT_ID } from "../constants/appConfig.js";
import { logger } from "./logger.js";

function buildVideoConstraints(videoInputId = "") {
  const baseVideo = {
    ...CAMERA_CONFIG.video
  };

  if (!videoInputId) {
    return baseVideo;
  }

  return {
    ...baseVideo,
    deviceId: { exact: videoInputId }
  };
}

function buildAudioConstraints(audioInputId = "") {
  if (audioInputId === DISABLED_AUDIO_INPUT_ID) {
    return false;
  }

  const baseAudio = {
    ...CAMERA_CONFIG.audio
  };

  if (!audioInputId) {
    return baseAudio;
  }

  return {
    ...baseAudio,
    deviceId: { exact: audioInputId }
  };
}

function mapCameraError(error) {
  const errorName = error instanceof Error ? error.name : "";

  switch (errorName) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return APP_STRINGS.cameraAccessDenied;
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
      return APP_STRINGS.noMediaDevices;
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return APP_STRINGS.previewLoadFailed;
    default:
      return APP_STRINGS.cameraAccessDenied;
  }
}

async function requestStreamWithConstraints(videoInputId = "", audioInputId = "") {
  void logger.debug("Requesting media stream.", {
    videoInputId: videoInputId || "default",
    audioInputId: audioInputId || "default"
  });
  return navigator.mediaDevices.getUserMedia({
    video: buildVideoConstraints(videoInputId),
    audio: buildAudioConstraints(audioInputId)
  });
}

/**
 * Resolves a user-facing camera error message.
 *
 * @param {unknown} error
 * @returns {string}
 */
export function getCameraErrorMessage(error) {
  return mapCameraError(error);
}

/**
 * Waits for the preview video element to become playable.
 *
 * @param {HTMLVideoElement} video
 * @param {number} [timeoutMs=APP_THRESHOLDS.videoReadyTimeoutMs]
 * @returns {Promise<void>}
 */
export function waitForVideoReady(video, timeoutMs = APP_THRESHOLDS.videoReadyTimeoutMs) {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      resolve();
      return;
    }

    let settled = false;

    const cleanup = () => {
      video.removeEventListener("loadedmetadata", onReady);
      video.removeEventListener("canplay", onReady);
      video.removeEventListener("error", onError);
      window.clearTimeout(timer);
    };

    const finish = (callback) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      callback();
    };

    const onReady = () => finish(resolve);
    const onError = () => finish(() => reject(new Error(APP_STRINGS.previewLoadFailed)));
    const timer = window.setTimeout(() => {
      finish(() => reject(new Error(APP_STRINGS.previewLoadTimeout)));
    }, timeoutMs);

    video.addEventListener("loadedmetadata", onReady);
    video.addEventListener("canplay", onReady);
    video.addEventListener("error", onError);
  });
}

/**
 * Stops an active camera stream and detaches it from preview videos.
 *
 * @param {MediaStream | null | undefined} stream
 * @param {HTMLVideoElement[]} videos
 * @returns {void}
 */
export function stopCameraStream(stream, videos) {
  if (stream) {
    void logger.debug("Stopping active camera stream.", { trackCount: stream.getTracks().length });
    stream.getTracks().forEach((track) => {
      track.stop();
    });
  }

  videos.forEach((video) => {
    video.srcObject = null;
  });
}

/**
 * Starts the shared camera stream and attaches it to preview videos.
 *
 * @param {HTMLVideoElement[]} videos
 * @param {{ videoInputId?: string, audioInputId?: string }} [options={}]
 * @returns {Promise<MediaStream>}
 */
export async function startCameraStream(videos, options = {}) {
  if (!navigator.mediaDevices?.getUserMedia) {
    void logger.error("Camera start failed because getUserMedia is unavailable.");
    throw new Error(APP_STRINGS.cameraUnsupported);
  }

  if (!window.isSecureContext) {
    void logger.error("Camera start failed because the app is not running in a secure context.");
    throw new Error(APP_STRINGS.secureContextRequired);
  }

  let stream;
  try {
    stream = await requestStreamWithConstraints(options.videoInputId || "", options.audioInputId || "");
  } catch (error) {
    const canFallback = options.videoInputId || (options.audioInputId && options.audioInputId !== DISABLED_AUDIO_INPUT_ID);
    if (!canFallback) {
      void logger.exception("Initial media stream request failed without fallback.", error, {
        videoInputId: options.videoInputId || "default",
        audioInputId: options.audioInputId || "default"
      });
      throw new Error(mapCameraError(error));
    }

    void logger.warn("Initial media stream request failed. Retrying with default device selection.", {
      videoInputId: options.videoInputId || "default",
      audioInputId: options.audioInputId || "default"
    });

    try {
      stream = await requestStreamWithConstraints(
        "",
        options.audioInputId === DISABLED_AUDIO_INPUT_ID ? DISABLED_AUDIO_INPUT_ID : ""
      );
    } catch (fallbackError) {
      void logger.exception("Fallback media stream request failed.", fallbackError, {
        videoInputId: options.videoInputId || "default",
        audioInputId: options.audioInputId || "default"
      });
      throw new Error(mapCameraError(fallbackError));
    }
  }

  stream.getVideoTracks().forEach((track) => {
    track.addEventListener("ended", () => {
      void logger.warn("Camera video track ended unexpectedly.", {
        label: track.label || ""
      });
    });
  });

  videos.forEach((video) => {
    video.srcObject = stream;
  });

  await Promise.all(
    videos.map(async (video) => {
      try {
        await video.play();
      } catch (error) {
        void logger.exception("Preview video playback did not auto-start.", error);
      }
    })
  );

  await waitForVideoReady(videos[0]);
  void logger.info("Camera stream started successfully.", {
    videoTrackCount: stream.getVideoTracks().length,
    audioTrackCount: stream.getAudioTracks().length
  });
  return stream;
}
