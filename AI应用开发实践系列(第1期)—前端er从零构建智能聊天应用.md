# AI应用开发实践系列(第1期)—前端er从零构建智能聊天应用

本系列面向传统web应用开发者，聚焦AI应用开发的实战技能。
本节从零构建一个功能完整的AI聊天应用，支持流式输出、多轮对话和 Function Calling（工具调用），最终部署为可访问的线上服务。
技术栈：Next.js + AI SDK + DeepSeek API
源代码：[https://github.com/csxiaoyaojianxian/LLM-Study](https://github.com/csxiaoyaojianxian/LLM-Study)

## 一、前置知识：走进大模型的世界

### 1.1 大语言模型：一个超级"文字接龙"玩家

想象一下，你正在玩一个文字接龙游戏。我说"今天天气"，你接"很好"；我说"我想吃"，你接"火锅"。这个简单的过程，本质上就是大语言模型（LLM）在做的事情——**根据已知的文字，预测下一个最可能出现的字**。
只不过，这个"玩家"经过了一个惊人的训练过程：它"阅读"了互联网上数千亿字的文本，从维基百科到小说，从代码到论文。通过海量学习，它掌握了语言的规律、世界的知识、甚至某种程度的"逻辑推理"能力。
**但它是怎么做到的？**
2017年，Google提出了**Transformer架构**，彻底改变了自然语言处理领域。与传统的逐字阅读不同，Transformer引入了**自注意力机制（Self-Attention）**——它能让模型在处理每个词时，同时"看到"句子中的所有其他词，并判断它们之间的关联强度。
举个例子：

> "苹果发布了新款手机，果粉们排队抢购。"

当模型处理"苹果"这个词时，自注意力机制会让它同时关注"发布"、"手机"、"果粉"这些词，从而判断这里的"苹果"指的是公司，而非水果。这种**全局上下文理解能力**，正是大模型"聪明"的关键。

### 1.2 Token：AI世界的"货币"

现在，让我们聊聊一个实际的问题：当你调用AI API时，费用是怎么计算的？
答案不是按字符数，而是按**Token**。
**什么是Token？**
简单来说，Token是大模型能够理解和处理的最小文本单元，一个专业的解释叫"词元"。在模型眼中，你输入的文字不是"你好世界"，而是一串数字ID：`[12345, 67890, ...]`。这个转换过程叫做**Tokenization**，由专门的Tokenizer完成。

你可以访问 [https://platform.openai.com/tokenizer](https://platform.openai.com/tokenizer) 感受下Token的切分方式差异：

| 文本                             | Token数(GPT-5.x & O1/3)                            | Token数(GPT-4 & GPT-3.5 (legacy))                  | Token数(GPT-3 (legacy))                             |
| -------------------------------- | -------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------- |
| Hello                            | 1                                                  | 1                                                  | 1                                                   |
| 你好                             | 1                                                  | 2 (`你_好`)                                        | 4 (/)                                               |
| A                                | 1                                                  | 1                                                  | 1                                                   |
| AB                               | 1                                                  | 1                                                  | 1                                                   |
| ABC                              | 1                                                  | 1                                                  | 1                                                   |
| ABCD                             | 2 (`AB_CD`)                                        | 2 (`AB_CD`)                                        | 2 (`ABC_D`)                                         |
| 123                              | 1                                                  | 1                                                  | 1                                                   |
| 1234                             | 2 (`123_4`)                                        | 2 (`123_4`)                                        | 2 (`12_34`)                                         |
| 12345                            | 2 (`123_45`)                                       | 2 (`123_45`)                                       | 2 (`123_45`)                                        |
| const x = 1; function add(a,b){} | 12 `(const_ x_ =_ _1_;_ function_ add_(a_,b_)_{})` | 12 `(const_ x_ =_ _1_;_ function_ add_(a_,b_){_})` | 13 `(const_ x_ =_ 1_;_ function_ add_(_a_,_b_){_})` |
| 国                               | 1                                                  | 1                                                  | 2 (/)                                               |
| 国家                             | 1                                                  | 2 (`国_家`)                                        | 4 (/)                                               |
| 国家大事                         | 3 (`国家_大_事`)                                   | 4 (`国_家_大_事`)                                  | 7 (/)                                               |
| OpenAI是一家公司                 | 4 (`Open_AI_是一_家公司`)                          | 6 (`Open_AI_是_一_家_公司`)                        | 10 (/)                                              |
| aaaaaaaaaa                       | 2 (`aaaaaaaa_aa`)                                  | 2 (`aaaaaaaa_aa`)                                  | 3 (`aaaa_aaaa_aa`)                                  |
| !@#$%^&*()                       | 7 (`!_@_#$_%^_&_*_()`)                             | 7 (`!_@_#$_%^_&_*_()`)                             | 8 (`!_@_#$_%_^_&_*_()`)                             |
| Artificial Intelligence          | 2 (`Artificial_ Intelligence`)                     | 3 (`Art_ificial_ Intelligence`)                    | 3 (`Art_ificial_ Intelligence`)                     |
| 人工智能                         | 2 (`人工_智能`)                                    | 5 (`人_工_/_/_能`)                                 | 8 (/)                                               |

经过上面的尝试，我们可以直观感受到不同模型的切分差异、中英文单词的token长度差异、数字和代码符号的切分差异等。对比它们的Token数，你会对"Token效率"有直观的感受。

### 1.3 Prompt工程：与AI对话的艺术

理解了Token，我们来聊聊更重要的：**如何让AI给出你想要的回答？**

很多人第一次用ChatGPT时，会有这样的体验：明明问的是同一个问题，有时候回答很精彩，有时候却很敷衍。差别在哪里？**在于Prompt（提示词）的设计。**

Prompt工程，就是研究如何设计输入，让AI输出最佳结果的技术。它不需要你懂算法，但需要懂**沟通的艺术**。

**一个真实的对比：**

假设你想让AI帮你优化一段React代码。

**❌ 模糊提问：**
> "帮我看看这段代码"

这种Prompt的问题在于：AI不知道你的角色（是新手还是专家？）、你的目标（要优化性能还是可读性？）、你的约束（项目用什么技术栈？）。它只能给出一个泛泛的回答。

**✅ 精心设计：**

> "你是一位有10年经验的React性能优化专家，曾在Meta和Google工作。请帮我优化以下代码，要求：
> 1. 识别并修复潜在的性能瓶颈（如不必要的重渲染）
> 2. 使用React 18的最佳实践
> 3. 给出优化后的完整代码
> 4. 每处改动用注释说明原因
>
> 代码：
> [粘贴代码]"

**差异在哪里？**

| 维度         | 模糊Prompt | 优化Prompt       |
| ------------ | ---------- | ---------------- |
| **角色设定** | 无         | 明确的专家身份   |
| **上下文**   | 无         | 技术栈、经验背景 |
| **输出格式** | 未指定     | 4点具体要求      |
| **质量**     | 泛泛而谈   | 专业、可执行     |

**Prompt工程的核心技巧：**

1. **角色设定**：给AI一个明确的身份，激活其特定领域的知识
2. **上下文提供**：背景信息越充分，回答越精准
3. **输出格式**：明确告诉AI你想要的格式（列表、代码、表格等）
4. **Few-shot示例**：给2-3个输入输出样例，让AI模仿



## 二、实战：纯前端调用API

理论铺垫完毕，现在动手写代码。本节目标：**用基础HTML+JavaScript调用DeepSeek API，实现AI聊天界面。**

### 2.1 获取API Key

1. 访问 [platform.deepseek.com](https://platform.deepseek.com)
2. 手机号注册，创建API Key，格式如 `sk-xxxxxxxxxxxxxxxxx`

⚠️ **安全提示**：本节为演示方便，将Key直接写在代码里。实际项目绝不可这么做，下一节用Next.js解决。

### 2.2 第一个API请求：用curl测试

在写代码之前，先用curl测试API是否调通：

```bash
curl https://api.deepseek.com/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $YOUR_API_KEY" \
  -d '{
    "model": "deepseek-chat",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant"},
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

账户余额不足会有如下提示：

```json
{
    "error": {
        "message": "Insufficient Balance",
        "type": "unknown_error",
        "param": null,
        "code": "invalid_request_error"
    }
}
```

如果返回类似下面的JSON，说明API调用成功：

```json
{
    "id": "d6515c8a-1728-47dd-9d38-9b94b7d7b6ad",
    "object": "chat.completion",
    "created": 1773513566,
    "model": "deepseek-chat", // 使用的模型
    "choices": [{
        "index": 0,
        "message": {
            "role": "assistant",
            "content": "Hello! How can I assist you today? 😊" // AI的回复内容
        },
        "logprobs": null,
        "finish_reason": "stop" // 正常结束（不是截断）
    }],
    "usage": {
        "prompt_tokens": 11, // 输入消耗11个token
        "completion_tokens": 11, // 输出消耗11个token
        "total_tokens": 22, // 总共消耗22个token
        "prompt_tokens_details": {
            "cached_tokens": 0
        },
        "prompt_cache_hit_tokens": 0,
        "prompt_cache_miss_tokens": 11
    },
    "system_fingerprint": "fp_eaab8d114b_prod0820_fp8_kvcache"
}
```

### 2.3 构建第一个AI应用(HTML聊天界面)

创建 `chat.html`：

```html
<!-- 核心：调用DeepSeek API -->
<script>
const API_KEY = 'sk-你的Key';  // ⚠️ 实际项目不要这样写！
const API_URL = 'https://api.deepseek.com/chat/completions';
// 维护对话历史，实现多轮对话
let history = [{ role: 'system', content: 'You are a helpful assistant.' }];
async function sendMessage(userInput) {
  // 1. 添加用户消息到历史
  history.push({ role: 'user', content: userInput });
  // 2. 调用API
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: history,  // 传入完整历史
      stream: false
    })
  });
  const data = await res.json();
  const aiReply = data.choices[0].message.content;
  // 3. 添加AI回复到历史
  history.push({ role: 'assistant', content: aiReply });
  return aiReply;
}
</script>
```

注意，由于模型是"无状态"的，每次API调用都是全新的。要实现多轮对话，需要通过 history⁠ 数组手动维护多轮对话上下文，每次请求把完整历史传给API，AI就能"记住"之前的对话。

其中，role有三类

| role      | 扮演者    | 作用                         |
| --------- | --------- | ---------------------------- |
| system    | 系统/导演 | 设定AI的行为规则、身份、底线 |
| user      | 用户/观众 | 提出需求、问题、指令         |
| assistant | AI/演员   | 根据system设定回应user       |

完整代码见GitHub仓库：[https://github.com/csxiaoyaojianxian/LLM-Study/blob/main/01-Start/01-chat.html](https://github.com/csxiaoyaojianxian/LLM-Study/blob/main/01-Start/01-chat.html)

### 2.4 流式输出优化

前面代码设置了 ⁠stream: false⁠ ，AI回复一次性返回。要实现ChatGPT式的打字机效果，需要改成 ⁠stream: true⁠ 并手动处理流。核心代码为：

```javascript
const response = await fetch(API_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`
  },
  body: JSON.stringify({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: message }
    ],
    stream: true  // 流式输出
  })
});
const reader = response.body.getReader();
const decoder = new TextDecoder();
let aiMessageId = appendMessage('assistant', '');
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') continue;
      
      try {
        const json = JSON.parse(data);
        const content = json.choices[0].delta.content || '';
        appendToMessage(aiMessageId, content);
      } catch (e) {
        // 忽略解析错误
      }
    }
  }
}
```

完整代码参考：[https://github.com/csxiaoyaojianxian/LLM-Study/blob/main/01-Start/02-chat_stream.html](https://github.com/csxiaoyaojianxian/LLM-Study/blob/main/01-Start/02-chat_stream.html)

你好奇流式输出时的接口响应吗？它长这样：

```text
data: {"id":"52af3ea1-6dd5-41c6-874a-566c91d8de8f","object":"chat.completion.chunk","created":1773585479,"model":"deepseek-chat","system_fingerprint":"fp_eaab8d114b_prod0820_fp8_kvcache","choices":[{"index":0,"delta":{"role":"assistant","content":""},"logprobs":null,"finish_reason":null}]}

data: {"id":"52af3ea1-6dd5-41c6-874a-566c91d8de8f","object":"chat.completion.chunk","created":1773585479,"model":"deepseek-chat","system_fingerprint":"fp_eaab8d114b_prod0820_fp8_kvcache","choices":[{"index":0,"delta":{"content":"我是"},"logprobs":null,"finish_reason":null}]}

data: {"id":"52af3ea1-6dd5-41c6-874a-566c91d8de8f","object":"chat.completion.chunk","created":1773585479,"model":"deepseek-chat","system_fingerprint":"fp_eaab8d114b_prod0820_fp8_kvcache","choices":[{"index":0,"delta":{"content":"Deep"},"logprobs":null,"finish_reason":null}]}

data: {"id":"52af3ea1-6dd5-41c6-874a-566c91d8de8f","object":"chat.completion.chunk","created":1773585479,"model":"deepseek-chat","system_fingerprint":"fp_eaab8d114b_prod0820_fp8_kvcache","choices":[{"index":0,"delta":{"content":"Se"},"logprobs":null,"finish_reason":null}]}

data: {"id":"52af3ea1-6dd5-41c6-874a-566c91d8de8f","object":"chat.completion.chunk","created":1773585479,"model":"deepseek-chat","system_fingerprint":"fp_eaab8d114b_prod0820_fp8_kvcache","choices":[{"index":0,"delta":{"content":"ek"},"logprobs":null,"finish_reason":null}]}

...

data: {"id":"52af3ea1-6dd5-41c6-874a-566c91d8de8f","object":"chat.completion.chunk","created":1773585479,"model":"deepseek-chat","system_fingerprint":"fp_eaab8d114b_prod0820_fp8_kvcache","choices":[{"index":0,"delta":{"content":""},"logprobs":null,"finish_reason":"stop"}],"usage":{"prompt_tokens":12,"completion_tokens":113,"total_tokens":125,"prompt_tokens_details":{"cached_tokens":0},"prompt_cache_hit_tokens":0,"prompt_cache_miss_tokens":12}}

data: [DONE]
```



## 三、进阶：用AI SDK重构

纯前端实现虽然能跑通，但存在两个明显问题：API Key暴露、代码冗余。本节用**Vercel AI SDK**重构，一次性解决所有问题。

### 3.1 为什么选择AI SDK

Vercel AI SDK是专为前端开发者设计的AI开发工具库，核心优势：

| 功能     | 手动实现               | AI SDK       |
| -------- | ---------------------- | ------------ |
| 流式输出 | 手动解析ReadableStream | 自动处理     |
| 状态管理 | 自己维护history数组    | useChat Hook |
| 错误处理 | 手动try-catch          | 内置错误边界 |
| 代码量   | ~150行                 | ~30行        |

**一句话：让前端开发者用熟悉的方式（React Hooks）开发AI应用。**

### 3.2 项目搭建

```bash
# 创建Next.js项目
$ npx create-next-app@latest 02-ai_chat_sdk --typescript --tailwind --app --use-npm
$ cd 02-ai_chat_sdk

# 安装AI SDK和DeepSeek适配器
$ npm install ai @ai-sdk/react @ai-sdk/deepseek
```

创建  ⁠`app/api/chat/route.ts⁠`：

```javascript
import { deepseek } from '@ai-sdk/deepseek';
import { streamText, createUIMessageStreamResponse, convertToModelMessages } from 'ai';
export async function POST(req: Request) {
  const { messages } = await req.json();
  const result = streamText({
    model: deepseek('deepseek-chat'),
    messages: await convertToModelMessages(messages),
  });
  return createUIMessageStreamResponse({
    stream: result.toUIMessageStream(),
  });
}
```

创建  ⁠`app/page.tsx⁠` 和 `.env.local`：

完整代码参考：[https://github.com/csxiaoyaojianxian/LLM-Study/tree/main/02-ai_chat_sdk](https://github.com/csxiaoyaojianxian/LLM-Study/tree/main/02-ai_chat_sdk)

**关键改进：**

+ **Key安全**：Next.js API路由解决Key安全问题（服务器端环境变量）
+ **自动流式**： ⁠streamText⁠ 自动处理SSE流式输出
+ **简洁**：AI SDK用React Hooks封装AI开发复杂度，状态管理、错误处理全部自动化，代码量：150行 → 30行



## 四、高阶：Function Calling（工具调用）

前面的AI应用只能"聊天"，本节让它拥有"双手"——调用外部工具的能力。

### 4.1 什么是Function Calling

**场景：超越文本对话**

普通AI应用：

> 用户：上海天气怎么样？
> AI：我不知道实时天气数据，我的知识截止到2024年...

Function Calling版：

> 用户：上海天气怎么样？
> AI：→ 调用getWeather工具 → 获取数据 → "上海今天晴，28°C"

**核心机制：**
AI能判断何时需要调用外部函数，传入参数，获取结果，再组织回复。

### 4.2 实现天气查询工具

创建 `app/api/chat/tools.ts`：

```typescript
// 天气查询工具
export async function getWeather({ city }: { city: string }) {
  // 模拟数据（实际项目中调用真实天气API）
  const mockWeather: Record<string, any> = {
    '北京': { temp: 25, condition: '晴', humidity: '40%', wind: '3级' },
    '上海': { temp: 28, condition: '多云', humidity: '65%', wind: '4级' },
    '深圳': { temp: 30, condition: '雷阵雨', humidity: '80%', wind: '5级' },
    '杭州': { temp: 26, condition: '阴', humidity: '55%', wind: '2级' },
  };
  const weather = mockWeather[city] || { 
    temp: 22, 
    condition: '未知', 
    humidity: '50%',
    wind: '2级'
  };
  return {
    city,
    temperature: weather.temp,
    condition: weather.condition,
    humidity: weather.humidity,
    wind: weather.wind,
    updateTime: new Date().toLocaleString('zh-CN'),
  };
}
```

更新  `⁠app/api/chat/route.ts⁠`：

```typescript
const result = streamText({
  model: deepseek('deepseek-chat'),
  messages: await convertToModelMessages(messages),
  // 定义工具
  tools: {
      // 工具1：查询天气
    getWeather: {
      description: '获取指定城市的当前天气信息，包括温度、天气状况、湿度和风力',
      inputSchema: z.object({
        city: z.string().describe('城市名称，如：北京、上海、深圳、杭州'),
      }),
      // 工具执行函数
      execute: async ({ city }) => getWeather({ city }),
    },
    // 工具2
    ...
  },
  // 让AI自动选择工具
  toolChoice: 'auto',
  // 允许多轮：工具调用 → 工具结果 → AI继续生成，最多5步
  stopWhen: stepCountIs(5),
});

```

更新  ⁠`app/page.tsx⁠` ：

完整代码参考：[https://github.com/csxiaoyaojianxian/LLM-Study/tree/main/02-ai_chat_sdk](https://github.com/csxiaoyaojianxian/LLM-Study/tree/main/02-ai_chat_sdk)

用户问"北京天气怎么样"时的完整流程：

```
第1次请求：
用户 → AI
AI判断：需要调用getWeather工具
AI返回：tool_calls请求
服务器执行：
调用getWeather({city: '北京'})
获取结果：{temp: 25, condition: '晴'...}

第2次请求：
把工具结果发给AI
AI生成：北京今天晴，25°C...

用户看到：
🔧 getWeather 调用
北京今天晴，25°C...
```

观察 DeepSeek 的接口返回：

第一次返回：

```json
{
    ...
    "choices": [
        {
            "index": 0,
            "message": {
                "role": "assistant",
                "content": "我来帮您查询北京的天气情况。",
                "tool_calls": [
                    {
                        "index": 0,
                        "id": "call_00_TnQ3sNyRHlUNHSChSfBPVM3E",
                        "type": "function",
                        "function": {
                            "name": "get_weather",
                            "arguments": "{\"city\": \"北京\"}"
                        }
                    }
                ]
            },
            "logprobs": null,
            "finish_reason": "tool_calls"
        }
    ],
    ...
}
```

传入function call的结果后调用返回：

```json
{
		...
    "choices": [
        {
            "index": 0,
            "message": {
                "role": "assistant",
                "content": "根据最新数据，北京目前的天气情况如下：\n\n- **温度**：25°C\n- **天气状况**：晴\n- **湿度**：40%\n- **更新时间**：2026年3月15日 23:00\n\n今天北京天气晴朗，温度舒适，湿度适中，是个不错的好天气！"
            },
            "logprobs": null,
            "finish_reason": "stop"
        }
    ],
    ...
}
```

### 4.3 Function Calling总结

Function Calling让AI从"聊天"升级为"执行"，工具定义的字段包括：name、description、parameters、execute。

AI自动决策，判断何时调用、传什么参数，SDK简化了这个过程，并支持自动处理多轮调用流程。



## 五、部署上线

应用开发完成，最后一步是部署到线上。

### 5.1 选择Vercel部署

**为什么选Vercel：**

| 特性      | 说明              |
| --------- | ----------------- |
| 免费额度  | 足够个人项目使用  |
| 一键部署  | 与Next.js深度集成 |
| 自动HTTPS | 无需额外配置      |
| 全球CDN   | 访问速度快        |

### 5.2 部署步骤

**第一步：提交代码到git**

**第二步：安装Vercel CLI**

```bash
$ npm i -g vercel
```

**第三步：登录并部署**

```bash
# 登录（浏览器会打开授权页面）
$ vercel login
# 部署
$ vercel
# 等待部署完成，会输出访问链接：
```

**第四步：配置环境变量**

```bash
# 添加API Key到Vercel
$ vercel env add DEEPSEEK_API_KEY
# 输入你的Key，选择 Production 环境
# 然后重新部署
$ vercel --prod
```

**或在Vercel控制台操作：**
访问 [vercel.com/dashboard](vercel.com/dashboard)，找到项目 → Settings → Environment Variables，添加  ⁠DEEPSEEK_API_KEY⁠ 



## 六、资源推荐

**官方文档：**
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [DeepSeek API](https://platform.deepseek.com)
- [Next.js App Router](https://nextjs.org/docs)



**本系列后续文章：**

- 第2期：《RAG实战：让AI读懂你的笔记》
- 第3期：《Multi-Agent：AI团队协作系统》
- 第4期：《本地AI部署：私有化大模型》