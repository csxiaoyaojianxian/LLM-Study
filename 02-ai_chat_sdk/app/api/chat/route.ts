import { deepseek } from '@ai-sdk/deepseek';
import { streamText, createUIMessageStreamResponse, convertToModelMessages, stepCountIs } from 'ai';
import { z } from 'zod';
import { getWeather, calculate } from './tools';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();

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
        // 工具2：计算
        calculate: {
            description: '执行数学计算，支持加减乘除、括号等',
            inputSchema: z.object({
                expression: z.string().describe('数学表达式，如：2 + 2 * 3、sqrt(16)、(100 - 20) / 4'),
            }),
            execute: async ({ expression }) => calculate({ expression }),
        },
    },
    // 让AI自动选择工具
    toolChoice: 'auto',
    // 允许多轮：工具调用 → 工具结果 → AI继续生成，最多5步
    stopWhen: stepCountIs(5),
  });

  return createUIMessageStreamResponse({
    stream: result.toUIMessageStream(),
  });
}
