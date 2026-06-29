/**
 * AI 文案生成服务
 *
 * DeerFlow 集成说明：
 * 本服务支持两种 AI 调用模式，通过环境变量 VITE_USE_DEERFLOW 切换：
 *
 * 1. DashScope 直连模式（VITE_USE_DEERFLOW 未设置或为 false）
 *    浏览器直接调用 DashScope API，单轮 LLM 对话生成文案。
 *    优点：简单直接，无需后端。
 *    缺点：无法利用多智能体、搜索、记忆等高级能力。
 *
 * 2. DeerFlow 后端模式（VITE_USE_DEERFLOW=true）
 *    浏览器调用本地 DeerFlow 后端（FastAPI + LangGraph），
 *    后端通过 StateGraph 编排多个 Agent 协作：
 *    - Analyze Agent：分析图片内容
 *    - Copy Agent：生成文案
 *    优点：可扩展（加入 Researcher/Planner/Coder 等 Agent），
 *          支持沙箱执行、记忆系统、工具调用等 DeerFlow 核心能力。
 *    缺点：需要额外部署 Python 后端。
 *
 * DeerFlow 核心概念（后端部分见 backend/ 目录）：
 * - StateGraph：工作流编排器，定义 Agent 之间的执行顺序和数据传递
 * - Agent：独立的智能体节点，每个 Agent 有独立的 System Prompt 和工具
 * - State：节点间传递的状态（TypedDict），每个节点读取和更新状态
 * - Edge：定义节点之间的连接关系，支持条件分支
 *
 * 学习 DeerFlow 的建议顺序：
 * 1. 阅读 backend/src/workflow/copywriter.py 理解 StateGraph 和 Agent
 * 2. 阅读 backend/main.py 理解 FastAPI 如何暴露 API 端点
 * 3. 阅读本文件中 callDeerFlowAPI 方法理解前端如何调用后端
 * 4. 尝试添加新的 Agent（如 Researcher 搜索实时趋势）
 */

import type { MediaFile } from '@/components/MediaUploader.vue';
import type { MusicSuggestion } from '@/types/music';
import { extractKeyFrames } from '@/services/videoFrameExtractor';
import { enrichMusicSuggestions } from '@/services/musicSearchService';
import { useSettings } from '@/composables/useSettings';

export interface CopyResult {
  id: string;
  title: string;
  content: string;
  hashtags: string[];
  musicSuggestions: MusicSuggestion[];
  viralComments: string[];
  replies: string[];
  style: string;
  createdAt: Date;
}

export interface CopyStyle {
  id: string;
  name: string;
  description: string;
  sample: string;
}

export interface ImageAnalysisResult {
  objects: string[];
  colors: string[];
  mood: string;
  scene: string;
  mainSubject: string;
  relationships: string;
}

export type AICopyErrorType =
  | 'API_KEY_NOT_CONFIGURED'
  | 'API_RATE_LIMIT'
  | 'API_NETWORK_ERROR'
  | 'API_RESPONSE_PARSE_ERROR'
  | 'VIDEO_FRAME_EXTRACTION_ERROR';

export class AICopyError extends Error {
  type: AICopyErrorType;
  original?: Error;

  constructor(type: AICopyErrorType, message: string, original?: Error) {
    super(message);
    this.name = 'AICopyError';
    this.type = type;
    this.original = original;
  }
}

const DEFAULT_API_BASE = 'https://dashscope.aliyuncs.com';
const DEFAULT_API_MODEL = 'deepseek-v4-pro';
const DEFAULT_DEERFLOW_URL = 'http://localhost:8000';

const ANALYSIS_SYSTEM_PROMPT = `你是一位专业的图片分析专家，擅长从图片中提取关键视觉信息。请分析上传的图片，返回以下信息（JSON 格式）：
{
  "objects": ["主要物体1", "主要物体2"],
  "colors": ["主要颜色1", "主要颜色2"],
  "mood": "整体情感氛围",
  "scene": "场景类型",
  "mainSubject": "最主要的主体",
  "relationships": "多张图片之间的关系描述（如果只有一张图片则为空字符串）"
}`;

