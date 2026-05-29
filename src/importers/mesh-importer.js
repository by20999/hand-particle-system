import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const meshTextureSamplerCache = new WeakMap();
const textureSampleUv = new THREE.Vector2();

export async function createMeshParticleSource(file, targetCount, options = {}) {
  const { animatedSampleLimit = targetCount, staticSampleLimit = 980000, onProgress } = options;
  const url = URL.createObjectURL(file);
  try {
    const loader = new GLTFLoader();
    const gltf = await new Promise((resolve, reject) => {
      loader.load(
        url,
        resolve,
        (event) => {
          const ratio = event.total > 0 ? event.loaded / event.total : 0.35;
          onProgress?.({ value: 0.12 + Math.min(0.38, ratio * 0.38), label: "正在读取 GLB/glTF 文件" });
        },
        reject,
      );
    });
    onProgress?.({ value: 0.55, label: "正在解析网格与贴图" });
    const source = buildMeshParticleSource(gltf, file.name, targetCount, {
      animatedSampleLimit,
      staticSampleLimit,
      onProgress,
    });
    if (source.hasAnimation) {
      source.mixer = new THREE.AnimationMixer(source.scene);
      source.action = source.mixer.clipAction(source.animations[0]);
      source.action.reset().play();
    }
    return source;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function sampleMeshSource(source) {
  if (!source?.samples?.length) return source?.points ?? [];
  source.scene.updateMatrixWorld(true);
  for (const triangle of source.activeTriangles) {
    getMeshVertexWorldPosition(triangle.mesh, triangle.position, triangle.ia, triangle.a);
    getMeshVertexWorldPosition(triangle.mesh, triangle.position, triangle.ib, triangle.b);
    getMeshVertexWorldPosition(triangle.mesh, triangle.position, triangle.ic, triangle.c);
  }
  for (let i = 0; i < source.samples.length; i += 1) {
    const sample = source.samples[i];
    const triangle = source.triangles[sample.triangleIndex] ?? source.triangles[0];
    const point = source.points[i];
    const x = triangle.a.x * sample.u + triangle.b.x * sample.v + triangle.c.x * sample.w;
    const y = triangle.a.y * sample.u + triangle.b.y * sample.v + triangle.c.y * sample.w;
    const z = triangle.a.z * sample.u + triangle.b.z * sample.v + triangle.c.z * sample.w;
    point.baseX = (x - source.center.x) * source.normalizer;
    point.baseY = (y - source.center.y) * source.normalizer;
    point.baseZ = (z - source.center.z) * source.normalizer;
    point.x = point.baseX;
    point.y = point.baseY;
    point.z = point.baseZ;
  }
  return source.points;
}

function buildMeshParticleSource(gltf, fileName, targetCount, options) {
  const { animatedSampleLimit, staticSampleLimit, onProgress } = options;
  gltf.scene.updateMatrixWorld(true);
  const triangles = [];
  const skinnedMeshes = [];
  const materialInfoCache = new WeakMap();
  const box = new THREE.Box3();
  const tempA = new THREE.Vector3();
  const tempB = new THREE.Vector3();
  const tempC = new THREE.Vector3();

  gltf.scene.traverse((object) => {
    if (object.isSkinnedMesh) skinnedMeshes.push(object);
    if (!object.isMesh || !object.geometry?.attributes?.position) return;
    const geometry = object.geometry;
    const position = geometry.attributes.position;
    const index = geometry.index;
    const colorAttribute = geometry.attributes.color;
    const count = index ? index.count : position.count;
    for (let i = 0; i + 2 < count; i += 3) {
      const ia = index ? index.getX(i) : i;
      const ib = index ? index.getX(i + 1) : i + 1;
      const ic = index ? index.getX(i + 2) : i + 2;
      const materialInfo = meshTriangleMaterialInfo(object.material, geometry, i, materialInfoCache);
      const uvAttribute = materialInfo.uvAttributeName ? geometry.attributes[materialInfo.uvAttributeName] : null;
      getMeshVertexWorldPosition(object, position, ia, tempA);
      getMeshVertexWorldPosition(object, position, ib, tempB);
      getMeshVertexWorldPosition(object, position, ic, tempC);
      const area = new THREE.Triangle(tempA, tempB, tempC).getArea();
      if (area <= 0.000001) continue;
      triangles.push({
        mesh: object,
        position,
        ia,
        ib,
        ic,
        a: tempA.clone(),
        b: tempB.clone(),
        c: tempC.clone(),
        area,
        materialInfo,
        colorA: colorAttribute ? readVertexColor(colorAttribute, ia) : null,
        colorB: colorAttribute ? readVertexColor(colorAttribute, ib) : null,
        colorC: colorAttribute ? readVertexColor(colorAttribute, ic) : null,
        uvA: uvAttribute ? readUv(uvAttribute, ia) : null,
        uvB: uvAttribute ? readUv(uvAttribute, ib) : null,
        uvC: uvAttribute ? readUv(uvAttribute, ic) : null,
      });
      box.expandByPoint(tempA);
      box.expandByPoint(tempB);
      box.expandByPoint(tempC);
    }
  });

  if (triangles.length === 0) {
    throw new Error("GLB/glTF 中没有可采样的网格表面");
  }

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const normalizer = 2.28 / Math.max(size.x, size.y, size.z, 0.001);
  const hasAnimation = (gltf.animations?.length ?? 0) > 0;
  const hasSkinnedMesh = skinnedMeshes.length > 0;
  const sampleLimit = hasAnimation || hasSkinnedMesh ? animatedSampleLimit : staticSampleLimit;
  const cumulative = [];
  let totalArea = 0;
  for (const triangle of triangles) {
    totalArea += triangle.area;
    cumulative.push(totalArea);
  }

  const desiredCount = Number.isFinite(targetCount) && targetCount > 0 ? targetCount : triangles.length * 16;
  const sampleCount = Math.min(sampleLimit, Math.max(36000, desiredCount));
  const source = {
    scene: gltf.scene,
    fileName,
    animations: gltf.animations ?? [],
    mixer: null,
    action: null,
    enabled: false,
    hasAnimation,
    nativeHasAnimation: hasAnimation,
    hasSkinnedMesh,
    skinnedMeshes,
    triangles,
    activeTriangles: [],
    samples: [],
    points: [],
    center,
    normalizer,
    lastSampleAt: 0,
    texturedSamples: 0,
    transparentSamples: 0,
  };
  const usedTriangles = new Set();
  onProgress?.({ value: 0.72, label: hasAnimation ? "正在建立动画采样计划" : "正在采样模型表面" });
  for (let i = 0; i < sampleCount; i += 1) {
    let sample = null;
    let sampledColor = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      sample = pickMeshSurfaceSample(i, attempt, triangles, cumulative, totalArea);
      const triangle = triangles[sample.triangleIndex] ?? triangles[triangles.length - 1];
      sampledColor = sampleTriangleColor(triangle, sample.u, sample.v, sample.w);
      if ((sampledColor.a ?? 1) > 0.08 || attempt === 5) break;
    }
    const colorTotal = sampledColor.r + sampledColor.g + sampledColor.b + 0.001;
    const baseJitter = 0.004;
    source.samples.push(sample);
    source.points.push({
      x: 0,
      y: 0,
      z: 0,
      baseX: 0,
      baseY: 0,
      baseZ: 0,
      r: sampledColor.r,
      g: sampledColor.g,
      b: sampledColor.b,
      a: THREE.MathUtils.clamp(sampledColor.a ?? 1, 0.02, 1),
      mix: THREE.MathUtils.clamp((sampledColor.g * 0.45 + sampledColor.b * 0.65) / colorTotal, 0, 1),
      glow: THREE.MathUtils.clamp((sampledColor.glow ?? 0.54) + hash01(i * 5.91) * 0.2, 0.38, 1.18),
      jitter: baseJitter,
      baseJitter,
    });
    if (sampledColor.textured) source.texturedSamples += 1;
    if ((sampledColor.a ?? 1) < 0.25) source.transparentSamples += 1;
    usedTriangles.add(sample.triangleIndex);
    if (i > 0 && i % 18000 === 0) {
      onProgress?.({
        value: 0.72 + Math.min(0.18, (i / sampleCount) * 0.18),
        label: hasAnimation ? "正在建立动画采样计划" : "正在采样模型表面",
      });
    }
  }

  source.activeTriangles = [...usedTriangles].map((index) => triangles[index]).filter(Boolean);
  sampleMeshSource(source);
  return source;
}

function pickMeshSurfaceSample(index, attempt, triangles, cumulative, totalArea) {
  const seed = index + attempt * 104729;
  const pick = hash01(seed * 12.9898 + attempt * 7.31) * totalArea;
  const triangleIndex = Math.min(triangles.length - 1, lowerBound(cumulative, pick));
  let u = hash01(seed * 78.233 + attempt * 5.17);
  let v = hash01(seed * 37.719 + attempt * 11.41);
  if (u + v > 1) {
    u = 1 - u;
    v = 1 - v;
  }
  return { triangleIndex, u, v, w: 1 - u - v };
}

function getMeshVertexWorldPosition(mesh, position, index, target) {
  target.fromBufferAttribute(position, index);
  if (mesh.isSkinnedMesh && mesh.geometry?.attributes?.skinIndex && mesh.geometry?.attributes?.skinWeight && typeof mesh.applyBoneTransform === "function") {
    mesh.applyBoneTransform(index, target);
  }
  return target.applyMatrix4(mesh.matrixWorld);
}

function meshTriangleMaterialInfo(material, geometry, triangleStart, cache) {
  const materials = Array.isArray(material) ? material : [material];
  const group = geometry.groups?.find((item) => triangleStart >= item.start && triangleStart < item.start + item.count);
  const materialIndex = THREE.MathUtils.clamp(group?.materialIndex ?? 0, 0, Math.max(0, materials.length - 1));
  return cachedMaterialInfo(materials[materialIndex], cache);
}

function cachedMaterialInfo(material, cache) {
  if (!material || typeof material !== "object") {
    return createMaterialInfo(null);
  }
  const cached = cache.get(material);
  if (cached) return cached;
  const info = createMaterialInfo(material);
  cache.set(material, info);
  return info;
}

function createMaterialInfo(material) {
  const map = createTextureSampler(material?.map);
  const alphaMap = createTextureSampler(material?.alphaMap);
  const emissiveMap = createTextureSampler(material?.emissiveMap);
  const primaryTexture = map?.texture ?? alphaMap?.texture ?? emissiveMap?.texture ?? null;
  const color = material?.color instanceof THREE.Color ? material.color.clone() : new THREE.Color("#ffffff");
  const emissive = material?.emissive instanceof THREE.Color ? material.emissive : new THREE.Color(0, 0, 0);
  return {
    color,
    opacity: Number.isFinite(material?.opacity) ? material.opacity : 1,
    alphaTest: Number.isFinite(material?.alphaTest) ? material.alphaTest : 0,
    map,
    alphaMap,
    emissiveMap,
    emissive,
    emissiveIntensity: Number.isFinite(material?.emissiveIntensity) ? material.emissiveIntensity : 1,
    uvAttributeName: textureUvAttributeName(primaryTexture),
  };
}

function createTextureSampler(texture) {
  if (!texture?.isTexture) return null;
  if (meshTextureSamplerCache.has(texture)) {
    return meshTextureSamplerCache.get(texture);
  }
  let sampler = null;
  try {
    const image = texture.image ?? texture.source?.data;
    if (!image) throw new Error("texture image missing");
    const width = Math.round(image.width ?? image.videoWidth ?? image.naturalWidth ?? 0);
    const height = Math.round(image.height ?? image.videoHeight ?? image.naturalHeight ?? 0);
    let data = image.data ?? null;
    if (!width || !height) {
      throw new Error("texture size missing");
    }
    let divisor = 255;
    let channels = 4;
    if (!data) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("canvas context unavailable");
      context.drawImage(image, 0, 0, width, height);
      data = context.getImageData(0, 0, width, height).data;
    } else {
      channels = Math.max(1, Math.round(data.length / Math.max(1, width * height)));
      if (data instanceof Float32Array || data instanceof Float64Array) divisor = 1;
      else if (data instanceof Uint16Array) divisor = 65535;
    }
    texture.updateMatrix?.();
    sampler = { texture, data, width, height, channels, divisor };
  } catch (error) {
    console.warn("GLB/glTF texture sampling unavailable", error);
  }
  meshTextureSamplerCache.set(texture, sampler);
  return sampler;
}

