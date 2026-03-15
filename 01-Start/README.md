# 构建第一个AI应用

## 01-Tokenizer

学习计划：AI基础 + 初阶开发
Day 1（今天周六剩余时间）：大模型原理速成
任务	时间	产出	阅读《图解Transformer》	1h	理解注意力机制	观看"Token是什么"讲解	30min	明白Tokenization	动手：用Tokenizer看文本怎么被切分	30min	截图记录不同模型的切分差异	推荐资源：			
 ●文章：《The Illustrated Transformer》（中文翻译版很多）
 ●工具：OpenAI Tokenizer / Claude的Token计数

https://platform.openai.com/tokenizer

| 文本                             | Token数(GPT-5.x & O1/3)                            | Token数(GPT-4 & GPT-3.5 (legacy))                  | Token数(GPT-3 (legacy))                             | 观察 |
| -------------------------------- | -------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------- | ---- |
| Hello                            | 1                                                  | 1                                                  | 1                                                   |      |
| 你好                             | 1                                                  | 2 (`你_好`)                                        | 4 (/)                                               |      |
| A                                | 1                                                  | 1                                                  | 1                                                   |      |
| AB                               | 1                                                  | 1                                                  | 1                                                   |      |
| ABC                              | 1                                                  | 1                                                  | 1                                                   |      |
| ABCD                             | 2 (`AB_CD`)                                        | 2 (`AB_CD`)                                        | 2 (`ABC_D`)                                         |      |
| 123                              | 1                                                  | 1                                                  | 1                                                   |      |
| 1234                             | 2 (`123_4`)                                        | 2 (`123_4`)                                        | 2 (`12_34`)                                         |      |
| 12345                            | 2 (`123_45`)                                       | 2 (`123_45`)                                       | 2 (`123_45`)                                        |      |
| const x = 1; function add(a,b){} | 12 `(const_ x_ =_ _1_;_ function_ add_(a_,b_)_{})` | 12 `(const_ x_ =_ _1_;_ function_ add_(a_,b_){_})` | 13 `(const_ x_ =_ 1_;_ function_ add_(_a_,_b_){_})` |      |
| 国                               | 1                                                  | 1                                                  | 2 (/)                                               |      |
| 国家                             | 1                                                  | 2 (`国_家`)                                        | 4 (/)                                               |      |
| 国家大事                         | 3 (`国家_大_事`)                                   | 4 (`国_家_大_事`)                                  | 7 (/)                                               |      |
| OpenAI是一家公司                 | 4 (`Open_AI_是一_家公司`)                          | 6 (`Open_AI_是_一_家_公司`)                        | 10 (/)                                              |      |
| aaaaaaaaaa                       | 2 (`aaaaaaaa_aa`)                                  | 2 (`aaaaaaaa_aa`)                                  | 3 (`aaaa_aaaa_aa`)                                  |      |
| !@#$%^&*()                       | 7 (`!_@_#$_%^_&_*_()`)                             | 7 (`!_@_#$_%^_&_*_()`)                             | 8 (`!_@_#$_%_^_&_*_()`)                             |      |
|                                  |                                                    |                                                    |                                                     |      |
|                                  |                                                    |                                                    |                                                     |      |
|                                  |                                                    |                                                    |                                                     |      |





```
帮我优化这段React代码：
function UserList({ users }) {
  const [filter, setFilter] = useState('');
  const filteredUsers = users.filter(u => u.name.includes(filter));
  return (
    <div>
			<input onChange={e => setFilter(e.target.value)} />
			{filteredUsers.map(user => ( <UserCard key={user.id} user={user} /> ))}
    </div>
  );
}
```



````
你是一位有10年经验的React性能优化专家，擅长识别不必要的重渲染和内存泄漏。

请帮我优化以下代码，要求：
1. 识别性能瓶颈
2. 给出优化后的代码
3. 解释每项改动的原理

代码：
function UserList({ users }) {
  const [filter, setFilter] = useState('');
  const filteredUsers = users.filter(u => u.name.includes(filter));
  return (
    <div>
			<input onChange={e => setFilter(e.target.value)} />
			{filteredUsers.map(user => ( <UserCard key={user.id} user={user} /> ))}
    </div>
  );
}
````





## 02-第一个API调用

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

报错，余额不足

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

正确返回

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

​	
## 03-构建第一个AI应用(HTML聊天界面)
01-chat.html
目标：
一个能对话的AI聊天机器人
理解API调用的完整流程
Token使用监控（看Console）



Prompt的核心机制role

| role      | 扮演者    | 作用                         |
| --------- | --------- | ---------------------------- |
| system    | 系统/导演 | 设定AI的行为规则、身份、底线 |
| user      | 用户/观众 | 提出需求、问题、指令         |
| assistant | AI/演员   | 根据system设定回应user       |