const COPY_SYSTEM_PROMPT = `你是一位精通抖音短视频运营的文案专家。请根据图片分析结果，为抖音短视频生成文案。

文案要求：
- 标题：5-15字，抓人眼球，可使用悬念/反差/数字等技巧，可包含 emoji
- 正文：20-50字，口语化，有互动感，像朋友聊天
- 话题标签：3-5个，选择当前热门且与内容相关的标签
- BGM推荐：2-3首，匹配图片情感氛围的抖音热门音乐，每首指明推荐使用的片段时间（秒）
- 音乐信息包含上述歌曲名称、开始时间（秒）、结束时间（秒）
- 神评推荐：生成10条抖音评论区高赞神评，覆盖以下10种风格（每种1条）：引发共鸣、幽默反转、犀利吐槽、神补刀、引发互动、婉约诗意、清新治愈、豪迈热血、碎碎念、深夜EMO
  每条10-25字，口语化、有网感，让人忍不住点赞

请严格按以下 JSON 格式返回（不要添加额外的 markdown 代码块）：
{
  "title": "标题文本",
  "content": "正文文案",
  "hashtags": ["#话题1", "#话题2", "#话题3"],
  "musicSuggestions": [
    { "name": "歌曲名", "startTime": 12, "endTime": 22 },
    { "name": "歌曲名", "startTime": 0, "endTime": 15 }
  ],
  "viralComments": ["共鸣型神评", "反转型神评", "吐槽型神评", "补刀型神评", "互动型神评"]
}`;

export class AICopyService {
  private static instance: AICopyService;

  public readonly copyStyles: CopyStyle[] = [
    {
      id: 'trending',
      name: '热门趋势',
      description: '紧跟最新热点话题',
      sample: '这也太绝了吧！🔥 #热门话题 #必备神器'
    },
    {
      id: 'emotional',
      name: '情感共鸣',
      description: '触动用户内心深处',
      sample: '看完真的破防了😭 #情感故事 #人生感悟'
    },
    // {
    //   id: 'humorous',
    //   name: '幽默搞笑',
    //   description: '轻松有趣，娱乐性强',
    //   sample: '笑死我了😂 #搞笑日常 #欢乐时刻'
    // },
    // {
    //   id: 'knowledge',
    //   name: '知识分享',
    //   description: '提供实用信息价值',
    //   sample: '学到了！收藏备用 📚 #涨知识 #实用技巧'
    // },
    // {
    //   id: 'inspirational',
    //   name: '励志鼓舞',
    //   description: '激励人心，正能量',
    //   sample: '太励志了！加油 💪 #正能量 #励志语录'
    // },
    // {
    //   id: 'graceful',
    //   name: '婉约朦胧',
    //   description: '含蓄留白，古典诗意，以景结情',
    //   sample: '此情无计可消除，才下眉头，却上心头 🍂 #古风意境 #温柔文案'
    // },
    // {
    //   id: 'fresh',
    //   name: '小清新',
    //   description: '自然治愈，文艺干净',
    //   sample: '阳光正好，微风不燥，一切刚刚好 🌿 #治愈系 #小清新'
    // },
    // {
    //   id: 'bold',
    //   name: '豪放派',
    //   description: '气势磅礴，豪迈洒脱',
    //   sample: '仰天大笑出门去，我辈岂是蓬蒿人 ⚡ #豪迈 #江湖气'
    // },
    // {
    //   id: 'daily',
    //   name: '日常碎碎念',
    //   description: '烟火气、vlog感，像朋友闲聊',
    //   sample: '今天也是被生活治愈的一天呀 ☕ #日常 #生活碎片'
    // },
    {
      id: 'emo',
      name: '孤独丧',
      description: 'EMO氛围，颓废但不绝望',
      sample: '耳机里的音乐是我的整个世界 🎧 #深夜emo #算了'
    }
  ];