function textureUvAttributeName(texture) {
  if (!texture) return null;
  const channel = Math.max(0, Math.round(texture.channel ?? 0));
  return channel === 0 ? "uv" : `uv${channel}`;
}

function readUv(attribute, index) {
  return { x: attribute.getX(index), y: attribute.getY(index) };
}

function readVertexColor(attribute, index) {
  return new THREE.Color(attribute.getX(index), attribute.getY(index), attribute.getZ(index));
}

function sampleTriangleColor(triangle, u, v, w) {
  const material = triangle.materialInfo;
  let r = material?.color?.r ?? 1;
  let g = material?.color?.g ?? 1;
  let b = material?.color?.b ?? 1;
  let a = THREE.MathUtils.clamp(material?.opacity ?? 1, 0, 1);
  let textured = false;

  if (triangle.colorA && triangle.colorB && triangle.colorC) {
    r *= triangle.colorA.r * u + triangle.colorB.r * v + triangle.colorC.r * w;
    g *= triangle.colorA.g * u + triangle.colorB.g * v + triangle.colorC.g * w;
    b *= triangle.colorA.b * u + triangle.colorB.b * v + triangle.colorC.b * w;
  }

  if (material?.map && triangle.uvA && triangle.uvB && triangle.uvC) {
    const texel = sampleTriangleTexture(material.map, triangle, u, v, w);
    r *= texel.r;
    g *= texel.g;
    b *= texel.b;
    a *= texel.a;
    textured = true;
  }

  if (material?.alphaMap && triangle.uvA && triangle.uvB && triangle.uvC) {
    const texel = sampleTriangleTexture(material.alphaMap, triangle, u, v, w);
    a *= texel.r;
  }

  if (material?.alphaTest > 0 && a < material.alphaTest) {
    a *= 0.18;
  }

  let emissiveBoost = 0;
  if (material?.emissiveMap && triangle.uvA && triangle.uvB && triangle.uvC) {
    const texel = sampleTriangleTexture(material.emissiveMap, triangle, u, v, w);
    const intensity = THREE.MathUtils.clamp(material.emissiveIntensity ?? 1, 0, 6);
    r = Math.min(1, r + (material.emissive?.r ?? 0) * texel.r * intensity * 0.5);
    g = Math.min(1, g + (material.emissive?.g ?? 0) * texel.g * intensity * 0.5);
    b = Math.min(1, b + (material.emissive?.b ?? 0) * texel.b * intensity * 0.5);
    emissiveBoost = (texel.r + texel.g + texel.b) * intensity * 0.055;
    textured = true;
  }

  const luma = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  return {
    r: THREE.MathUtils.clamp(r, 0, 1),
    g: THREE.MathUtils.clamp(g, 0, 1),
    b: THREE.MathUtils.clamp(b, 0, 1),
    a: THREE.MathUtils.clamp(a, 0, 1),
    glow: THREE.MathUtils.clamp(0.52 + Math.sqrt(Math.max(0, luma)) * 0.34 + chroma * 0.18 + emissiveBoost, 0.38, 1.2),
    textured,
  };
}

