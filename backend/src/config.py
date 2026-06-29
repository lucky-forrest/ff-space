"""
DeerFlow 后端配置模块

使用 pydantic-settings 管理环境变量，支持 .env 文件和系统环境变量两种方式。

配置加载优先级：
1. 系统环境变量（最高优先级）
2. .env 文件
3. 默认值

环境变量命名规则：
- 使用 DEERFLOW_ 前缀避免冲突
- 下划线转大写，如 DEERFLOW_API_KEY -> settings.api_key

与 DeerFlow 原版的关系：
DeerFlow 使用 config.yaml 文件管理配置，本实现改用 .env + pydantic-settings，
更适合 Python Web 服务和 12-Factor App 规范。
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """全局配置类"""

    # LLM API 配置（DashScope OpenAI 兼容接口）
    # DashScope 文档：https://help.aliyun.com/zh/model-studio/developer-reference/compatibility-of-openai-with-dashscope
    api_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    api_key: str = ""
    api_model: str = "qwen-max"  # 可选：qwen-plus, qwen-max, qwen-turbo 等

    # FastAPI 服务配置
    host: str = "0.0.0.0"    # 监听地址
    port: int = 8000         # 监听端口
    cors_origins: list[str] = [  # 允许的跨域来源
        "http://localhost:5173",  # Vite 默认开发服务器
        "http://localhost:3000",  # 备用端口
    ]

    # pydantic-settings 配置
    # env_prefix: 环境变量前缀，读取 DEERFLOW_* 变量
    # env_file: 从 .env 文件加载
    model_config = {"env_prefix": "DEERFLOW_", "env_file": ".env"}


# 单例模式，整个应用共享同一份配置
settings = Settings()
