import type { MediaFile } from '@/components/MediaUploader.vue';
import type { MusicSuggestion } from '@/types/music';
import { extractKeyFrames } from '@/services/videoFrameExtractor';
import { enrichMusicSuggestions } from '@/services/musicSearchService';

export interface CopyResult {
  id: string;
  title: string;
  content: string;
  hashtags: string[];
  musicSuggestions: MusicSuggestion[];
  viralComments: string[];
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

const API_BASE = import.meta.env.VITE_API_PROXY_URL || 'https://dashscope.aliyuncs.com';
const API_MODEL = import.meta.env.VITE_API_MODEL || 'deepseek-v4-pro';

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
    {
      id: 'humorous',
      name: '幽默搞笑',
      description: '轻松有趣，娱乐性强',
      sample: '笑死我了😂 #搞笑日常 #欢乐时刻'
    },
    {
      id: 'knowledge',
      name: '知识分享',
      description: '提供实用信息价值',
      sample: '学到了！收藏备用 📚 #涨知识 #实用技巧'
    },
    {
      id: 'inspirational',
      name: '励志鼓舞',
      description: '激励人心，正能量',
      sample: '太励志了！加油 💪 #正能量 #励志语录'
    },
    {
      id: 'graceful',
      name: '婉约朦胧',
      description: '含蓄留白，古典诗意，以景结情',
      sample: '此情无计可消除，才下眉头，却上心头 🍂 #古风意境 #温柔文案'
    },
    {
      id: 'fresh',
      name: '小清新',
      description: '自然治愈，文艺干净',
      sample: '阳光正好，微风不燥，一切刚刚好 🌿 #治愈系 #小清新'
    },
    {
      id: 'bold',
      name: '豪放派',
      description: '气势磅礴，豪迈洒脱',
      sample: '仰天大笑出门去，我辈岂是蓬蒿人 ⚡ #豪迈 #江湖气'
    },
    {
      id: 'daily',
      name: '日常碎碎念',
      description: '烟火气、vlog感，像朋友闲聊',
      sample: '今天也是被生活治愈的一天呀 ☕ #日常 #生活碎片'
    },
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
    return import.meta.env.VITE_DASHSCOPE_API_KEY || null;
  }

  private getApiUrl(): string {
    return `${API_BASE}/v1/chat/completions`;
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
   * 调用阿里云百炼 API (qwen3.6-plus)
   */
  private async callDashScopeAPI(
    systemPrompt: string,
    userContent: Array<
      | { type: 'image_url'; image_url: { url: string } }
      | { type: 'text'; text: string }
    >,
    maxTokens = 2048
  ): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new AICopyError(
        'API_KEY_NOT_CONFIGURED',
        '未配置 DashScope API Key。请复制 .env.example 为 .env.local 并填入 VITE_DASHSCOPE_API_KEY。'
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
          model: API_MODEL,
          max_tokens: maxTokens,
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

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
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

    const response = await this.callDashScopeAPI(ANALYSIS_SYSTEM_PROMPT, limitedContents, 1024);
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
   */
  private async generateCopyWithClaude(
    analysis: ImageAnalysisResult,
    style: CopyStyle
  ): Promise<Omit<CopyResult, 'id' | 'createdAt'>> {
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
   * 生成文案（支持多文件、多风格）
   */
  async generateCopy(
    files: MediaFile[],
    selectedStyleIds?: string[]
  ): Promise<CopyResult[]> {
    if (files.length === 0) {
      throw new Error('至少需要上传一个文件');
    }

    const analysis = await this.analyzeMultipleImages(files);

    const stylesToUse = selectedStyleIds && selectedStyleIds.length > 0
      ? this.copyStyles.filter(style => selectedStyleIds.includes(style.id))
      : this.copyStyles;

    const results = await Promise.all(
      stylesToUse.map(async (style) => {
        const copy = await this.generateCopyWithClaude(analysis, style);

        // 异步搜索填充音乐URL（失败不影响文案生成）
        try {
          copy.musicSuggestions = await enrichMusicSuggestions(copy.musicSuggestions);
        } catch {
          console.warn('音乐搜索填充失败，将使用纯文本推荐');
        }

        return {
          ...copy,
          id: Math.random().toString(36).substring(2, 11),
          createdAt: new Date()
        };
      })
    );

    return results;
  }

  /**
   * 获取所有可用风格
   */
  getStyles(): CopyStyle[] {
    return this.copyStyles;
  }
}

export default AICopyService.getInstance();
