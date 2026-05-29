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

- 粒子模型：爱心、花朵、土星、烟花、戒指、蛋糕、气球、文字、姿态视频骨架、BVH 动作骨架、图片/Logo、GLB/glTF 3D 模型。
- GPU 粒子路径：主粒子位置变形已迁到 WebGL 顶点 shader，通过 attribute + uniform 驱动，减少每帧 CPU 逐粒子更新压力；支持 WebGL2、顶点纹理和浮点/半浮点渲染目标的非移动端设备会额外启用 FBO ping-pong 位置纹理模拟。
- 手势控制：张开手掌扩散，收拢/握拳聚回，拳头旋转控制视角；食指指向会进入独立“指向模式”，让模型按食指方向持续移动，同时临时把扩散/收缩输入压到最低并关闭拳头视角冲突。
- 注意：所有“手势切换模型”目前已关闭，OK/比心不再触发切换。
- 音乐响应：支持麦克风和本地音频文件，驱动模型缩放、位移、旋转、拖尾、Bloom 和底部频谱条。
- 图片/Logo 转粒子：支持边缘、局部颜色/明暗细节联合采样、Logo 二值模式、原色/灰度/单色、透明度、轮廓增强、内部采样比例、图片亮度和图片大小，并优先走 `src/image-worker.js` Worker 高密度采样。
- AI 动捕动作文件：推荐用户先用 DeepMotion、Rokoko、Move AI、Plask 或 Blender 插件把视频转成动作文件；最佳导出为带角色和动画的 `.glb` / `.gltf`，`.bvh` 可作为动作文件导入，`.fbx` 不建议直接导入，应先转成 GLB/glTF 或 BVH。
- GLB/glTF 转粒子：上传 `.glb` 或自包含 `.gltf` 后按三角面面积采样模型表面，生成 3D 粒子点云；顶点色和 base color 贴图会尽量保留，贴图路径会用三角形重心坐标插值 UV 后采样像素颜色；带内置动画的文件会保留 glTF 场景并用 `AnimationMixer` 播放，再按固定采样计划定时重采样当前姿态；导入面板可调密度、大小、厚度、表面扩散、播放/暂停、循环、动画速度、动作跟随、朝向、地面高度和人物居中。
- BVH 动作：上传 `.bvh` 后优先尝试用 `SkeletonUtils.retargetClip` 重定向到当前带骨骼 GLB/glTF；若骨骼命名匹配不足或重定向失败，则退回为 3D 粒子动作骨架，可调骨架密度、循环、速度和大小。
- 姿态视频转粒子 / 驱动 3D：上传人物/舞蹈视频后，使用 `@mediapipe/pose` 从本地视频抽帧识别人体关键点；若当前已有带骨骼 GLB/glTF 且“视频驱动3D”开启，会用肩-肘-腕、胯-膝-踝等方向 best-effort 驱动 humanoid 骨骼并实时重采样 mesh 粒子；驱动层包含骨骼别名/层级补全、身体比例感知、轻量脚底接触稳定、低置信度保持和平滑旋转限幅；没有合适骨骼时会明确提示导入失败并回退为粒子骨架、关节光点和四肢端点光晕。
- 姿态视频性能策略：Pose 抽帧间隔按画质档位自适应；姿态骨架只重写当前可见粒子范围并跳过 FBO 位置纹理模拟；视频驱动 3D 人物时复用 GLB/glTF 固定表面采样计划，避免每次视频结果都更新整档粒子。
- 控制：分层控制面板、主题、背景、更多背景、背景亮度、模型亮度、模型大小、演出巡演、可视化演出编排器、AI 动捕/导入推荐格式、导入进度、健康检查、现场安全模式、帮助说明、手势开关、静止按钮、张合灵敏度、指向灵敏度、面板缩放、图片/GLB/BVH/姿态采样参数、GLB 动作播放/循环/朝向/地面/居中、姿态视频导入、视频驱动 3D 开关、驱动平滑、文字字体等。
- 现场稳定性：系统区健康检查显示 WebGL、摄像头、MediaPipe、麦克风、音频、资源、画质和 FPS；“现场安全”会降低可见粒子量、Bloom 和背景复杂度，优先保证投屏稳定和主体辨识度。
- 演出预设：基础预设和扩展预设统一由 `src/show-controller.js` 注册；扩展演出放在 `src/show-presets/`，当前包含“星河心动现场”“心动告白礼”“生日快乐派对”；运行时也可通过面板文件导入或 `window.handParticleShows.importPreset()` 导入 JSON。

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
- `src/main.js`：Three.js 场景、主循环、事件绑定、图片采样调度、动作/姿态接入、手势接入、音乐轨迹、健康检查、现场安全和演出时间线逻辑。
- `src/importers/mesh-importer.js`：GLB/glTF 静态与动画采样、贴图颜色读取和动态 mesh 重采样。
- `src/importers/bvh-importer.js`：BVH 文本读取和 `BVHLoader` 解析。
- `src/importers/pose-video-importer.js`：姿态视频元素创建、metadata 等待和资源释放。
- `src/motion/pose-retarget-config.js`：姿态连接、重定向配置和骨骼命名归一化。
- `src/show-controller.js`：演出预设、镜头预设、自定义演出 JSON 规范化和预设列表。
- `src/particles.js`：粒子 BufferGeometry、shader、GPU attribute/uniform 更新和可选 FBO 位置纹理模拟，是性能核心。
- `src/shapes.js`：爱心、花朵、土星、烟花、戒指、蛋糕、气球、文字、通用点云目标点生成。
- `src/gestures.js`：手势张合、拳头视角、OK/比心/食指指向识别。OK/比心识别保留，但不触发切模型。
- `src/image-worker.js`：图片/Logo Worker 采样，减少大图导入时主线程卡顿。
- `public/mediapipe/pose`：MediaPipe Pose 的 wasm、tflite 和 graph 静态资源；生产部署必须保留，不能指向 `node_modules`。
- `src/audio.js`：麦克风/音频文件分析、频谱条数据、beat/kick/onset 等音乐特征。
- `src/ui.js`：控制面板引用、状态更新、主题/字体/图片参数/演出编排器/音频条 UI。
- `src/styles.css`：面板、模型按钮、音频条、主题视觉样式。
- `src/themes.js`：主题配色和 CSS 变量同步。
- `src/backgrounds.js`：星云、舞台、黑场、烟花夜空、极光帷幕、光网隧道、日落霓霞背景。
- `src/show-presets/`：可随应用打包的演出 JSON 预设目录。
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
- 光效要有舞台感但避免大面积白爆；改 Bloom、shader 白芯、背景 opacity 或光源时要优先保留模型辨识度。