看代码注释



## 04-流式输出

02-chat_stream.html

响应

```
data: {"id":"52af3ea1-6dd5-41c6-874a-566c91d8de8f","object":"chat.completion.chunk","created":1773585479,"model":"deepseek-chat","system_fingerprint":"fp_eaab8d114b_prod0820_fp8_kvcache","choices":[{"index":0,"delta":{"role":"assistant","content":""},"logprobs":null,"finish_reason":null}]}

data: {"id":"52af3ea1-6dd5-41c6-874a-566c91d8de8f","object":"chat.completion.chunk","created":1773585479,"model":"deepseek-chat","system_fingerprint":"fp_eaab8d114b_prod0820_fp8_kvcache","choices":[{"index":0,"delta":{"content":"我是"},"logprobs":null,"finish_reason":null}]}

data: {"id":"52af3ea1-6dd5-41c6-874a-566c91d8de8f","object":"chat.completion.chunk","created":1773585479,"model":"deepseek-chat","system_fingerprint":"fp_eaab8d114b_prod0820_fp8_kvcache","choices":[{"index":0,"delta":{"content":"Deep"},"logprobs":null,"finish_reason":null}]}

data: {"id":"52af3ea1-6dd5-41c6-874a-566c91d8de8f","object":"chat.completion.chunk","created":1773585479,"model":"deepseek-chat","system_fingerprint":"fp_eaab8d114b_prod0820_fp8_kvcache","choices":[{"index":0,"delta":{"content":"Se"},"logprobs":null,"finish_reason":null}]}

data: {"id":"52af3ea1-6dd5-41c6-874a-566c91d8de8f","object":"chat.completion.chunk","created":1773585479,"model":"deepseek-chat","system_fingerprint":"fp_eaab8d114b_prod0820_fp8_kvcache","choices":[{"index":0,"delta":{"content":"ek"},"logprobs":null,"finish_reason":null}]}

...

data: {"id":"52af3ea1-6dd5-41c6-874a-566c91d8de8f","object":"chat.completion.chunk","created":1773585479,"model":"deepseek-chat","system_fingerprint":"fp_eaab8d114b_prod0820_fp8_kvcache","choices":[{"index":0,"delta":{"content":""},"logprobs":null,"finish_reason":"stop"}],"usage":{"prompt_tokens":12,"completion_tokens":113,"total_tokens":125,"prompt_tokens_details":{"cached_tokens":0},"prompt_cache_hit_tokens":0,"prompt_cache_miss_tokens":12}}

data: [DONE]
```





## 05-多轮对话维护history

多轮对话的核心：把之前的对话都带上

模型是"无状态"的，每次API调用都是全新的。要实现多轮对话，需要手动维护历史记录：



## 06-Function Calling

Function Calling是AI应用的核心能力

用户输入 → AI判断是否调用工具 → [是] → 执行函数 → 结果给AI → AI回复
                              → [否] → 直接回复

| 用户输入           | AI行为          | 预期结果                    |
| ------------------ | --------------- | --------------------------- |
| "北京天气怎么样？" | 调用get_weather | "北京今天晴，25°C，湿度40%" |
| "上海呢？"         | 调用get_weather | "上海今天多云..."           |
| "你会写React吗？"  | 不调用工具      | 直接回答技术问题            |

第一次返回：

```
{
    "id": "7f170cf1-45a0-4788-adc3-0b3d959d5080",
    "object": "chat.completion",
    "created": 1773586761,
    "model": "deepseek-chat",
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
    "usage": {
        "prompt_tokens": 323,
        "completion_tokens": 51,
        "total_tokens": 374,
        "prompt_tokens_details": {
            "cached_tokens": 320
        },
        "prompt_cache_hit_tokens": 320,
        "prompt_cache_miss_tokens": 3
    },
    "system_fingerprint": "fp_eaab8d114b_prod0820_fp8_kvcache"
}
```

传入function call的结果后调用返回：

```
{
    "id": "fd25a0cd-373d-4d5d-b85d-755eb2ecd7e2",
    "object": "chat.completion",
    "created": 1773586814,
    "model": "deepseek-chat",
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
    "usage": {
        "prompt_tokens": 110,
        "completion_tokens": 67,
        "total_tokens": 177,
        "prompt_tokens_details": {
            "cached_tokens": 64
        },
        "prompt_cache_hit_tokens": 64,
        "prompt_cache_miss_tokens": 46
    },
    "system_fingerprint": "fp_eaab8d114b_prod0820_fp8_kvcache"
}
```

