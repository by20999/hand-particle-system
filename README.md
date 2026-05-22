# Hand Particle System

一个基于 Three.js 和 MediaPipe Hands 的实时 3D 手势粒子系统。项目使用摄像头识别手部关键点，将手掌张合、双手距离和握拳姿态映射到粒子爱心的扩散、收拢和视角控制上。

## 功能概览

- 3D 粒子爱心：粒子组成带有厚度的 3D 爱心，外层有高亮轮廓和轻微扩散粒子。
- 手势控制扩散：张开手掌时粒子扩散、变亮；收拢或握拳时粒子聚回爱心。
- 双手控制幅度：双手同时入镜时，双手距离会参与控制整体扩散幅度。
- 握拳视角控制：单手握拳后旋转拳头，可以进入自由视角控制，观察 3D 爱心。
- 模型切换：支持爱心、花朵、土星、佛像、烟花等粒子模型。
- 颜色选择：可以实时调整粒子主色，背景光晕会同步变为相近色系。
- 柔和背景光：背景不再使用空间线条和杂乱星点，而是使用同色系柔和动态光晕。
- 鼠标辅助预览：没有摄像头时，也可以使用鼠标旋转视角；按住 Shift 拖动可扰动粒子。

## 技术栈

- `Vite`：开发服务器和构建工具。
- `Three.js`：3D 场景、粒子系统、相机控制和 Bloom 后期效果。
- `@mediapipe/hands`：本地手部关键点识别。
- `Playwright`：本地截图验证。

## 本地运行

安装依赖：

```bash
npm install
```

启动开发服务器：

```bash
npm run dev
```

浏览器打开：

```text
http://localhost:5173
```

如果需要让局域网内的其他设备访问，可以使用：

```bash
npm run dev:host
```

建议使用 Chrome 或 Edge，并在浏览器弹窗中允许摄像头权限。摄像头画面只在本地浏览器中交给 MediaPipe 做手势识别，不会上传到服务器。不要直接双击打开 `index.html`，也不要用 `dist/index.html` 的本地文件路径打开。

## 手势操作

1. 打开页面后，先看左侧面板底部的视频预览，确认能看到摄像头画面。
2. 把完整手掌放进预览框，手掌正对摄像头，手腕和五根手指尽量都入镜。
3. 单手张开时，粒子会扩散并变亮。
4. 单手收拢或握拳时，粒子会聚回模型。
5. 保持单手握拳并旋转拳头时，会进入拳头视角控制：
   - 旋转拳头：控制水平环绕视角。
   - 上下移动拳头：控制俯仰视角。
   - 松开拳头或张开手：恢复普通鼠标视角控制。
6. 双手同时入镜时，双手距离越远，整体扩散越明显；双手靠近会收拢。
7. 鼠标拖动画面可以旋转视角，滚轮可以缩放。
8. 按住 Shift 并拖动鼠标，可以在没有手势时局部扰动粒子。

## 控制面板

左侧控制面板包含：

- 摄像头/识别状态。
- 识别诊断信息。
- 模型选择。
- 粒子颜色选择。
- 自动画质档位。
- 手势张合百分比。
- 摄像头预览画面。
- 全屏按钮。
- 移动端默认折叠的设置面板。

诊断信息可以帮助判断当前问题在哪里。如果显示 `识别到 1 只手` 或 `识别到 2 只手`，说明手势识别已经成功；如果一直显示 `尚未识别到手`，说明摄像头画面里没有被 MediaPipe 识别出完整手掌。

## 画质策略

项目会在启动时根据设备和窗口尺寸自动选择粒子数量：

- 桌面端默认使用约 `76k` 粒子，比旧版更细腻。
- 移动端默认使用约 `44k` 粒子，减少发热和掉帧。
- 高 DPR 的平板或中等设备会使用约 `62k` 粒子的均衡档。

可以通过 URL 强制指定画质：

```text
http://localhost:5173/?quality=compact
http://localhost:5173/?quality=balanced
http://localhost:5173/?quality=desktop
http://localhost:5173/?quality=ultra
```

