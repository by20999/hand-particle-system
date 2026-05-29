export async function createPoseVideoElement(file) {
  const videoElement = document.createElement("video");
  videoElement.muted = true;
  videoElement.loop = true;
  videoElement.playsInline = true;
  videoElement.preload = "auto";
  videoElement.src = URL.createObjectURL(file);
  videoElement.style.display = "none";
  document.body.appendChild(videoElement);
  await waitForVideoMetadata(videoElement);
  return videoElement;
}

export function disposePoseVideoElement(videoElement) {
  if (!videoElement) return;
  videoElement.pause();
  if (videoElement.src) URL.revokeObjectURL(videoElement.src);
  videoElement.remove();
}

function waitForVideoMetadata(videoElement) {
  return new Promise((resolve, reject) => {
    if (videoElement.readyState >= 1) {
      resolve();
      return;
    }
    const cleanup = () => {
      videoElement.removeEventListener("loadedmetadata", handleLoaded);
      videoElement.removeEventListener("error", handleError);
    };
    const handleLoaded = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("video metadata unavailable"));
    };
    videoElement.addEventListener("loadedmetadata", handleLoaded, { once: true });
    videoElement.addEventListener("error", handleError, { once: true });
  });
}
