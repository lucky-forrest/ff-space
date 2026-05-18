# 短视频爆款文案生成器

上传图片或视频素材，AI 智能分析内容并生成多风格抖音文案（标题 + 正文 + 标签 + BGM 推荐）。

## 功能特点

- 支持图片和视频素材上传（最多 10 个）
- AI 智能分析图片/视频内容（物体、颜色、情感、场景）
- 一次生成 5 种风格文案（热门趋势、情感共鸣、幽默搞笑、知识分享、励志鼓舞）
- 支持编辑和复制文案
- 支持重新生成特定风格
- 全屏单页布局，无菜单无滚动

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 API Key

复制 `.env.example` 为 `.env.local`：

```bash
cp .env.example .env.local
```

编辑 `.env.local`，填入你的阿里云百炼 DashScope API Key：

```
VITE_DASHSCOPE_API_KEY=sk-...
VITE_API_PROXY_URL=https://dashscope.aliyuncs.com
```

获取 API Key：https://bailian.console.aliyun.com/

### 3. 启动开发服务器

```bash
npm run dev
```

### 4. 构建

```bash
npm run build      # 类型检查 + 生产构建
npm run preview    # 预览生产构建
```

## 技术栈

- Vue 3 + TypeScript
- Vite
- TailwindCSS v4
- 阿里云百炼 Qwen 模型 (AI 图片分析 + 文案生成)
