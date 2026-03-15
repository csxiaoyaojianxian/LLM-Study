'use client';

import { useChat } from '@ai-sdk/react';
import { isToolUIPart } from 'ai';
import { useState } from 'react';

export default function Chat() {
  const { messages, sendMessage, status } = useChat();
  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const isLoading = status === 'submitted' || status === 'streaming';

  function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput('');
  }

  return (
    <div className="max-w-3xl mx-auto p-4 min-h-screen bg-gray-50">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-gray-800">🤖 AI Chat + 工具调用</h1>
        <p className="text-sm text-gray-500 mt-1">Powered by DeepSeek + Vercel AI SDK</p>
      </header>

      {/* 功能提示 */}
      <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
        <strong>试试问：</strong>
        <span className="ml-2">&ldquo;北京天气怎么样？&rdquo;</span>
        <span className="ml-2">&ldquo;计算 25 * 4 + 100&rdquo;</span>
      </div>

      {/* 消息列表 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-[500px] overflow-y-auto p-4 mb-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-20">
            <p>开始对话吧 👋</p>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`mb-4 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>

            {/* 用户消息 */}
            {m.role === 'user' && (
              <div className="inline-block max-w-[80%] bg-blue-500 text-white rounded-lg p-3">
                <div className="text-xs opacity-70 mb-1">👤 你</div>
                <div>
                  {m.parts.filter((p) => p.type === 'text').map((p, i) => (
                    <span key={i}>{(p as { type: 'text'; text: string }).text}</span>
                  ))}
                </div>
              </div>
            )}

            {/* AI消息 */}
            {m.role === 'assistant' && (
              <div className="space-y-2">
                {/* 文字内容 */}
                {m.parts?.filter((p) => p.type === 'text').length > 0 && (
                  <div className="inline-block max-w-[80%] bg-gray-100 text-gray-800 rounded-lg p-3">
                    <div className="text-xs opacity-70 mb-1">🤖 AI</div>
                    <div className="whitespace-pre-wrap">
                      {m.parts
                        .filter((p) => p.type === 'text')
                        .map((p, i) => <span key={i}>{(p as { type: 'text'; text: string }).text}</span>)}
                    </div>
                  </div>
                )}

                {/* 工具调用 */}
                {m.parts?.filter(isToolUIPart).map((part, idx) => {
                  const toolName = part.type === 'dynamic-tool' ? part.toolName : part.type.replace('tool-', '');
                  const input = part.input;
                  const output = 'output' in part ? part.output : undefined;
                  const state = part.state;
                  return (
                    <div key={idx} className="block">
                      <div className="inline-block max-w-[90%] bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-left">
                        <div className="text-xs text-yellow-700 mb-1">
                          🔧 工具调用: {toolName}
                        </div>
                        <div className="text-sm text-gray-700">
                          <div>参数: {JSON.stringify(input)}</div>
                          {state === 'output-available' && (
                            <div className="mt-1 text-green-700 text-xs">
                              结果: {JSON.stringify(output)}
                            </div>
                          )}
                          {(state === 'input-streaming' || state === 'input-available') && (
                            <div className="mt-1 text-orange-600 text-xs">执行中...</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        ))}

        {isLoading && (
          <div className="text-left">
            <div className="inline-block bg-gray-100 rounded-lg p-3 text-gray-500">
              <span className="animate-pulse">思考中...</span>
            </div>
          </div>
        )}
      </div>

      {/* 输入框 */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入消息，试试查天气或计算..."
          className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? '...' : '发送'}
        </button>
      </form>

      {/* 调试信息 */}
      <div className="mt-4 text-center">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="text-sm text-gray-500 underline"
        >
          {showHistory ? '隐藏' : '显示'}对话历史
        </button>
      </div>

      {showHistory && (
        <pre className="mt-4 p-4 bg-gray-900 text-green-400 rounded-lg text-xs overflow-auto max-h-60">
          {JSON.stringify(messages, null, 2)}
        </pre>
      )}
    </div>
  );
}
