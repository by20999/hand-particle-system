# Hand Particle System Architecture

这张图用于快速理解当前项目的模块分工和数据流。核心思路是：`src/main.js` 作为实时编排层，把手势、音乐、导入素材、演出时间线和 UI 参数合并成统一状态，再驱动 Three.js 场景、GPU 粒子系统、背景、灯光和后期效果。

```mermaid
flowchart TB
  user["用户 / 浏览器"]
  camera["摄像头视频流"]
  mic["麦克风 / 本地音频"]
  imageFile["图片 / Logo 文件"]
  glbFile["GLB 3D 模型"]
  poseVideo["姿态视频"]
  showJson["演出 JSON / 预设"]

  html["index.html<br/>控制面板 + canvas + 文件入口"]
  ui["src/ui.js<br/>DOM 引用 / 状态显示 / 滑条 / 帮助说明"]
  main["src/main.js<br/>应用编排核心<br/>事件绑定 / 状态机 / 时间线 / 导入调度 / 主循环"]
  config["src/config.js<br/>画质档位 / 粒子数 / MediaPipe 资源路径"]

  hands["MediaPipe Hands<br/>public/mediapipe/hands"]
  gestures["src/gestures.js<br/>张合 / 握拳视角 / 食指指向"]
  pose["MediaPipe Pose<br/>public/mediapipe/pose"]
  audio["src/audio.js<br/>频谱 / beat / kick / onset"]
  imageWorker["src/image-worker.js<br/>图片高密度采样 Worker"]
  gltf["GLTFLoader<br/>GLB 表面三角面采样"]
  shows["src/show-presets/<br/>内置演出预设"]

  shapes["src/shapes.js<br/>内置模型目标点<br/>爱心 / 花朵 / 土星 / 烟花 / 戒指 / 蛋糕 / 气球 / 文字"]
  particles["src/particles.js<br/>BufferGeometry + ShaderMaterial<br/>GPU attribute/uniform 驱动"]
  fbo["可选 FBO ping-pong<br/>位置纹理模拟"]

  themes["src/themes.js<br/>主题色 / CSS 变量"]
  backgrounds["src/backgrounds.js<br/>星云 / 舞台 / 烟花夜空 / 极光 / 光网 / 日落"]
  lighting["src/lighting.js<br/>静态光源 / 主题光色"]
  trail["Motion Trail<br/>音乐位移拖尾"]
  three["Three.js Scene<br/>Renderer / Camera / OrbitControls / Bloom Composer"]
  canvas["WebGL Canvas<br/>最终全屏粒子视觉"]

  verify["scripts/verify.mjs<br/>Playwright 桌面/移动/导入路径验证"]
  dist["Vite build<br/>dist/ 静态产物"]
  vercel["Vercel 部署<br/>hand-particle-system.vercel.app"]

  user --> html
  html --> ui
  ui <--> main
  config --> main

  camera --> hands --> gestures --> main
  mic --> audio --> main
  imageFile --> main --> imageWorker --> main
  glbFile --> main --> gltf --> main
  poseVideo --> main --> pose --> main
  showJson --> main
  shows --> main

  main --> shapes
  main --> particles
  shapes --> particles
  particles --> fbo
  particles --> three

  main --> themes
  themes --> ui
  themes --> backgrounds
  themes --> lighting

  main --> backgrounds --> three
  main --> lighting --> three
  main --> trail --> three
  audio --> trail
  three --> canvas

  html --> dist
  dist --> vercel
  verify --> html
  verify --> canvas

  classDef input fill:#102033,stroke:#4bd5ff,color:#eef8ff
  classDef core fill:#221433,stroke:#ff4f9a,color:#fff2f8
  classDef render fill:#14291f,stroke:#55e08a,color:#effff4
  classDef asset fill:#302818,stroke:#ffd166,color:#fff9e8
  classDef ops fill:#2a2d38,stroke:#aab7c9,color:#f3f6fb

  class user,camera,mic,imageFile,glbFile,poseVideo,showJson input
  class html,ui,main,config core
  class hands,gestures,pose,audio,imageWorker,gltf,shows,shapes asset
  class particles,fbo,themes,backgrounds,lighting,trail,three,canvas render
  class verify,dist,vercel ops
```

## 模块边界速查

- `src/main.js`：项目中枢。不要把全部逻辑继续无限堆到 UI 或 shader 里，跨模块状态优先在这里协调。
- `src/particles.js`：性能核心。负责粒子 attribute、uniform、shader 和可选 FBO 模拟。
- `src/shapes.js`：目标点生成。新增内置模型时优先放这里。
- `src/ui.js`：只处理 DOM 引用、读写控件值和 UI 状态显示。
- `src/image-worker.js`：图片/Logo 的高密度采样路径，避免主线程卡顿。
- `public/mediapipe/*`：MediaPipe wasm/tflite/graph 资源，生产部署必须保留。
- `scripts/verify.mjs`：较大 UI、渲染、导入和移动端敏感改动后的自动检查入口。
