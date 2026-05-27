# Show Presets

这个目录用于放可随应用一起打包的演出 JSON。新增演出时：

1. 复制 `stellar-heart-live.json` 的结构。
2. 在 JSON 中设置唯一 `id`、显示用 `label` 和 `steps`。
3. 在 `index.js` 中 import 并加入 `SHOW_PRESET_LIBRARY`。

运行中的用户也可以在面板里通过“文件”按钮导入任意同结构 JSON，不需要重新构建项目。

常用 step 字段：

- `label`、`duration`
- `theme`、`background`、`model`、`text`
- `modelBrightness`、`backgroundBrightness`、`imageBrightness`、`imageSize`
- `camera`、`cameraDuration`
- `burst`、`freeze`
