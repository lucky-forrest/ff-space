"""
DeerFlow 多智能体工作流 - 文案生成

DeerFlow 核心理念：
将复杂任务拆解为多个子任务，每个子任务由一个独立的 Agent（智能体）负责。
Agent 之间通过共享 State（状态）传递数据，由 StateGraph（状态图）编排执行顺序。

本文案工作流包含 2 个 Agent：
1. Analyze Agent（分析器）：负责分析图片内容
   - 输入：base64 图片数组
   - 输出：物体列表、颜色、情感氛围、场景类型、主体描述
   - 相当于 DeerFlow 的 Researcher Agent

2. Copy Agent（文案生成器）：负责根据分析结果生成文案
   - 输入：分析结果 + 风格要求
   - 输出：标题、正文、标签、BGM 推荐、神评
   - 相当于 DeerFlow 的 Reporter Agent

完整 DeerFlow 工作流通常还包括：
- Planner（规划器）：将用户需求拆解为可执行的步骤计划
- Coder（代码执行器）：在沙箱中运行 Python 代码
- Coordinator（协调器）：管理整个工作流的生命周期

本实现简化为 Analyze -> Copy 两阶段流程，便于学习理解核心概念。
"""

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END
from typing import TypedDict, Optional

from src.config import settings
from src.models import ImageAnalysisInput


class WorkflowState(TypedDict):
    """
    工作流状态定义

    TypedDict 定义了在整个工作流中传递的数据结构。
    每个 Agent 节点接收当前状态，处理后返回更新后的状态。

    字段说明：
    - images: 原始输入，base64 图片数组
    - style_name/description/sample: 文案风格信息
    - analysis: 外部传入的已有分析结果（可选，传入则跳过 Analyze 阶段）
    - analysis_result: Analyze Agent 的输出
    - copy_result: Copy Agent 的输出（最终结果）
    """
    images: list[str]
    style_name: str
    style_description: str
    style_sample: str
    analysis: Optional[ImageAnalysisInput]
    analysis_result: str
    copy_result: dict


def _get_llm() -> ChatOpenAI:
    """
    获取 LLM 实例

    使用 ChatOpenAI 是因为 DashScope 支持 OpenAI 兼容的 API 格式。
    LangChain 的 ChatOpenAI 底层会发送 HTTP 请求到 base_url，
    支持任何兼容 OpenAI API 规范的服务（DashScope、Ollama、LocalAI 等）。

    常用参数：
    - model: 模型名称（qwen-plus、gpt-4、claude-3-5 等）
    - temperature: 创造性程度（0=确定性，1=最大创造性）
    - base_url: API 地址
    - api_key: 认证密钥
    """
    return ChatOpenAI(
        model=settings.api_model,
        api_key=settings.api_key,
        base_url=settings.api_base_url,
        temperature=0.7,
    )


def analyze_images(state: WorkflowState) -> WorkflowState:
    """
    Analyze Agent：分析图片内容

    这是 DeerFlow 工作流中的第一个节点。
    在多智能体架构中，每个 Agent 是一个独立的 LLM 调用，有自己的 System Prompt。

    工作原理：
    1. 将 base64 图片转为 LLM 可接受的格式（image_url block）
    2. 构建 System Prompt，要求 LLM 以 JSON 格式返回分析结果
    3. 调用 LLM，等待响应
    4. 将结果存入 state["analysis_result"]，传递给下一个节点

    DeerFlow 中的等价物：Researcher Agent + Web Search Tool
    （完整 DeerFlow 还会调用搜索引擎获取实时信息）
    """
    llm = _get_llm()

    # 构建多模态消息：将 base64 图片转为 OpenAI 格式
    # 最多处理 20 张图片（大多数 LLM 的视觉输入上限）
    image_blocks = []
    for img_url in state["images"][:20]:
        image_blocks.append({"type": "image_url", "image_url": {"url": img_url}})

    # 添加文字指令
    file_count = len(state["images"])
    prompt = f"请分析以下{file_count}张图片，返回JSON：objects(数组),colors(数组),mood(字符串),scene(字符串),mainSubject(字符串)"
    if file_count > 1:
        prompt += ",relationships(描述图片之间的关系)"

    image_blocks.append({"type": "text", "text": prompt})

    # 构建消息列表
    messages = [
        SystemMessage(content="你是专业的图片分析专家。返回纯JSON，不要添加markdown代码块。"),
        HumanMessage(content=image_blocks),
    ]

    # 调用 LLM 并存储结果
    response = llm.invoke(messages)
    state["analysis_result"] = response.content
    return state


