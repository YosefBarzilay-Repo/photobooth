import { APP_STRINGS, DISABLED_AUDIO_INPUT_ID } from "../constants/appConfig.js";
import { logger } from "./logger.js";

function buildFallbackLabel(kind, index) {
  if (kind === "videoinput") {
    return `Camera ${index + 1}`;
  }

  return `Microphone ${index + 1}`;
}

export async function enumerateInputDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    void logger.warn("Media device enumeration is unavailable in this environment.");
    return {
      videoInputs: [],
      audioInputs: []
    };
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  const videoInputs = [];
  const audioInputs = [];

  devices.forEach((device) => {
    if (device.kind === "videoinput") {
      videoInputs.push({
        deviceId: device.deviceId,
        label: device.label || buildFallbackLabel(device.kind, videoInputs.length)
      });
    }

    if (device.kind === "audioinput") {
      audioInputs.push({
        deviceId: device.deviceId,
        label: device.label || buildFallbackLabel(device.kind, audioInputs.length)
      });
    }
  });

  void logger.info("Enumerated media input devices.", {
    totalDevices: devices.length,
    videoInputs: videoInputs.length,
    audioInputs: audioInputs.length
  });
  return { videoInputs, audioInputs };
}

export function buildVideoInputOptions(videoInputs) {
  return [
    { value: "", label: videoInputs.length > 0 ? "System Default Camera" : APP_STRINGS.noMediaDevices },
    ...videoInputs.map((device) => ({ value: device.deviceId, label: device.label }))
  ];
}

export function buildAudioInputOptions(audioInputs) {
  return [
    { value: "", label: audioInputs.length > 0 ? "System Default Microphone" : "No microphone detected" },
    { value: DISABLED_AUDIO_INPUT_ID, label: "Audio Off" },
    ...audioInputs.map((device) => ({ value: device.deviceId, label: device.label }))
  ];
}