  private constructor() {}

  public static getInstance(): AICopyService {
    if (!AICopyService.instance) {
      AICopyService.instance = new AICopyService();
    }
    return AICopyService.instance;
  }

  private getApiKey(): string | null {
    const { settings } = useSettings()
    return settings.value.apiKey || null;
  }

  private getApiUrl(): string {
    const { settings } = useSettings()
    const base = settings.value.apiProxyUrl || DEFAULT_API_BASE
    return `${base}/v1/chat/completions`;
  }

  /**
   * 获取 DeerFlow 后端地址
   * 可通过 VITE_DEERFLOW_URL 环境变量配置，默认 http://localhost:8000
   */
  private getDeerFlowUrl(): string {
    return import.meta.env.VITE_DEERFLOW_URL || DEFAULT_DEERFLOW_URL;
  }

  /**
   * 调用 DeerFlow 后端 API 生成文案（多智能体编排）
   * DeerFlow 工作流程：
   * 1. Analyze Agent：分析图片内容（物体、颜色、情感、场景）
   * 2. Copy Agent：根据分析结果和指定风格生成抖音文案
   * 返回格式与原有 DashScope 调用保持一致，实现无缝切换
   *
   * @param images base64 图片数组
   * @param style 文案风格
   * @param analysis 已有的图片分析结果（可选，跳过 Analyze 阶段）
   */
  private async callDeerFlowAPI(
    images: string[],
    style: CopyStyle,
    analysis?: ImageAnalysisResult
  ): Promise<string> {
    const response = await fetch(`${this.getDeerFlowUrl()}/api/generate-copy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        images,
        style_id: style.id,
        style_name: style.name,
        style_description: style.description,
        analysis: analysis ? {
          objects: analysis.objects,
          colors: analysis.colors,
          mood: analysis.mood,
          scene: analysis.scene,
          main_subject: analysis.mainSubject,
          relationships: analysis.relationships,
        } : undefined,
      }),
    });

    if (!response.ok) {
      throw new AICopyError(
        'API_NETWORK_ERROR',
        `DeerFlow 后端请求失败 (${response.status})。请检查后端服务是否启动。`
      );
    }

    if (!response.body) {
      throw new AICopyError('API_NETWORK_ERROR', '浏览器不支持流式响应。');
    }

    // SSE 流式读取（与原有 DashScope SSE 格式一致）
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const event of events) {
        if (!event.trim()) continue;
        const lines = event.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') return data;

          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              throw new AICopyError('API_NETWORK_ERROR', parsed.error);
            }
            // DeerFlow 返回完整结果，一次性返回
            return JSON.stringify(parsed);
          } catch {
            // 跳过解析失败的行
          }
        }
      }
    }

    throw new AICopyError('API_NETWORK_ERROR', 'DeerFlow 后端未返回有效数据');
  }

  private getApiModel(): string {
    const { settings } = useSettings()
    return settings.value.apiModel || DEFAULT_API_MODEL
  }

  /**
   * 将 File 对象转为 base64 data URL
   */
  private async base64File(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * 调用阿里云百炼 API (支持流式 SSE，可选 onChunk 回调用于增量展示)
   */
  private async callDashScopeAPI(
    systemPrompt: string,
    userContent: Array<
      | { type: 'image_url'; image_url: { url: string } }
      | { type: 'text'; text: string }
    >,
    maxTokens = 2048,
    onChunk?: (text: string) => void
  ): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new AICopyError(
        'API_KEY_NOT_CONFIGURED',
        '未配置 DashScope API Key。请点击右上角设置按钮进行配置。'
      );
    }

    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: userContent.map(item =>
            item.type === 'image_url'
              ? item
              : { type: 'text', text: item.text }
          )
        }
      ];

      const response = await fetch(this.getApiUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: this.getApiModel(),
          max_tokens: maxTokens,
          stream: true,
          messages
        })
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new AICopyError('API_RATE_LIMIT', 'API 请求过于频繁，请稍后重试。');
        }
        const errorText = await response.text();
        throw new AICopyError('API_NETWORK_ERROR', `API 请求失败 (${response.status}): ${errorText}`);
      }

      if (!response.body) {
        throw new AICopyError('API_NETWORK_ERROR', '浏览器不支持流式响应。');
      }

      // SSE 流式读取
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const event of events) {
          if (!event.trim()) continue;
          for (const line of event.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const data = trimmed.slice(5).trim();
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullText += content;
                onChunk?.(content);
              }
            } catch {
              // 跳过解析失败的行
            }
          }
        }
      }

      return fullText;
    } catch (error) {
      if (error instanceof AICopyError) throw error;
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new AICopyError(
          'API_NETWORK_ERROR',
          '无法连接到 DashScope API。请检查网络连接，或配置 VITE_API_PROXY_URL 代理地址。'
        );
      }
      throw new AICopyError(
        'API_NETWORK_ERROR',
        `API 调用异常: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 解析 Claude 返回的 JSON（处理可能的 markdown code fence）
   */
  private parseJsonResponse(text: string): Record<string, unknown> {
    let cleaned = text.trim();
    // 移除 markdown code fence
    const codeFenceMatch = cleaned.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/);
    if (codeFenceMatch) {
      cleaned = codeFenceMatch[1];
    }
    try {
      return JSON.parse(cleaned);
    } catch {
      throw new AICopyError('API_RESPONSE_PARSE_ERROR', `AI 返回的格式无法解析: ${cleaned.substring(0, 200)}`);
    }
  }

  /**
   * 分析多张图片（自动处理视频文件，提取关键帧）
   */
  async analyzeMultipleImages(files: MediaFile[]): Promise<ImageAnalysisResult> {
    type ContentBlock =
      | { type: 'image_url'; image_url: { url: string } }
      | { type: 'text'; text: string };
    const imageContents: ContentBlock[] = [];

    // 分离图片和视频
    const imageFiles = files.filter(f => f.type === 'image');
    const videoFiles = files.filter(f => f.type === 'video');

    // 处理图片
    for (const file of imageFiles) {
      const dataUrl = await this.base64File(file.file);
      imageContents.push({
        type: 'image_url',
        image_url: { url: dataUrl }
      });
    }

    // 处理视频：提取关键帧
    for (const file of videoFiles) {
      try {
        const frames = await extractKeyFrames(file.file, 3);
        for (const frame of frames) {
          const dataUrl = await this.blobToDataUrl(frame);
          imageContents.push({
            type: 'image_url',
            image_url: { url: dataUrl }
          });
        }
      } catch {
        // 视频帧提取失败，跳过该视频
        console.warn(`视频 ${file.name} 帧提取失败，已跳过`);
      }
    }

    // 限制总图片数量（Claude API 建议不超过 20 张）
    const maxImages = 20;
    const limitedContents = imageContents.slice(0, maxImages);

    const fileCount = files.length;
    const imageCount = imageFiles.length;
    const videoCount = videoFiles.length;
    let textPrompt = '';
    if (videoCount > 0 && imageCount > 0) {
      textPrompt = `请分析以下 ${imageCount} 张图片和 ${videoCount} 个视频的关键帧（共 ${limitedContents.length} 张图片），找出共同主题和情感基调。`;
    } else if (videoCount > 0) {
      textPrompt = `请分析以下 ${videoCount} 个视频的关键帧（共 ${limitedContents.length} 张图片），找出共同主题和情感基调。`;
    } else {
      textPrompt = fileCount > 1
        ? `请分析以下 ${fileCount} 张图片，找出它们的共同主题和情感基调，并描述图片之间的关系。`
        : '请分析以下图片。';
    }

    limitedContents.push({ type: 'text', text: textPrompt });

    const response = await this.callDashScopeAPI(ANALYSIS_SYSTEM_PROMPT, limitedContents, 512);
    const parsed = this.parseJsonResponse(response);

    return {
      objects: Array.isArray(parsed.objects) ? parsed.objects as string[] : ['未知物体'],
      colors: Array.isArray(parsed.colors) ? parsed.colors as string[] : [],
      mood: typeof parsed.mood === 'string' ? parsed.mood : '未知',
      scene: typeof parsed.scene === 'string' ? parsed.scene : '未知',
      mainSubject: typeof parsed.mainSubject === 'string' ? parsed.mainSubject : '未知主体',
      relationships: typeof parsed.relationships === 'string' ? parsed.relationships : ''
    };
  }

  private async blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * 根据分析结果和风格生成文案
   * 支持两种模式：
   * 1. DeerFlow 模式：调用后端多智能体工作流（分析 + 生成）
   * 2. DashScope 模式：直接调用 DashScope API（原有逻辑）
   * 通过环境变量 VITE_USE_DEERFLOW=true 切换
   */
  private async generateCopyWithClaude(
    analysis: ImageAnalysisResult,
    style: CopyStyle,
    imageBase64s: string[]
  ): Promise<Omit<CopyResult, 'id' | 'createdAt'>> {
    // 判断是否使用 DeerFlow 后端
    const useDeerFlow = import.meta.env.VITE_USE_DEERFLOW === 'true';
    if (useDeerFlow) {
      const raw = await this.callDeerFlowAPI(imageBase64s, style, analysis);
      if (raw === '[DONE]') {
        throw new AICopyError('API_NETWORK_ERROR', 'DeerFlow 未返回数据');
      }
      const parsed = JSON.parse(raw);
      return {
        title: typeof parsed.title === 'string' ? parsed.title : '精彩瞬间',
        content: typeof parsed.content === 'string' ? parsed.content : '值得一看的精彩瞬间',
        hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags as string[] : ['#精彩瞬间'],
        musicSuggestions: this.normalizeMusicSuggestions(parsed.music_suggestions),
        viralComments: Array.isArray(parsed.viral_comments)
          ? (parsed.viral_comments as string[]).slice(0, 10)
          : ['神评生成中...'],
        replies: Array.isArray(parsed.replies)
          ? (parsed.replies as string[]).slice(0, 20)
          : ['回复生成中...'],
        style: style.name
      };
    }

    // 原有 DashScope 直连模式
    const styleInstruction = `请以「${style.name}」风格生成文案。${style.description}。参考示例：${style.sample}`;

    const analysisText = `图片分析结果：
- 主要物体：${analysis.objects.join('、')}
- 主要颜色：${analysis.colors.join('、')}
- 情感氛围：${analysis.mood}
- 场景类型：${analysis.scene}
- 主要主体：${analysis.mainSubject}
${analysis.relationships ? `- 图片关系：${analysis.relationships}` : ''}

${styleInstruction}`;

    const response = await this.callDashScopeAPI(
      COPY_SYSTEM_PROMPT + '\n\n' + styleInstruction,
      [{ type: 'text', text: analysisText }],
      1024
    );

    const parsed = this.parseJsonResponse(response);

    return {
      title: typeof parsed.title === 'string' ? parsed.title : '精彩瞬间',
      content: typeof parsed.content === 'string' ? parsed.content : '值得一看的精彩瞬间',
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags as string[] : ['#精彩瞬间'],
      musicSuggestions: this.normalizeMusicSuggestions(parsed.musicSuggestions),
      viralComments: Array.isArray(parsed.viralComments)
        ? (parsed.viralComments as string[]).slice(0, 10)
        : ['神评生成中...'],
      replies: Array.isArray(parsed.replies)
        ? (parsed.replies as string[]).slice(0, 20)
        : ['回复生成中...'],
      style: style.name
    };
  }

  /**
   * 标准化音乐推荐数据（向后兼容旧 string[] 格式）
   */
  private normalizeMusicSuggestions(raw: unknown): MusicSuggestion[] {
    if (!Array.isArray(raw)) {
      return [{ id: crypto.randomUUID(), name: '抖音热歌', startTime: 0, endTime: 15 }];
    }

    return raw.map((item: unknown, index: number): MusicSuggestion => {
      // 旧格式：纯字符串 "晴天"
      if (typeof item === 'string') {
        return { id: crypto.randomUUID(), name: item, startTime: 0, endTime: 15 };
      }

      // 新格式：{ name, startTime, endTime }
      if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        const startTime = typeof obj.startTime === 'number' ? Math.max(0, obj.startTime) : 0;
        return {
          id: crypto.randomUUID(),
          name: typeof obj.name === 'string' ? obj.name : `歌曲${index + 1}`,
          startTime: startTime,
          endTime: typeof obj.endTime === 'number' ? Math.max(startTime + 1, obj.endTime) : 15,
        };
      }

      // 兜底
      return { id: crypto.randomUUID(), name: `歌曲${index + 1}`, startTime: 0, endTime: 15 };
    });
  }