def generate_copy(state: WorkflowState) -> WorkflowState:
    """
    Copy Agent：根据分析结果和风格生成文案

    这是 DeerFlow 工作流中的第二个节点。
    它接收上一步 Analyze Agent 的输出作为输入。

    工作原理：
    1. 读取上一步的分析结果（可能是 ImageAnalysisInput 对象或纯文本）
    2. 将分析结果格式化为文字描述
    3. 构建 System Prompt，包含文案生成要求和风格指导
    4. 调用 LLM，要求返回 JSON 格式的完整文案
    5. 将结果存入 state["copy_result"]

    DeerFlow 中的等价物：Reporter Agent
    （完整 DeerFlow 的 Reporter 还会综合搜索结果、代码执行结果等）
    """
    llm = _get_llm()

    # 获取分析结果（可能来自 Analyze Agent 或外部传入）
    analysis = state.get("analysis")
    if not analysis:
        analysis = state.get("analysis_result", "")

    # 格式化为文字描述
    analysis_text = ""
    if isinstance(analysis, ImageAnalysisInput):
        analysis_text = (
            f"图片分析结果：\n"
            f"- 主要物体：{', '.join(analysis.objects) if analysis.objects else '未知'}\n"
            f"- 主要颜色：{', '.join(analysis.colors) if analysis.colors else ''}\n"
            f"- 情感氛围：{analysis.mood}\n"
            f"- 场景类型：{analysis.scene}\n"
            f"- 主要主体：{analysis.main_subject}\n"
        )
        if analysis.relationships:
            analysis_text += f"- 图片关系：{analysis.relationships}\n"
    else:
        analysis_text = str(analysis)

    # 风格指导
    style_instruction = (
        f"请以「{state['style_name']}」风格生成文案。"
        f"{state['style_description']}。"
    )

    # System Prompt：定义文案生成的详细要求
    system_prompt = f"""你是一位精通抖音短视频运营的文案专家。请根据图片分析结果，为抖音短视频生成文案。

文案要求：
- 标题：5-15字，抓人眼球
- 正文：20-50字，口语化，有互动感
- 话题标签：3-5个热门相关标签
- BGM推荐：2-3首，每首指明推荐使用的片段时间（秒）
- 神评推荐：10条，10-25字，有网感

{style_instruction}

请严格按以下JSON格式返回（不要添加markdown代码块）：
{{
  "title": "标题文本",
  "content": "正文文案",
  "hashtags": ["#话题1", "#话题2"],
  "musicSuggestions": [
    {{"name": "歌曲名", "startTime": 0, "endTime": 15}}
  ],
  "viralComments": ["神评1", "神评2"]
}}"""

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=analysis_text),
    ]

    response = llm.invoke(messages)
    state["copy_result"] = response.content
    return state


def build_workflow() -> StateGraph:
    """
    构建 DeerFlow 风格的多智能体工作流

    StateGraph 是 LangGraph 的核心类，相当于 DeerFlow 的工作流引擎。
    它定义了：
    1. 有哪些 Agent（节点）
    2. Agent 之间的执行顺序（边）
    3. 条件分支（可选，如根据分析结果决定走哪条路径）

    构建步骤：
    1. 创建 StateGraph，指定状态类型
    2. 添加节点：每个节点是一个 Agent 函数
    3. 设置入口点：工作流从哪个节点开始
    4. 添加边：定义节点之间的连接关系
    5. 调用 compile()：编译为可执行的工作流对象

    DeerFlow 完整架构会包含更多节点和条件分支：
    - Coordinator -> Planner -> [Researcher | Coder] -> Reporter
    - 根据 Planner 的计划，条件边决定执行 Researcher 还是 Coder
    """
    workflow = StateGraph(WorkflowState)

    # 添加 Agent 节点（每个节点是一个函数，接收 state，返回更新后的 state）
    workflow.add_node("analyze", analyze_images)   # Analyze Agent
    workflow.add_node("generate", generate_copy)   # Copy Agent

    # 设置工作流入口点
    workflow.set_entry_point("analyze")

    # 编排执行流程：分析 -> 生成 -> 结束
    workflow.add_edge("analyze", "generate")       # Analyze 完成后执行 Generate
    workflow.add_edge("generate", END)             # Generate 完成后工作流结束

    # 编译为可执行的工作流
    return workflow.compile()
