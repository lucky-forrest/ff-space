# DeerFlow Copywriter Backend

基于 DeerFlow 理念的短视频文案生成后端服务。

## 架构概览

```
前端 (Vue 3) ──HTTP/SSE──▶ 后端 (FastAPI + LangGraph) ──API──▶ LLM (DashScope)
                                │
                        ┌───────┴───────┐
                        │  StateGraph   │
                        │  ┌─────────┐  │
                        │  │Analyze  │  │  ← 分析图片内容（物体/颜色/情感）
                        │  └────┬────┘  │
                        │       ▼       │
                        │  │  Copy   │  │  ← 根据分析结果生成文案
                        │  └────┬────┘  │
                        │       ▼       │
                        │  ┌─────────┐  │
                        │  │  END    │  │
                        │  └─────────┘  │
                        └───────────────┘
```

## 快速开始

### 1. 环境要求

- **Python 3.12+**（DeerFlow 要求）
- uv（包管理器）或 pip

### 2. 安装依赖

```bash
cd backend
uv pip install -r requirements.txt
```

### 3. 配置

```bash
cp .env.example .env
# 编辑 .env 文件，填写你的 DashScope API Key
```

### 4. 启动服务

```bash
uvicorn main:app --reload --port 8000
```

服务启动后访问 http://localhost:8000/docs 查看自动生成的 API 文档。

### 5. 前端配置

在前端项目根目录创建 `.env.local`：

```
# 启用 DeerFlow 模式
VITE_USE_DEERFLOW=true
# DeerFlow 后端地址
VITE_DEERFLOW_URL=http://localhost:8000
```

## 学习 DeerFlow 核心概念

### StateGraph（状态图）

DeerFlow 的工作流本质是一个**有向图**：

- **节点 (Node)**：每个节点是一个 Agent（智能体），负责特定子任务
- **边 (Edge)**：定义节点之间的执行顺序
- **状态 (State)**：在节点间传递的数据

```python
workflow = StateGraph(WorkflowState)
workflow.add_node("analyze", analyze_images)  # 添加节点
workflow.add_node("generate", generate_copy)
workflow.set_entry_point("analyze")           # 设置入口
workflow.add_edge("analyze", "generate")      # 定义顺序
workflow.add_edge("generate", END)            # 结束
app = workflow.compile()
```

### Agent（智能体）

每个 Agent 是一个纯函数，接收当前状态，返回更新后的状态：

```python
def analyze_images(state: WorkflowState) -> WorkflowState:
    llm = _get_llm()
    response = llm.invoke(messages)
    state["analysis_result"] = response.content  # 写入状态
    return state
```

### 扩展方向

完整 DeerFlow 包含更多能力：

| 能力 | 说明 | 本文档实现 |
|------|------|-----------|
| Planner | 将用户需求拆解为执行计划 | 未实现（文案任务不需要） |
| Researcher | 搜索网络获取实时信息 | 简化为图片分析 |
| Coder | 沙箱中执行 Python 代码 | 未实现 |
| Memory | 长期/短期记忆 | 未实现 |
| Sub-agents | 嵌套子智能体 | 未实现 |

## 文件结构

```
backend/
├── main.py              # FastAPI 入口，定义 API 端点
├── requirements.txt     # Python 依赖
├── .env.example         # 配置模板
└── src/
    ├── config.py        # 配置管理（环境变量 + .env）
    ├── models.py        # 数据模型（Pydantic）
    └── workflow/
        └── copywriter.py  # 多智能体工作流定义
```

## API 端点

### POST /api/generate-copy

生成文案。

**请求体：**
```json
{
  "images": ["data:image/png;base64,..."],
  "style_id": "trending",
  "style_name": "热门趋势",
  "style_description": "紧跟最新热点话题"
}
```

**响应：** SSE 流式返回
```json
{
  "title": "...",
  "content": "...",
  "hashtags": ["#话题1"],
  "music_suggestions": [{"name": "...", "start_time": 0, "end_time": 15}],
  "viral_comments": ["..."],
  "style": "热门趋势"
}
```

### GET /health

健康检查。
