"""
数据模型定义

使用 Pydantic BaseModel 定义 API 的请求和响应数据结构。
Pydantic 的作用：
1. 类型检查：自动验证请求数据格式
2. 序列化：将 Python 对象转为 JSON
3. 文档生成：FastAPI 自动生成 OpenAPI/Swagger 文档

与 DeerFlow 的关系：
DeerFlow 内部使用 Pydantic 模型定义 Agent 的输入输出 schema，
LangGraph 的 StateGraph 也支持用 Pydantic 定义状态结构。
"""

from pydantic import BaseModel


class ImageAnalysisInput(BaseModel):
    """
    图片分析结果模型

    对应前端 aiCopyService.ts 的 ImageAnalysisResult 接口。
    前端可以将已有的分析结果直接传给后端，跳过 Analyze 阶段。

    字段说明：
    - objects: 图片中的主要物体列表
    - colors: 主要颜色列表
    - mood: 情感氛围描述
    - scene: 场景类型
    - main_subject: 最主要的主体
    - relationships: 多张图片之间的关系描述
    """
    objects: list[str] = []
    colors: list[str] = []
    mood: str = "未知"
    scene: str = "未知"
    main_subject: str = "未知主体"
    relationships: str = ""


class CopyRequest(BaseModel):
    """
    文案生成请求模型

    前端 POST /api/generate-copy 的请求体格式。
    字段与前端 MediaFile 和 CopyStyle 对应。
    """
    images: list[str]             # base64 data URL 数组
    style_id: str = "trending"   # 风格 ID
    style_name: str = "热门趋势"  # 风格名称
    style_description: str = "紧跟最新热点话题"  # 风格描述
    analysis: ImageAnalysisInput | None = None  # 已有分析结果（可选）


class MusicSuggestion(BaseModel):
    """
    BGM 音乐推荐模型

    与前端 src/types/music.ts 中的 MusicSuggestion 接口对应。
    注意字段命名：后端使用 snake_case（Python 规范），前端使用 camelCase（JS 规范）。
    """
    name: str
    start_time: float = 0
    end_time: float = 15


class CopyResponse(BaseModel):
    """
    文案生成响应模型

    对应前端 aiCopyService.ts 的 CopyResult 接口（不含 id 和 createdAt）。
    字段使用 snake_case，前端需要做字段名映射。

    字段说明：
    - title: 文案标题
    - content: 正文文案
    - hashtags: 话题标签列表
    - music_suggestions: BGM 推荐列表
    - viral_comments: 神评推荐列表
    - style: 使用的文案风格
    """
    title: str
    content: str
    hashtags: list[str]
    music_suggestions: list[MusicSuggestion]
    viral_comments: list[str]
    replies: list[str]
    style: str
