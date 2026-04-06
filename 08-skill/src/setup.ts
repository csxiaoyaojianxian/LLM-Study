/**
 * setup.ts — 一键安装 Claude Skill 配置到项目
 *
 * 将示例配置复制到 .claude/ 目录，方便快速体验。
 *
 * 运行: npm run setup
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = path.resolve(__dirname, "../examples");

// 目标目录（当前模块根目录下的 .claude）
const TARGET_BASE = path.resolve(__dirname, "..");
const CLAUDE_DIR = path.join(TARGET_BASE, ".claude");

// ============================================================
// 辅助函数
// ============================================================

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function copyFile(src: string, dest: string, overwrite = false): Promise<boolean> {
  try {
    if (!overwrite) {
      try {
        await fs.access(dest);
        console.log(`  ⏭️ 跳过（已存在）: ${path.relative(TARGET_BASE, dest)}`);
        return false;
      } catch {
        // 文件不存在，继续复制
      }
    }

    await fs.copyFile(src, dest);
    console.log(`  ✅ 已安装: ${path.relative(TARGET_BASE, dest)}`);
    return true;
  } catch (err) {
    console.log(`  ❌ 复制失败: ${(err as Error).message}`);
    return false;
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

// ============================================================
// 安装函数
// ============================================================

async function installCommands(): Promise<number> {
  console.log("\n📝 安装项目级 Slash Commands...");
  const commandsDir = path.join(CLAUDE_DIR, "commands");
  await ensureDir(commandsDir);

  const files = await listFiles(path.join(EXAMPLES_DIR, "commands"));
  let installed = 0;
  for (const file of files) {
    const success = await copyFile(
      path.join(EXAMPLES_DIR, "commands", file),
      path.join(commandsDir, file)
    );
    if (success) installed++;
  }
  return installed;
}

async function installHooks(): Promise<number> {
  console.log("\n🪝 安装 Hook 脚本...");
  const hooksDir = path.join(CLAUDE_DIR, "hooks");
  await ensureDir(hooksDir);

  const files = await listFiles(path.join(EXAMPLES_DIR, "hooks"));
  let installed = 0;
  for (const file of files) {
    const success = await copyFile(
      path.join(EXAMPLES_DIR, "hooks", file),
      path.join(hooksDir, file)
    );
    if (success) {
      installed++;
      // 设置可执行权限
      await fs.chmod(path.join(hooksDir, file), 0o755);
    }
  }
  return installed;
}

async function installSettings(): Promise<number> {
  console.log("\n⚙️ 安装 settings.json...");
  await ensureDir(CLAUDE_DIR);

  let installed = 0;
  // 安装项目级 settings
  const success = await copyFile(
    path.join(EXAMPLES_DIR, "settings", "project-settings.json"),
    path.join(CLAUDE_DIR, "settings.json")
  );
  if (success) installed++;

  return installed;
}

// ============================================================
// 主入口
// ============================================================

async function main() {
  console.log("🚀 Claude Skill 一键安装\n");
  console.log(`📁 目标目录: ${CLAUDE_DIR}`);

  let totalInstalled = 0;

  totalInstalled += await installCommands();
  totalInstalled += await installHooks();
  totalInstalled += await installSettings();

  console.log("\n" + "=".repeat(50));
  console.log(`✅ 安装完成！共安装 ${totalInstalled} 个文件\n`);

  console.log("📁 安装结果:");
  console.log(`   ${CLAUDE_DIR}/`);

  // 列出已安装的文件
  async function printTree(dir: string, prefix: string = "   ") {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          console.log(`${prefix}├── ${entry.name}/`);
          await printTree(path.join(dir, entry.name), prefix + "│   ");
        } else {
          console.log(`${prefix}├── ${entry.name}`);
        }
      }
    } catch {
      // 目录不存在
    }
  }

  await printTree(CLAUDE_DIR);

  console.log("\n💡 使用方式:");
  console.log("   • 在 Claude Code 中输入 /project: 查看可用命令");
  console.log("   • Hooks 会在文件操作时自动触发");
  console.log("   • settings.json 会自动生效\n");

  console.log("⚠️ 注意:");
  console.log("   • 本安装仅作为演示，安装到了 08-skill/.claude/ 目录");
  console.log("   • 实际使用时请安装到你的项目根目录的 .claude/ 目录");
  console.log("   • 全局命令请复制到 ~/.claude/commands/ 目录");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("setup.ts");

if (isMainModule) {
  main().catch(console.error);
}
