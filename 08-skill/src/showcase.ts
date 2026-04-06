/**
 * showcase.ts — Claude Skill 总览
 *
 * 读取所有示例配置文件并讲解其用途和配置方式。
 *
 * 运行: npm run showcase
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = path.resolve(__dirname, "../examples");

// ============================================================
// 辅助函数
// ============================================================

async function readFileContent(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return "(文件不存在)";
  }
}

async function listFiles(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter(e => e.isFile()).map(e => e.name);
  } catch {
    return [];
  }
}

function printSection(title: string) {
  console.log("\n" + "=".repeat(60));
  console.log(`  ${title}`);
  console.log("=".repeat(60) + "\n");
}

function printFilePreview(filename: string, content: string, maxLines = 15) {
  console.log(`📄 ${filename}`);
  console.log("-".repeat(40));
  const lines = content.split("\n");
  const preview = lines.slice(0, maxLines);
  console.log(preview.join("\n"));
  if (lines.length > maxLines) {
    console.log(`... (共 ${lines.length} 行，已截取前 ${maxLines} 行)`);
  }
  console.log();
}

// ============================================================
// 1. Slash Commands 展示
// ============================================================

async function showcaseCommands() {
  printSection("📝 Slash Commands（自定义命令）");

  console.log("💡 什么是 Slash Commands？");
  console.log("   在 Claude Code 中输入 / 触发的自定义命令");
  console.log("   本质是 Markdown 格式的 Prompt 模板\n");

  console.log("📁 两种作用域:");
  console.log("   • 项目命令 — .claude/commands/*.md → /project:命令名");
  console.log("   • 个人命令 — ~/.claude/commands/*.md → /user:命令名\n");

  console.log("📌 模板变量:");
  console.log("   • $ARGUMENTS — 用户输入的参数");
  console.log("   • 支持引用文件内容作为上下文\n");

  // 项目命令
  console.log("--- 项目级命令 (examples/commands/) ---\n");
  const commands = await listFiles(path.join(EXAMPLES_DIR, "commands"));
  for (const file of commands) {
    const content = await readFileContent(path.join(EXAMPLES_DIR, "commands", file));
    const name = file.replace(".md", "");
    console.log(`🔹 /project:${name}`);
    // 提取第一行描述
    const firstLine = content.split("\n").find(l => l.startsWith("You are"))?.substring(0, 80) || "";
    console.log(`   ${firstLine}...`);
    console.log(`   安装: cp examples/commands/${file} .claude/commands/\n`);
  }

  // 个人命令
  console.log("--- 个人全局命令 (examples/user-commands/) ---\n");
  const userCommands = await listFiles(path.join(EXAMPLES_DIR, "user-commands"));
  for (const file of userCommands) {
    const content = await readFileContent(path.join(EXAMPLES_DIR, "user-commands", file));
    const name = file.replace(".md", "");
    console.log(`🔹 /user:${name}`);
    const firstLine = content.split("\n").find(l => l.startsWith("You are"))?.substring(0, 80) || "";
    console.log(`   ${firstLine}...`);
    console.log(`   安装: cp examples/user-commands/${file} ~/.claude/commands/\n`);
  }
}

// ============================================================
// 2. Hooks 展示
// ============================================================

async function showcaseHooks() {
  printSection("🪝 Hooks（自动化钩子）");

  console.log("💡 什么是 Hooks？");
  console.log("   在 Claude Code 特定操作前后自动执行的脚本");
  console.log("   类似 Git Hooks，但针对 Claude 的工具调用\n");

  console.log("📌 Hook 类型:");
  console.log("   ┌─────────────────┬─────────────────────────────────┐");
  console.log("   │ Hook 类型        │ 触发时机                         │");
  console.log("   ├─────────────────┼─────────────────────────────────┤");
  console.log("   │ PreToolUse      │ 工具调用前（可阻止操作）          │");
  console.log("   │ PostToolUse     │ 工具调用后（可后处理）            │");
  console.log("   │ Notification    │ Claude 发送通知时                │");
  console.log("   │ Stop            │ Agent 循环结束时                 │");
  console.log("   └─────────────────┴─────────────────────────────────┘\n");

  console.log("📌 PreToolUse 特殊能力:");
  console.log("   输出 JSON {\"decision\": \"block\", \"reason\": \"...\"} 可阻止操作\n");

  const hooks = await listFiles(path.join(EXAMPLES_DIR, "hooks"));
  for (const file of hooks) {
    const content = await readFileContent(path.join(EXAMPLES_DIR, "hooks", file));
    printFilePreview(file, content, 10);
  }
}

// ============================================================
// 3. Settings 展示
// ============================================================

async function showcaseSettings() {
  printSection("⚙️ Settings（配置管理）");

  console.log("💡 settings.json 层级（优先级从高到低）:");
  console.log("   1. 🔒 .claude/settings.local.json  — 本地覆盖（不提交 git）");
  console.log("   2. 📁 .claude/settings.json         — 项目级（提交到 git）");
  console.log("   3. 🌐 ~/.claude/settings.json       — 全局（适用所有项目）\n");

  console.log("📌 合并规则:");
  console.log("   • permissions.allow: 取并集");
  console.log("   • permissions.deny: 取并集（deny 优先于 allow）");
  console.log("   • hooks: 同类型按层级覆盖");
  console.log("   • 其他字段: 高优先级覆盖低优先级\n");

  const settingsFiles = ["global-settings.json", "project-settings.json", "local-settings.json"];
  for (const file of settingsFiles) {
    const content = await readFileContent(path.join(EXAMPLES_DIR, "settings", file));
    printFilePreview(file, content, 20);
  }
}

// ============================================================
// 4. CLAUDE.md 展示
// ============================================================

async function showcaseClaudeMd() {
  printSection("📋 CLAUDE.md（项目指令）");

  console.log("💡 什么是 CLAUDE.md？");
  console.log("   放在项目根目录的 Markdown 文件");
  console.log("   Claude Code 启动时自动读取，作为项目上下文\n");

  console.log("📌 用途:");
  console.log("   • 描述项目结构和技术栈");
  console.log("   • 定义编码规范和约定");
  console.log("   • 指定构建/运行/测试命令");
  console.log("   • 标注注意事项和限制\n");

  console.log("📌 层级:");
  console.log("   • 项目根目录: CLAUDE.md（团队共享）");
  console.log("   • 子目录: CLAUDE.md（模块级别补充）");
  console.log("   • 父目录: CLAUDE.md（工作区级别）\n");

  const templates = await listFiles(path.join(EXAMPLES_DIR, "claude-md"));
  for (const file of templates) {
    const content = await readFileContent(path.join(EXAMPLES_DIR, "claude-md", file));
    printFilePreview(file, content, 12);
  }
}

// ============================================================
// 主入口
// ============================================================

async function main() {
  console.log("🚀 Claude Skill 开发总览\n");
  console.log("本模块涵盖 Claude Code 的四大定制能力:\n");
  console.log("  1. 📝 Slash Commands — 自定义命令（/project:xxx、/user:xxx）");
  console.log("  2. 🪝 Hooks — 自动化钩子（PreToolUse、PostToolUse）");
  console.log("  3. ⚙️  Settings — 配置管理（权限、偏好、分层覆盖）");
  console.log("  4. 📋 CLAUDE.md — 项目指令（上下文、规范、约定）");

  await showcaseCommands();
  await showcaseHooks();
  await showcaseSettings();
  await showcaseClaudeMd();

  printSection("✅ 总览完成");
  console.log("💡 下一步:");
  console.log("   npm run hooks-demo        # Hook 机制详解");
  console.log("   npm run settings-explain  # Settings 层级详解");
  console.log("   npm run setup             # 一键安装到项目");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("showcase.ts");

if (isMainModule) {
  main().catch(console.error);
}
