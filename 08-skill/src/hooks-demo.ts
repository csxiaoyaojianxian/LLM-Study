/**
 * hooks-demo.ts — Hook 机制讲解 + 模拟测试
 *
 * 演示 Claude Code Hooks 的工作原理：
 * - Hook 类型与触发时机
 * - PreToolUse 阻止机制
 * - PostToolUse 后处理
 * - Hook 配置方式
 *
 * 运行: npm run hooks-demo
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOOKS_DIR = path.resolve(__dirname, "../examples/hooks");

// ============================================================
// Hook 类型定义（模拟）
// ============================================================

interface HookInput {
  tool_name: string;
  tool_input: Record<string, unknown>;
}

interface HookOutput {
  decision?: "block" | "allow";
  reason?: string;
}

type HookFunction = (input: HookInput) => HookOutput | void;

// ============================================================
// Demo 1: Hook 工作原理
// ============================================================

function demo1_hookConcepts() {
  console.log("📖 Demo 1: Hook 工作原理\n");

  console.log("Claude Code 的 Hook 系统流程:\n");
  console.log(`
  用户请求 → Claude 决策 → [PreToolUse Hook] → 工具执行 → [PostToolUse Hook] → 返回结果
                              ↓ (可阻止)                      ↓ (可后处理)
                           阻止执行                         格式化/通知/记录
  `);

  console.log("📌 四种 Hook 类型:\n");

  const hookTypes = [
    {
      name: "PreToolUse",
      trigger: "工具调用前",
      capability: "可以阻止操作（输出 {decision: 'block'}）",
      example: "阻止写入 .env 文件、限制危险命令",
    },
    {
      name: "PostToolUse",
      trigger: "工具调用后",
      capability: "后处理（格式化、通知、记录日志）",
      example: "编辑后自动格式化、提交后发送通知",
    },
    {
      name: "Notification",
      trigger: "Claude 发送通知时",
      capability: "自定义通知渠道",
      example: "发送到 Slack/飞书/邮件",
    },
    {
      name: "Stop",
      trigger: "Agent 循环结束时",
      capability: "执行清理或验证",
      example: "运行测试、检查代码规范",
    },
  ];

  for (const ht of hookTypes) {
    console.log(`  🪝 ${ht.name}`);
    console.log(`     触发: ${ht.trigger}`);
    console.log(`     能力: ${ht.capability}`);
    console.log(`     示例: ${ht.example}\n`);
  }
}

// ============================================================
// Demo 2: PreToolUse 阻止机制模拟
// ============================================================

function demo2_preToolUseSimulation() {
  console.log("🛡️ Demo 2: PreToolUse 阻止机制模拟\n");

  // 模拟 pre-write-guard hook
  const preWriteGuard: HookFunction = (input) => {
    const filePath = (input.tool_input.file_path as string) || "";

    const protectedPatterns = [".env", "credentials", "secrets", "private_key"];

    for (const pattern of protectedPatterns) {
      if (filePath.includes(pattern)) {
        return {
          decision: "block",
          reason: `🔒 安全防护: 禁止修改敏感文件 ${filePath}`,
        };
      }
    }

    return undefined; // 允许
  };

  // 模拟测试用例
  const testCases: HookInput[] = [
    { tool_name: "Write", tool_input: { file_path: "src/index.ts" } },
    { tool_name: "Write", tool_input: { file_path: ".env.local" } },
    { tool_name: "Edit", tool_input: { file_path: "config/credentials.json" } },
    { tool_name: "Write", tool_input: { file_path: "src/utils/helper.ts" } },
    { tool_name: "Edit", tool_input: { file_path: "secrets/api-keys.json" } },
  ];

  console.log("模拟 pre-write-guard.sh 的行为:\n");

  for (const tc of testCases) {
    const result = preWriteGuard(tc);
    const status = result?.decision === "block" ? "❌ 阻止" : "✅ 允许";
    console.log(`  ${status} | ${tc.tool_name}("${tc.tool_input.file_path}")`);
    if (result?.reason) {
      console.log(`         ${result.reason}`);
    }
  }
  console.log();
}

// ============================================================
// Demo 3: PostToolUse 后处理模拟
// ============================================================

function demo3_postToolUseSimulation() {
  console.log("🔄 Demo 3: PostToolUse 后处理模拟\n");

  // 模拟 post-edit-format hook
  const postEditFormat: HookFunction = (input) => {
    const filePath = (input.tool_input.file_path as string) || "";
    const ext = path.extname(filePath);

    const formatters: Record<string, string> = {
      ".ts": "prettier --write",
      ".tsx": "prettier --write",
      ".js": "prettier --write",
      ".json": "prettier --write",
      ".css": "prettier --write",
      ".py": "black",
      ".go": "gofmt -w",
      ".rs": "rustfmt",
    };

    const formatter = formatters[ext];
    if (formatter) {
      console.log(`  ✅ 自动格式化: ${formatter} "${filePath}"`);
    } else {
      console.log(`  ⏭️ 跳过格式化: ${filePath}（未知文件类型）`);
    }

    return undefined;
  };

  console.log("模拟 post-edit-format.sh 的行为:\n");

  const testFiles = [
    { tool_name: "Write", tool_input: { file_path: "src/index.ts" } },
    { tool_name: "Edit", tool_input: { file_path: "styles/main.css" } },
    { tool_name: "Write", tool_input: { file_path: "server.py" } },
    { tool_name: "Edit", tool_input: { file_path: "README.md" } },
    { tool_name: "Write", tool_input: { file_path: "image.png" } },
  ];

  for (const tf of testFiles) {
    postEditFormat(tf);
  }
  console.log();
}

// ============================================================
// Demo 4: Hook 配置详解
// ============================================================

function demo4_hookConfiguration() {
  console.log("⚙️ Demo 4: Hook 配置方式\n");

  console.log("在 settings.json 中配置 Hooks:\n");

  const exampleConfig = {
    hooks: {
      PreToolUse: [
        {
          matcher: "Write|Edit",
          hooks: [
            {
              type: "command",
              command: "bash .claude/hooks/pre-write-guard.sh",
            },
          ],
        },
      ],
      PostToolUse: [
        {
          matcher: "Write|Edit",
          hooks: [
            {
              type: "command",
              command: "bash .claude/hooks/post-edit-format.sh",
            },
          ],
        },
        {
          matcher: "Bash",
          hooks: [
            {
              type: "command",
              command: "bash .claude/hooks/post-commit-notify.sh",
            },
          ],
        },
      ],
    },
  };

  console.log(JSON.stringify(exampleConfig, null, 2));
  console.log();

  console.log("📌 配置说明:");
  console.log("  • matcher: 正则匹配工具名称（如 'Write|Edit' 匹配写入和编辑）");
  console.log("  • type: 'command' 表示执行 shell 命令");
  console.log("  • command: 要执行的命令，通过 stdin 接收 JSON 输入");
  console.log("  • Hook 脚本通过 stdin 接收: {tool_name, tool_input}");
  console.log("  • PreToolUse 脚本通过 stdout 返回: {decision, reason}");
  console.log();
}

// ============================================================
// Demo 5: 查看示例 Hook 脚本
// ============================================================

async function demo5_viewHookScripts() {
  console.log("📄 Demo 5: 示例 Hook 脚本\n");

  const hooks = ["pre-write-guard.sh", "post-edit-format.sh", "post-commit-notify.sh"];

  for (const hookFile of hooks) {
    const filePath = path.join(HOOKS_DIR, hookFile);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      console.log(`--- ${hookFile} ---`);
      // 只显示注释部分（前几行）
      const lines = content.split("\n");
      const commentLines = lines.filter(l => l.startsWith("#")).slice(0, 6);
      console.log(commentLines.join("\n"));
      console.log(`(共 ${lines.length} 行)\n`);
    } catch {
      console.log(`⚠️ ${hookFile} 未找到\n`);
    }
  }
}

// ============================================================
// 主入口
// ============================================================

async function main() {
  console.log("🚀 Claude Code Hooks 机制详解\n");
  console.log("=".repeat(60));

  demo1_hookConcepts();

  console.log("=".repeat(60));
  console.log();

  demo2_preToolUseSimulation();

  console.log("=".repeat(60));
  console.log();

  demo3_postToolUseSimulation();

  console.log("=".repeat(60));
  console.log();

  demo4_hookConfiguration();

  console.log("=".repeat(60));
  console.log();

  await demo5_viewHookScripts();

  console.log("=".repeat(60));
  console.log("✅ Hooks Demo 完成！");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("hooks-demo.ts");

if (isMainModule) {
  main().catch(console.error);
}
