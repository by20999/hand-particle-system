# Hand Particle System Agent Instructions

这个文件是新对话接手项目的唯一入口。开始处理本项目时，先读本文件，再按需阅读 `README.md`、`更新文档.md` 和相关源码。

## Required Workflow

- Start by reading this `AGENTS.md`.
- For feature history, read `更新文档.md`.
- For user-facing behavior, read `README.md`.
- Keep changes scoped to the existing project structure.
- After non-trivial code changes, run `npm run build`.
- After shader, rendering, UI, image/Logo, gesture, or mobile-sensitive changes, run `npm run check`.
- Update `README.md` and `更新文档.md` when changing user-facing behavior.
- Do not re-enable gesture-based model switching unless explicitly requested.

## 项目简介

`hand-particle-system` 是一个基于 Vite、Three.js、MediaPipe Hands 的实时 3D 手势粒子视觉项目。它把手势、音乐、图片/Logo、文字和 3D 模型转换成可交互的粒子场，适合舞台视觉、礼物屏幕、互动展示和 KTV 风格的动态效果。

当前项目重点不是普通网页，而是一个全屏 WebGL 互动视觉工具。第一屏就是可用的粒子体验，左侧是控制面板，底部有音频频谱条。

## 当前核心功能

- 粒子模型：爱心、花朵、土星、烟花、文字、图片/Logo、GLB 3D 模型。
- GPU 粒子路径：主粒子位置变形已迁到 WebGL 顶点 shader，通过 attribute + uniform 驱动，减少每帧 CPU 逐粒子更新压力；支持 WebGL2、顶点纹理和浮点/半浮点渲染目标的非移动端设备会额外启用 FBO ping-pong 位置纹理模拟。
- 手势控制：张开手掌扩散，收拢/握拳聚回，拳头旋转控制视角，食指指向让模型朝指向方向移动。
- 注意：所有“手势切换模型”目前已关闭，OK/比心不再触发切换。
- 音乐响应：支持麦克风和本地音频文件，驱动模型缩放、位移、旋转、拖尾、Bloom 和底部频谱条。
- 图片/Logo 转粒子：支持边缘优先采样、Logo 二值模式、原色/灰度/单色、透明度、轮廓增强、内部采样比例，并优先走 `src/image-worker.js` Worker 采样。
- GLB 转粒子：上传 `.glb` 后按三角面面积采样模型表面，生成 3D 粒子点云；顶点色会尽量保留。
- 控制：主题、背景、演出巡演、手势开关、静止按钮、面板缩放、图片采样参数、文字字体等。

## 运行与验证

安装依赖：

```bash
npm install
```

开发运行：

```bash
npm run dev
```

浏览器访问：

```text
http://localhost:5173
```

生产构建：

```bash
npm run build
```

完整检查：

```bash
npm run check
```

`npm run check` 会执行构建和 Playwright 验证，确认桌面/移动端 WebGL 画面非空、无明显控制台错误、页面异常、请求失败和资源 404，并覆盖模型/背景/主题切换、文字刷新、手势/静止按钮和图片导入路径。每次较大改动后都要跑。

## 关键文件

- `index.html`：控制面板和页面结构。
- `src/main.js`：Three.js 场景、主循环、事件绑定、图片采样、GLB 采样、手势接入、音乐轨迹。
- `src/particles.js`：粒子 BufferGeometry、shader、GPU attribute/uniform 更新和可选 FBO 位置纹理模拟，是性能核心。
- `src/shapes.js`：爱心、花朵、土星、烟花、文字、通用点云目标点生成。
- `src/gestures.js`：手势张合、拳头视角、OK/比心/食指指向识别。OK/比心识别保留，但不触发切模型。
- `src/image-worker.js`：图片/Logo Worker 采样，减少大图导入时主线程卡顿。
- `src/audio.js`：麦克风/音频文件分析、频谱条数据、beat/kick/onset 等音乐特征。
- `src/ui.js`：控制面板引用、状态更新、主题/字体/图片参数/音频条 UI。
- `src/styles.css`：面板、模型按钮、音频条、主题视觉样式。
- `src/themes.js`：主题配色和 CSS 变量同步。
- `src/backgrounds.js`：星云、舞台、黑场、烟花夜空背景。
- `README.md`：用户向说明。
- `更新文档.md`：历史更新记录。
- `AGENTS.md`：新对话接手说明，也就是本文件。

