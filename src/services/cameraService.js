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
      throw error;
    }

    void logger.warn("Initial media stream request failed. Retrying with default device selection.", {
      videoInputId: options.videoInputId || "default",
      audioInputId: options.audioInputId || "default"
    });
    stream = await requestStreamWithConstraints("", options.audioInputId === DISABLED_AUDIO_INPUT_ID ? DISABLED_AUDIO_INPUT_ID : "");
  }

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
