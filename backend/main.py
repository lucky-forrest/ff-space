"""
DeerFlow 后端服务入口

架构说明：
DeerFlow 是字节跳动开源的多智能体编排框架（SuperAgent Harness）。
本后端基于 DeerFlow 理念构建，使用 LangGraph + LangChain 实现多智能体协作。

核心概念：
1. StateGraph（状态图）：DeerFlow 的工作流本质是一个有向图，每个节点是一个智能体
2. Agent（智能体）：独立的 LLM 调用单元，负责特定子任务（如分析、生成、研究）
3. State（状态）：在工作流节点间传递的数据结构
4. Edges（边）：定义智能体之间的执行顺序和条件分支

本文案生成工作流：
[入口] -> Analyze Agent（分析图片） -> Copy Agent（生成文案） -> [END]

前端（Vue 3）通过 HTTP POST /api/generate-copy 调用此服务，
服务内部通过 LangGraph 编排多个智能体协作完成文案生成。

依赖：
- FastAPI：Python 高性能 Web 框架
- LangGraph：状态图工作流编排库（DeerFlow 的核心）
- LangChain：LLM 抽象层，统一不同模型 API 调用
- LangChain OpenAI：兼容 OpenAI API 格式的适配器（DashScope 支持此格式）
"""

import json
import re
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from src.config import settings
from src.models import CopyRequest, CopyResponse, MusicSuggestion
from src.workflow.copywriter import build_workflow


def parse_copy_json(raw: str) -> dict:
    """
    解析 LLM 返回的 JSON 响应

    LLM 有时会返回带 markdown code fence 的 JSON，如：
    ```json
    {"title": "..."}
    ```
    需要去除 fence 后再解析。
    """
    cleaned = raw.strip()
    match = re.match(r"^```(?:json)?\s*\n([\s\S]*?)\n```$", cleaned)
    if match:
        cleaned = match.group(1)
    return json.loads(cleaned)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI 生命周期钩子
    应用启动时编译 LangGraph 工作流，关闭时清理资源
    """
    # 构建并编译工作流（相当于 DeerFlow 的 workflow.compile()）
    app.state.workflow = build_workflow()
    yield


# 创建 FastAPI 应用实例
app = FastAPI(
    title="DeerFlow Copywriter Backend",
    description="基于 DeerFlow 多智能体编排的短视频文案生成后端",
    version="0.1.0",
    lifespan=lifespan,
)

# 配置 CORS，允许前端（Vite dev server）跨域请求
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    """健康检查端点"""
    return {"status": "ok"}


@app.post("/api/generate-copy")
async def generate_copy(req: CopyRequest):
    """
    文案生成端点（核心 API）

    请求体：
    - images: base64 图片数组
    - style_id/style_name/style_description: 文案风格信息
    - analysis: 已有的图片分析结果（可选，传入则跳过分析步骤）

    响应：SSE 流式返回 CopyResponse JSON

    DeerFlow 工作流程说明：
    1. 前端上传图片 + 风格要求
    2. Analyze Agent 分析图片内容（物体、颜色、情感、场景）
    3. Copy Agent 根据分析结果 + 风格要求生成完整文案
    4. 返回标题、正文、标签、BGM 推荐、神评
    """
    workflow = app.state.workflow

    # 构建工作流初始状态
    initial_state = {
        "images": req.images,
        "style_name": req.style_name,
        "style_description": req.style_description,
        "style_sample": "",
        "analysis": req.analysis,
        "analysis_result": "",
        "copy_result": {},
    }

    async def event_stream():
        """SSE 事件流生成器"""
        loop = asyncio.get_event_loop()
        # 在工作线程中运行工作流（避免阻塞事件循环）
        result = await loop.run_in_executor(None, lambda: workflow.invoke(initial_state))

        # 解析 Copy Agent 的输出
        raw = result.get("copy_result", "")
        try:
            parsed = parse_copy_json(raw)
        except (json.JSONDecodeError, AttributeError):
            yield f"data: {json.dumps({'error': '文案生成失败，请重试'})}\n\n"
            return

        # 构建标准响应
        viral_comments_list = parsed.get("viralComments", ["神评生成中..."])[:10]
        replies_list = parsed.get("replies", [])[:20]

        # LLM 可能未返回 replies，基于神评自动生成回复
        if not replies_list:
            reply_templates = [
                "哈哈，说到心坎里了",
                "承蒙厚爱，继续加油",
                "同道中人，一起坚持",
                "过奖了，还在摸索中",
                "感谢支持，慢慢来比较稳",
                "确实如此，深有体会",
                "被你一说，突然有画面了",
                "这话说得太到位了",
                "同感，一起加油",
                "谢谢鼓励，会继续分享的",
            ]
            replies_list = reply_templates[:min(len(viral_comments_list), len(reply_templates))]
            # 补齐到20条
            while len(replies_list) < 20:
                replies_list.append("感谢关注，一起进步")

        response = CopyResponse(
            title=parsed.get("title", "精彩瞬间"),
            content=parsed.get("content", "值得一看的精彩瞬间"),
            hashtags=parsed.get("hashtags", ["#精彩瞬间"]),
            music_suggestions=[
                MusicSuggestion(
                    name=m.get("name", f"歌曲{i+1}"),
                    start_time=m.get("startTime", 0),
                    end_time=m.get("endTime", 15),
                )
                for i, m in enumerate(parsed.get("musicSuggestions", [])[:3])
            ] or [MusicSuggestion(name="抖音热歌")],
            viral_comments=viral_comments_list,
            replies=replies_list,
            style=req.style_name,
        )

        # SSE 格式发送数据
        yield f"data: {json.dumps(response.model_dump(), ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
