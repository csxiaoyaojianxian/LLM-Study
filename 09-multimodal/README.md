# 09-multimodal — 多模态应用

> 多模态 AI 应用开发：Vision 图片理解、DALL-E 图片生成、TTS 语音合成、Whisper 语音识别

## 概述

本模块演示如何使用 Vercel AI SDK v6 构建多模态 AI 应用，涵盖视觉、语音等非文本模态的处理能力。

## 核心能力

| 能力 | API | 模型 | 说明 |
| --- | --- | --- | --- |
| 图片理解 | `generateText()` + ImagePart | gpt-4o / claude-3.5-sonnet | 分析图片内容 |
| 图片生成 | `generateImage()` | dall-e-3 | 文本生成图片 |
| 语音合成 | `generateSpeech()` | tts-1 / tts-1-hd | 文本转语音 |
| 语音识别 | `transcribe()` | whisper-1 | 语音转文本 |

## 环境准备

```bash
cd 09-multimodal
cp .env.example .env   # 填入 API Key
npm install
```

**API Key 要求：**
- Vision: OpenAI (`gpt-4o`) 或 Anthropic (`claude-3.5-sonnet`)
- DALL-E / TTS / Whisper: **必须 OpenAI API Key**

## 运行 Demo

```bash
npm run vision            # 图片理解（Vision）
npm run image-gen         # 图片生成（DALL-E 3）
npm run speech            # 语音合成（TTS）
npm run transcription     # 语音识别（Whisper）
npm run multimodal-chat   # 多模态综合演示
```

## Demo 内容

### vision.ts — 图片理解
1. 多模态 LLM 与 Vision 概念讲解
2. 本地图片分析 — 代码生成 SVG → base64 → LLM 分析
3. URL 图片分析 — 通过公开 URL 发送网络图片
4. 多图对比 — 同时发送两张图，LLM 比较差异

### image-gen.ts — 图片生成
1. 文生图原理与 DALL-E 3 介绍
2. 基础图片生成 — 生成 1024×1024 图片
3. 不同尺寸对比 — 正方形 / 横版 / 竖版
4. 图片保存与使用指南

### speech.ts — 语音合成
1. TTS 技术与 OpenAI 语音模型介绍
2. 基础语音合成 — alloy 音色
3. 不同音色对比 — alloy / echo / nova
4. 中文语音合成测试

### transcription.ts — 语音识别
1. STT/ASR 技术与 Whisper 模型介绍
2. TTS→STT 闭环验证 — 合成语音后再识别回文字
3. 转录结果分析 — segments 时间戳

### multimodal-chat.ts — 多模态综合
1. 多模态应用架构概览
2. 图文问答闭环 — DALL-E 生成 → Vision 分析 → LLM 总结
3. 语音对话闭环 — TTS → STT → LLM 回答 → TTS 输出

## 输出文件

生成的图片和音频保存在 `output/` 目录：
- `basic-generation.png` — DALL-E 生成的图片
- `size-*.png` — 不同尺寸的图片
- `basic-tts.mp3` — 基础 TTS 输出
- `voice-*.mp3` — 不同音色的语音
- `chinese-tts.mp3` — 中文语音
- `roundtrip-audio.mp3` — 闭环测试音频
- `multimodal-qa.png` — 综合演示生成的图片
- `voice-chat-*.mp3` — 语音对话音频

## 技术栈

- **AI SDK v6** — `generateText` / `generateImage` / `generateSpeech` / `transcribe`
- **@ai-sdk/openai** — DALL-E 3 / TTS / Whisper / GPT-4o Vision
- **@ai-sdk/anthropic** — Claude Vision（备选）