function sampleTriangleTexture(sampler, triangle, u, v, w) {
  return sampleTexture(sampler, triangle.uvA.x * u + triangle.uvB.x * v + triangle.uvC.x * w, triangle.uvA.y * u + triangle.uvB.y * v + triangle.uvC.y * w);
}

function sampleTexture(sampler, u, v) {
  textureSampleUv.set(u, v);
  sampler.texture.transformUv(textureSampleUv);
  const fx = THREE.MathUtils.clamp(textureSampleUv.x, 0, 1) * (sampler.width - 1);
  const fy = THREE.MathUtils.clamp(textureSampleUv.y, 0, 1) * (sampler.height - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(sampler.width - 1, x0 + 1);
  const y1 = Math.min(sampler.height - 1, y0 + 1);
  const tx = fx - x0;
  const ty = fy - y0;
  return {
    r: sampleTextureChannel(sampler, x0, y0, x1, y1, tx, ty, 0),
    g: sampleTextureChannel(sampler, x0, y0, x1, y1, tx, ty, 1),
    b: sampleTextureChannel(sampler, x0, y0, x1, y1, tx, ty, 2),
    a: sampleTextureChannel(sampler, x0, y0, x1, y1, tx, ty, 3),
  };
}

function sampleTextureChannel(sampler, x0, y0, x1, y1, tx, ty, channel) {
  return bilerp(
    texturePixelChannel(sampler, x0, y0, channel),
    texturePixelChannel(sampler, x1, y0, channel),
    texturePixelChannel(sampler, x0, y1, channel),
    texturePixelChannel(sampler, x1, y1, channel),
    tx,
    ty,
  );
}

function texturePixelChannel(sampler, x, y, channel) {
  if (channel === 3 && sampler.channels < 4) return 1;
  const index = (y * sampler.width + x) * sampler.channels;
  const data = sampler.data;
  const divisor = sampler.divisor || 255;
  const sourceIndex = index + Math.min(channel, sampler.channels - 1);
  return (data[sourceIndex] ?? data[index] ?? divisor) / divisor;
}

function bilerp(c00, c10, c01, c11, tx, ty) {
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(c00, c10, tx), THREE.MathUtils.lerp(c01, c11, tx), ty);
}

function lowerBound(values, target) {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (values[mid] < target) low = mid + 1;
    else high = mid;
  }
  return low;
}

function hash01(value) {
  const x = Math.sin(value * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