## 项目结构

```text
.
├─ index.html
├─ package.json
├─ README.md
├─ start.bat
├─ public/
│  └─ mediapipe/
│     └─ hands/
├─ scripts/
│  └─ verify.mjs
└─ src/
   ├─ config.js
   ├─ gestures.js
   ├─ lighting.js
   ├─ main.js
   ├─ particles.js
   ├─ shapes.js
   ├─ styles.css
   └─ ui.js
```

核心文件说明：

- `src/main.js`：Three.js 场景组装、主循环、摄像头初始化和事件绑定。
- `src/particles.js`：粒子缓冲区、Shader、预计算数据和粒子动画更新。
- `src/shapes.js`：爱心、花朵、土星、佛像、烟花等粒子模型的目标点生成。
- `src/gestures.js`：手部张合、掌心位置和拳头视角控制所需的手势计算。
- `src/lighting.js`：背景柔光、光源颜色和呼吸动画。
- `src/ui.js`：面板缩放、移动端折叠、状态文字和手势百分比。
- `src/styles.css`：页面布局和控制面板样式。
- `index.html`：页面结构。
- `public/mediapipe/hands`：MediaPipe Hands 的本地模型和 wasm 资源。
- `scripts/verify.mjs`：使用 Playwright 进行桌面和移动端截图验证。
- `start.bat`：Windows 下的一键启动脚本。

## 可用脚本

启动开发环境：

```bash
npm run dev
```

启动局域网可访问的开发环境：

```bash
npm run dev:host
```

构建生产版本：

```bash
npm run build
```

预览生产构建：

```bash
npm run preview
```

局域网预览生产构建：

```bash
npm run preview:host
```

运行截图验证：

```bash
npm run verify
```

完整检查：

```bash
npm run check
```

`npm run verify` 会在 `5173` 没有服务时自动启动开发服务器，并生成：

```text
verification-desktop.png
verification-mobile.png
```

这些截图用于检查页面是否能正常渲染。验证脚本还会检查 WebGL canvas 不是空画面，并捕获控制台错误和资源 404；它使用的是假摄像头，不能代表真实手势识别效果。

## 常见问题

### 摄像头无法使用

请确认：

- 使用的是 `http://localhost:5173`。
- 浏览器允许了摄像头权限。
- 摄像头没有被其他软件占用。
- 不要直接用本地文件路径打开页面。

浏览器通常只允许 `localhost` 或 HTTPS 页面访问摄像头。普通局域网 HTTP 地址可能会被拦截。

### 一直识别不到手

可以尝试：

- 让手离摄像头远一点，保证完整手掌入镜。
- 避免只露出手指或半只手。
- 保持光线充足，避免逆光。
- 手掌正对摄像头。
- 刷新页面后重新授权摄像头。

### 显示识别到了手，但粒子不明显变化

检查左侧的手势张合百分比。如果百分比变化很小，说明当前手势幅度不够明显。尝试更夸张地张开手掌或握拳。

### MediaPipe 模型加载失败

确认 `public/mediapipe/hands` 目录存在，并且里面的 `.wasm`、`.tflite`、`.binarypb` 文件没有被删除。这些资源用于本地手势识别。

### 页面空白或控制台报错

先运行：

```bash
npm run build
```

如果构建失败，根据终端输出修复错误。构建成功后再重新启动开发服务器。

## 开发提示

- 粒子数量和画质档位在 `src/config.js` 中调整；桌面端默认保留较高粒子密度。
- 粒子模型目标点在 `src/shapes.js` 中调整。
- 粒子运动和扩散响应主要在 `src/particles.js` 的 `updateParticles` 中调整。
- 手势张合算法在 `src/gestures.js` 中调整。
- MediaPipe 文件路径由 `locateFile` 指向 `public/mediapipe/hands`。
- MediaPipe 使用动态导入，打包时会拆成独立 chunk。
- 背景光源是基于时间的柔和动态效果，不受手势影响。
- 手势识别结果会通过左侧诊断信息显示，调试交互时可以先看诊断文字。
