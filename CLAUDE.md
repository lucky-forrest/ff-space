# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 技术栈

- **框架**: Vue 3 + TypeScript
- **构建工具**: Vite
- **样式**: TailwindCSS v4
- **包管理**: npm

## 常用命令

```bash
npm run dev        # 启动开发服务器
npm run build      # 类型检查 + 生产构建
npm run preview    # 预览生产构建
```

## 项目结构

```
src/
├── main.ts          # 入口文件，挂载 Vue 应用
├── App.vue          # 根组件
├── style.css        # 全局样式（TailwindCSS 入口）
├── assets/          # 静态资源（图片等）
└── components/      # Vue 组件
```

## 编码规范

- 组件文件名：PascalCase（如 `UserProfile.vue`）
- Vue SFC 使用 `<script setup lang="ts">` 语法
- 优先使用 Composition API，避免 Options API
- 类型定义优先使用 `type` 而非 `interface`
- 禁止使用 `any`
- TailwindCSS v4 使用 `@import 'tailwindcss'` 引入，无需 `tailwind.config.js`
- 自定义主题通过 CSS 变量在 `@theme` 块中定义

## TailwindCSS v4 注意事项

- 无需 `tailwind.config.js`，配置通过 CSS `@theme` 指令完成
- 自定义颜色、字体等直接在 `style.css` 中通过 `@theme` 定义
- 插件通过 `@plugin` 指令引入
