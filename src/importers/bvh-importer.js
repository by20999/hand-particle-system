import { BVHLoader } from "three/examples/jsm/loaders/BVHLoader.js";

export async function loadBvhMotion(file, onProgress) {
  onProgress?.({ value: 0.18, label: "正在读取 BVH 文本" });
  const text = await file.text();
  if (!text.trim()) {
    throw new Error("BVH 文件为空");
  }
  onProgress?.({ value: 0.42, label: "正在解析 BVH 骨骼" });
  const loader = new BVHLoader();
  const result = loader.parse(text);
  if (!result?.skeleton?.bones?.length || !result?.clip) {
    throw new Error("BVH 中没有可播放的骨骼动作");
  }
  result.skeleton.bones[0].updateMatrixWorld(true);
  onProgress?.({ value: 0.68, label: "正在准备 BVH 动作" });
  return result;
}