## 开发规则

- 不要重构整个项目结构，优先在现有模块内精确修改。
- 改功能后同步更新 `README.md` 和 `更新文档.md`，除非只是极小的内部修复。
- 修改后至少跑 `npm run build`；涉及 shader、UI、渲染、移动端兼容时跑 `npm run check`。
- 不要恢复或删除用户已有改动。当前工作区可能长期处于 dirty 状态。
- 手动编辑文件时使用 `apply_patch`。
- 搜索文件优先用 `rg`。
- 不要使用会破坏用户文件的命令，例如 `git reset --hard`、`git checkout --`。
- 前端设计要保持工具型、舞台视觉型，不要改成营销落地页。
- 避免引入大而无必要的新依赖。Three.js 已经可用，GLB 使用 `GLTFLoader`。

## 视觉与交互偏好

- 用户偏好“炫酷、有生命力、KTV/舞台嗨场”的视觉氛围，但模型要保持可辨认。
- 音乐响应要强，但不能把模型打散到看不出形状。
- 轨迹要有速度感、粒子感、近粗远细，但不要突兀遮挡主体。
- 花朵要自然、包裹、有真实玫瑰的非规则层次，不要规则分层。
- 烟花要分组清晰、花状绽放、有空间层次，不要所有烟花糊在一起。
- 图片/Logo 要尽量还原原图，减少过曝，保留轮廓和内部纹理。

## 图片/Logo 采样现状

图片采样由 `src/main.js` 的 `createImagePointCloud` 调度，优先交给 `src/image-worker.js` 执行，Worker 不可用或失败时回退到主线程：

- 使用 `createImageBitmap` 读取图片。
- 透明度低于 128 的像素会被忽略。
- 灰度化后做 3x3 高斯模糊。
- 用 Sobel 梯度和局部对比度做自适应采样。
- 普通图片模式保留强边缘，也会保留内部纹理。
- Logo 模式使用 Otsu 阈值，并自动判断黑/白前景。
- 输出点数约为当前画质粒子数的 `1.22` 倍，再由粒子系统按随机映射填充。
- 图片粒子使用 `aParticleColor` 顶点颜色直接传 RGBA。
- 点击“图片”或“3D”模型但尚未导入资源时，会提示并打开对应文件选择器，不会切到空点云。

如果用户反馈图片上传无反应，优先检查：

- 图片格式是否浏览器支持。
- 是否是超大图导致主线程采样几秒。
- 是否透明度太低。
- Logo 模式是否误判前景；现在已有自动黑/白前景判断和普通模式回退。

## GPU 粒子实现现状

主粒子系统在 `src/particles.js`：

- `aTarget`：目标点。
- `aTargetDir`：目标方向。
- `aTargetMeta`：半径、类型、基础亮度。
- `aParticleParams`：随机值、颜色混合值。
- `aParticleColor`：图片/GLB 顶点颜色 RGBA。
- `aWavePhase`、`aDepthSign`：扰动辅助。
- `aSimUv`：仅 FBO 模拟启用时存在，用于从位置纹理读取模拟坐标。
- 每帧主要更新 uniform，而不是 CPU 遍历所有粒子位置。

注意：当前基础路径是 WebGL 顶点 shader 驱动；桌面能力足够时会启用 `src/particles.js` 内的 FBO ping-pong 位置纹理层，由 `src/main.js` 的 `shouldUseFboSimulation` 做能力判断。它仍不是 WebGPU compute，后续如果继续追求极限性能，可以再做 WebGPU 模拟。

## 常见注意点

- WebGL attribute 数量有限，新增 attribute 前要考虑移动端限制。之前已通过打包 `aTargetMeta`、`aParticleParams` 避免超限。
- 图片顶点颜色会走 `uUseVertexColor`，普通模型仍走主题色混合。
- `snapParticlesToTargets` 在 GPU 路径下基本不做 CPU 对齐。
- `dist/` 和验证截图通常是生成产物，不一定需要提交。
- MediaPipe 资源在 `public/mediapipe/hands`，不要随意改路径。