  /**
   * 生成文案（支持多文件、多风格，进度式返回结果）
   *
   * DeerFlow 模式（VITE_USE_DEERFLOW=true）：
   *   图片和风格全部交给 DeerFlow 后端，由 Analyze Agent + Copy Agent 协作完成
   *   前端不直接调用 DashScope
   *
   * DashScope 直连模式：
   *   前端先调用 analyzeMultipleImages 分析图片，再调用 DashScope 生成文案
   *
   * @param onStyleReady 每个风格生成完毕后立即回调，不等音乐搜索
   */
  async generateCopy(
    files: MediaFile[],
    selectedStyleIds?: string[],
    onStyleReady?: (result: CopyResult) => void
  ): Promise<CopyResult[]> {
    if (files.length === 0) {
      throw new Error('至少需要上传一个文件');
    }

    const useDeerFlow = import.meta.env.VITE_USE_DEERFLOW === 'true';

    // DeerFlow 模式：不直接分析图片，交给后端 Analyze Agent 处理
    let analysis: ImageAnalysisResult | undefined;
    if (!useDeerFlow) {
      analysis = await this.analyzeMultipleImages(files);
    }

    // 收集图片 base64（DeerFlow 需要原始图片，DashScope 模式也需要用于展示）
    const imageBase64s: string[] = [];
    for (const file of files.filter(f => f.type === 'image')) {
      imageBase64s.push(await this.base64File(file.file));
    }

    const stylesToUse = selectedStyleIds && selectedStyleIds.length > 0
      ? this.copyStyles.filter(style => selectedStyleIds.includes(style.id))
      : this.copyStyles;

    // 并行生成所有风格文案，每个完成立即回调
    const promises = stylesToUse.map(async (style) => {
      const copy = await this.generateCopyWithClaude(analysis!, style, imageBase64s);
      const result: CopyResult = {
        ...copy,
        id: Math.random().toString(36).substring(2, 11),
        createdAt: new Date()
      };
      onStyleReady?.(result);
      return result;
    });

    const results = await Promise.all(promises);

    // 异步填充音乐URL（不阻塞结果返回）
    this.enrichMusicAsync(results);

    return results;
  }

  /**
   * 异步填充音乐信息（后台执行，失败不影响已展示的文案）
   */
  private enrichMusicAsync(results: CopyResult[]): void {
    Promise.allSettled(
      results.map(async (copy) => {
        try {
          copy.musicSuggestions = await enrichMusicSuggestions(copy.musicSuggestions);
        } catch {
          console.warn(`音乐搜索填充失败 (${copy.style})，将使用纯文本推荐`);
        }
      })
    );
  }

  /**
   * 获取所有可用风格
   */
  getStyles(): CopyStyle[] {
    return this.copyStyles;
  }
}

export default AICopyService.getInstance();
