# 荨麻疹科普视频（Canvas 2D + Gemini TTS + 中文字幕）

一段约 2 分钟的荨麻疹健康科普动画。所有画面都用**纯 JavaScript 在 Canvas 2D 上实时绘制**，不依赖任何图片素材或框架。旁白由 **Gemini TTS** 合成，中文字幕同时烧录进画面，也单独导出为 SRT/VTT 文件。

内容依据：南方医科大学珠江医院皮肤科《荨麻疹类皮肤病》课件，并结合通用皮肤科科普知识整理。

## 分镜

| # | 章节 | 画面 |
|---|------|------|
| 1 | 认识荨麻疹 | 皮肤上风团冒出又消退，揭晓“荨麻疹 / 风疹块” |
| 2 | 发病机制 | 皮肤剖面：过敏原激活肥大细胞 → 释放组胺 → 血管扩张渗漏 → 真皮浅层水肿隆起成风团 |
| 3 | 常见诱因 | 食物、感染、药物、其他因素四张卡片 |
| 4 | 临床特点 | 风团此起彼伏；大小不一、形状不规则、周围红晕；24 小时内消退不留痕迹 |
| 5 | 常见分型 | 6 周时间轴区分急性 / 慢性；划痕症、寒冷性、日光性、胆碱能性 |
| 6 | 危险信号 | 喉头水肿示意，症状清单，“立即拨打 120” |
| 7 | 规范治疗 | 治疗原则；第二代抗组胺药阻断 H1 受体；足疗程；激素与生物制剂 |
| 8 | 日常护理 | 避开诱因、宽松衣物、不烫不抓；片尾提示与免责声明 |

## 目录

```
index.html            播放器（直接双击打开即可，支持 file://）
src/narration.js      旁白 / 字幕脚本（29 句，8 个场景）
src/timeline.js       时间轴：按真实配音时长（或估算语速）排布每句话
src/draw.js           绘图工具：缓动、确定性随机、风团、皮肤、图标
src/scenes.js         8 个场景的绘制函数（纯函数，任意时刻可重绘）
src/player.js         渲染循环、字幕、章节标记、音频同步、播放控制
tools/tts.mjs         调用 Gemini TTS 逐句配音并拼接 narration.wav
tools/subtitles.mjs   生成 subtitles/zh-CN.srt 与 .vtt
tools/export.mjs      无头 Chromium 逐帧渲染 + ffmpeg 合成 MP4
tools/preview.mjs     渲染关键帧 PNG 便于检查画面
audio/                配音输出（生成后出现）
subtitles/            中文字幕
```

## 使用

```bash
npm install                      # 仅安装 playwright（导出用）

# 1) 生成配音（需要 Gemini API Key）
export GEMINI_API_KEY=你的密钥
npm run tts                      # 自动选择 Gemini 3.8 的 TTS 模型；也可用 GEMINI_TTS_MODEL 指定
#   GEMINI_TTS_VOICE=Kore        # 可换其他预置音色
#   node tools/tts.mjs --only c05  # 只重录某一句

# 2) 预览：直接打开 index.html（空格播放/暂停，←/→ 快退/快进 5 秒，“字幕”按钮切换字幕）

# 3) 导出 MP4
npm run export                   # dist/urticaria.mp4，字幕烧录
node tools/export.mjs --soft-subs  # 改为可开关的中文字幕轨
```

未生成配音时，播放器和导出都会按估算语速静音运行，字幕照常显示。配音生成后，时间轴自动按每句真实时长重新排布，画面动画随之对齐，字幕文件也会同步更新。

导出需要 ffmpeg：会依次查找 `FFMPEG_PATH`、系统 `ffmpeg`、`pip install imageio-ffmpeg` 提供的二进制。

## 说明

本视频仅用于健康科普，不能替代医生的面诊与处方。
