# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目结构

```
/
├── frontend/          # Vue 3 前端项目
│   ├── src/
│   │   ├── main.ts          # 入口文件
│   │   ├── App.vue          # 根组件
│   │   ├── style.css        # 全局样式
│   │   ├── assets/          # 静态资源
│   │   └── components/      # Vue 组件
│   ├── android/             # Capacitor Android 原生项目
│   ├── package.json
│   └── vite.config.ts
├── backend/           # Python 后端服务（DeerFlow 多智能体）
│   └── ...
└── .gitignore
```

## 前端 (frontend/)

### 技术栈

- **框架**: Vue 3 + TypeScript
- **构建工具**: Vite
- **样式**: TailwindCSS v4
- **包管理**: npm
- **移动端打包**: Capacitor

### 常用命令

```bash
cd frontend && npm run dev        # 启动开发服务器
cd frontend && npm run build      # 类型检查 + 生产构建
cd frontend && npm run preview    # 预览生产构建
```

### 编码规范

- 组件文件名：PascalCase（如 `UserProfile.vue`）
- Vue SFC 使用 `<script setup lang="ts">` 语法
- 优先使用 Composition API，避免 Options API
- 类型定义优先使用 `type` 而非 `interface`
- 禁止使用 `any`
- TailwindCSS v4 使用 `@import 'tailwindcss'` 引入，无需 `tailwind.config.js`
- 自定义主题通过 CSS 变量在 `@theme` 块中定义

### TailwindCSS v4 注意事项

- 无需 `tailwind.config.js`，配置通过 CSS `@theme` 指令完成
- 自定义颜色、字体等直接在 `style.css` 中通过 `@theme` 定义
- 插件通过 `@plugin` 指令引入

## 后端 (backend/)

- **框架**: Python FastAPI
- **多智能体**: DeerFlow 理念
- **包管理**: pip + venv
