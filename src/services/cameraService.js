import { APP_STRINGS, APP_THRESHOLDS, CAMERA_CONFIG } from "../constants/appConfig.js";

/**
 * @param {HTMLVideoElement} video
 * @param {number} timeoutMs
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
 * @param {MediaStream | null} stream
 * @param {HTMLVideoElement[]} videos
 */
export function stopCameraStream(stream, videos) {
  if (stream) {
    stream.getTracks().forEach((track) => {
      track.stop();
    });
  }

  videos.forEach((video) => {
    video.srcObject = null;
  });
}

/**
 * @param {HTMLVideoElement[]} videos
 * @returns {Promise<MediaStream>}
 */
export async function startCameraStream(videos) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(APP_STRINGS.cameraUnsupported);
  }

  if (!window.isSecureContext) {
    throw new Error(APP_STRINGS.secureContextRequired);
  }

  const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONFIG);

  videos.forEach((video) => {
    video.srcObject = stream;
  });

  await Promise.all(
    videos.map(async (video) => {
      try {
        await video.play();
      } catch (error) {
        console.warn("Video playback did not auto-start.", error);
      }
    })
  );

  await waitForVideoReady(videos[0]);
  return stream;
}
