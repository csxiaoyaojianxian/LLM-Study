# 用 Vercel AI SDK 重构项目

```
$ npx create-next-app@latest 02-ai_chat_sdk --typescript --tailwind --app --use-npm
$ cd 02-ai_chat_sdk
$ npm install ai @ai-sdk/react @ai-sdk/deepseek
```

创建  ⁠app/api/chat/route.ts⁠ ：

```
import { deepseek } from '@ai-sdk/deepseek';
import { streamText } from 'ai';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: deepseek('deepseek-chat'),
    messages,
  });

  return result.toTextStreamResponse();
}
```

对比之前：
不用手动写fetch
不用处理Authorization
自动流式输出



创建  ⁠app/page.tsx⁠ ：



创建  ⁠.env.local⁠ ：

```
DEEPSEEK_API_KEY=你的DeepSeek_API_Key
```

新版 @ai-sdk/react v3 发给服务端的 messages 是 UIMessage 格式（包含 parts、id 等字段），而 streamText 期望的是 ModelMessage     
  格式（{ role, content }）。加上 convertToModelMessages() 做转换后，请求就能正常处理了。

用AI SDK实现Function Calling。

创建  ⁠app/api/chat/tools.ts⁠ ：