## 图片/Logo 采样现状

图片采样由 `src/main.js` 的 `createImagePointCloud` 调度，优先交给 `src/image-worker.js` 执行，Worker 不可用或失败时回退到主线程：

- 使用 `createImageBitmap` 读取图片。
- 普通图片透明度很低的像素会被忽略；Logo 模式会使用更高的透明度阈值。
- 灰度化后做 3x3 高斯模糊。
- 用 Sobel 梯度、局部明暗对比、局部颜色对比和色彩饱和度做自适应采样。
- 普通图片模式不再过度偏向强边缘，会保留更多内部纹理和颜色变化。
- Logo 模式使用 Otsu 阈值，并自动判断黑/白前景。
- 输出采样池按画质档位约为当前粒子数的 `2.8` 到 `3.6` 倍，`ultra` 最高约 `2.4M` 个采样点。
- 图片粒子使用 `aParticleColor` 顶点颜色直接传 RGBA。
- 图片原色按接近浏览器显示的色彩空间传入 shader，避免少量颜色因线性转换出现偏差；shader 只做保色提亮、阴影补光和可控白芯。
- 图片大小滑条会缩放图片点云，并通过 `setParticleDrawCount` 同步调整可见粒子数；滑到最大时使用当前画质档的全部粒子。
- `writePointCloudTargets` 会在采样点数量高于渲染粒子数时做均匀覆盖映射，减少随机抽样造成的局部缺点和重复点。
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

## 演出编排器现状

演出系统由 `src/show-controller.js` 的 `SHOW_PRESETS`、自定义编排本地存储和 `src/main.js` 内的 `updateShowPreset` / `applyShowStep` 驱动：

- 内置/注册预设包含自动巡演、玫瑰告白、夜场烟花、图形展台，以及 `src/show-presets/` 中的“星河心动现场”“心动告白礼”“生日快乐派对”。
- `customShowPreset` 保存在浏览器 localStorage，支持 JSON 导入/导出。
- 面板支持从 `.json` 文件导入到自定义编排；页面也暴露 `window.handParticleShows.importPreset(preset)`、`list()`、`current()`、`play(id)`、`stop()`。
- step 支持 `label`、`duration`、`theme`、`background`、`model`、`text`、`modelBrightness`、`backgroundBrightness`、`imageBrightness`、`imageSize`、`camera`、`cameraDuration`、`burst`、`freeze`。
- `camera` 支持 `hold`、`front`、`close`、`wide`、`left`、`right`、`top`、`low`，也兼容带 `position` / `target` 数组的 JSON。
- `freeze` 会先留出短暂过渡时间再定格，时间线仍可继续推进到下一段；手动“静止”会暂停巡演推进。
- 编辑内置预设时，点击应用/新增/复制/删除/捕获会复制到“自定义编排”，不会改动内置模板。

## 常见注意点

- WebGL attribute 数量有限，新增 attribute 前要考虑移动端限制。之前已通过打包 `aTargetMeta`、`aParticleParams` 避免超限。
- 图片顶点颜色会走 `uUseVertexColor`，普通模型仍走主题色混合。
- BVH 重定向不是“任意模型必定成功”：当前按骨骼名称/别名做 best-effort 匹配，匹配不足会自动转为 BVH 粒子骨架播放。
- 姿态视频驱动 3D 也是 best-effort：依赖 humanoid 骨骼命名和蒙皮质量；当前已有轻量脚底接触稳定、比例感知、旋转限幅和低置信度保护，但还不是专业动捕级全身 IK、脚底硬锁或复杂体型比例求解。
- `snapParticlesToTargets` 在 GPU 路径下基本不做 CPU 对齐。
- `dist/` 和验证截图通常是生成产物，不一定需要提交。
- MediaPipe 资源在 `public/mediapipe/hands` 和 `public/mediapipe/pose`，不要随意改路径。
