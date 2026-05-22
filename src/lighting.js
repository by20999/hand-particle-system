import * as THREE from "three";

export function createStaticLightSources(baseColor) {
  const group = new THREE.Group();
  group.userData.ambient = new THREE.AmbientLight(0xffffff, 0.12);
  group.add(group.userData.ambient);

  const lights = [
    { role: "main", position: [-0.2, 0.15, -4.2], intensity: 1.12, distance: 13, scale: 8.8, opacity: 0.34 },
    { role: "wash", position: [-2.8, 1.9, -5.4], intensity: 0.54, distance: 15, scale: 7.2, opacity: 0.22 },
    { role: "shade", position: [2.9, -1.7, -5.8], intensity: 0.38, distance: 14, scale: 6.8, opacity: 0.16 },
  ];

  const texture = createGlowTexture();
  group.userData.layers = [];
  for (const light of lights) {
    const point = new THREE.PointLight(0xffffff, light.intensity, light.distance, 2.4);
    point.position.set(...light.position);
    group.add(point);

    const material = new THREE.SpriteMaterial({
      map: texture,
      color: 0xffffff,
      transparent: true,
      opacity: light.opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(...light.position);
    sprite.scale.set(light.scale, light.scale, 1);
    group.add(sprite);
    group.userData.layers.push({ ...light, point, sprite, material });
  }

  applyStaticLightColors(group, baseColor);
  return group;
}

export function applyStaticLightColors(lightGroup, baseColor) {
  const hsl = {};
  baseColor.getHSL(hsl);
  const main = new THREE.Color().setHSL(hsl.h, Math.min(0.92, hsl.s * 0.82 + 0.12), 0.58);
  const wash = new THREE.Color().setHSL(
    hsl.h,
    Math.min(0.76, hsl.s * 0.5 + 0.08),
    Math.min(0.78, hsl.l + 0.22),
  );
  const shade = new THREE.Color().setHSL(
    (hsl.h + 0.965) % 1,
    Math.min(0.68, hsl.s * 0.42 + 0.06),
    Math.max(0.2, hsl.l * 0.42),
  );

  const colors = { main, wash, shade };
  for (const layer of lightGroup.userData.layers ?? []) {
    layer.point.color.copy(colors[layer.role]);
    layer.material.color.copy(colors[layer.role]);
  }
  lightGroup.userData.ambient?.color.copy(wash);
}

export function updateStaticLights(staticLights, elapsed) {
  const layers = staticLights.userData.layers ?? [];
  const pulse = 0.5 + 0.5 * Math.sin(elapsed * 0.34);

  for (let i = 0; i < layers.length; i += 1) {
    const layer = layers[i];
    const driftX = Math.sin(elapsed * (0.11 + i * 0.025) + i * 1.7) * 0.18;
    const driftY = Math.cos(elapsed * (0.09 + i * 0.02) + i * 1.2) * 0.14;
    layer.sprite.position.x = layer.position[0] + driftX;
    layer.sprite.position.y = layer.position[1] + driftY;
    layer.point.position.x = layer.sprite.position.x;
    layer.point.position.y = layer.sprite.position.y;

    const breathe = 0.92 + pulse * 0.12 + Math.sin(elapsed * 0.21 + i) * 0.025;
    layer.sprite.scale.set(layer.scale * breathe, layer.scale * breathe, 1);
    layer.material.opacity = layer.opacity * (0.88 + pulse * 0.14);
    layer.point.intensity = layer.intensity * (0.92 + pulse * 0.08);
  }

  return pulse;
}

function createGlowTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,0.9)");
  gradient.addColorStop(0.18, "rgba(255,255,255,0.28)");
  gradient.addColorStop(0.62, "rgba(255,255,255,0.06)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
