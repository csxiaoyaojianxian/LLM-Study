/**
 * settings-explain.ts — settings.json 层级与合并规则
 *
 * 详细讲解 Claude Code 的 settings.json 配置系统：
 * - 三层配置优先级
 * - 权限控制（allow/deny）
 * - 合并规则
 * - 常用配置项
 *
 * 运行: npm run settings-explain
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SETTINGS_DIR = path.resolve(__dirname, "../examples/settings");

// ============================================================
// Demo 1: 三层配置体系
// ============================================================

function demo1_configLayers() {
  console.log("📖 Demo 1: Settings 三层配置体系\n");

  console.log("Claude Code 使用三层 settings.json 配置，从高到低:\n");

  console.log(`
  优先级高 ─────────────────────────────── 优先级低

  ┌─────────────────────┐
  │ settings.local.json │  ← 本地覆盖（不提交 git）
  │ .claude/            │     个人开发环境特殊配置
  └─────────┬───────────┘
            │ 覆盖
  ┌─────────▼───────────┐
  │ settings.json       │  ← 项目级（提交到 git）
  │ .claude/            │     团队共享的项目配置
  └─────────┬───────────┘
            │ 覆盖
  ┌─────────▼───────────┐
  │ settings.json       │  ← 全局（所有项目通用）
  │ ~/.claude/          │     个人默认偏好
  └─────────────────────┘
  `);

  console.log("📌 文件位置:");
  console.log("   全局: ~/.claude/settings.json");
  console.log("   项目: <project>/.claude/settings.json");
  console.log("   本地: <project>/.claude/settings.local.json");
  console.log();
}

// ============================================================
// Demo 2: 权限控制
// ============================================================

function demo2_permissions() {
  console.log("🔒 Demo 2: 权限控制 (permissions)\n");

  console.log("permissions 控制 Claude 可以使用哪些工具:\n");

  console.log("📌 allow 列表（白名单）:");
  console.log("   允许 Claude 自动使用的工具，无需每次确认\n");

  const allowExamples = [
    ["Read", "允许读取文件"],
    ["Glob", "允许文件搜索"],
    ["Grep", "允许内容搜索"],
    ["Bash(npm run *)", "允许运行 npm 脚本"],
    ["Bash(git *)", "允许 git 操作"],
    ["Write(src/**)", "允许写入 src 目录"],
    ["Edit(src/**)", "允许编辑 src 目录"],
  ];

  for (const [pattern, desc] of allowExamples) {
    console.log(`   ✅ "${pattern}" — ${desc}`);
  }
  console.log();

  console.log("📌 deny 列表（黑名单，优先于 allow）:");
  console.log("   永远禁止的操作\n");

  const denyExamples = [
    ["Bash(rm -rf *)", "禁止删除操作"],
    ["Bash(git push --force *)", "禁止强制推送"],
    ["Write(.env*)", "禁止写入环境变量文件"],
    ["Bash(curl * | bash)", "禁止管道执行"],
  ];

  for (const [pattern, desc] of denyExamples) {
    console.log(`   ❌ "${pattern}" — ${desc}`);
  }
  console.log();

  console.log("📌 匹配规则:");
  console.log("   • 工具名 + 参数: Write(.env*) 匹配写入 .env 开头的文件");
  console.log("   • 通配符 *: Bash(npm run *) 匹配所有 npm run 命令");
  console.log("   • deny 优先: 同时出现在 allow 和 deny 中时，deny 生效");
  console.log();
}

// ============================================================
// Demo 3: 合并规则
// ============================================================

function demo3_mergeRules() {
  console.log("🔀 Demo 3: 配置合并规则\n");

  console.log("当多层配置同时存在时的合并逻辑:\n");

  // 模拟合并
  const globalConfig = {
    permissions: {
      allow: ["Read", "Glob", "Grep"],
      deny: [],
    },
  };

  const projectConfig = {
    permissions: {
      allow: ["Bash(npm run *)", "Write(src/**)"],
      deny: ["Bash(rm -rf *)"],
    },
  };

  const localConfig = {
    permissions: {
      allow: ["Bash(docker *)"],
      deny: [],
    },
  };

  console.log("   全局 allow:", JSON.stringify(globalConfig.permissions.allow));
  console.log("   项目 allow:", JSON.stringify(projectConfig.permissions.allow));
  console.log("   本地 allow:", JSON.stringify(localConfig.permissions.allow));
  console.log();

  // 合并后
  const mergedAllow = [
    ...globalConfig.permissions.allow,
    ...projectConfig.permissions.allow,
    ...localConfig.permissions.allow,
  ];
  const mergedDeny = [
    ...globalConfig.permissions.deny,
    ...projectConfig.permissions.deny,
    ...localConfig.permissions.deny,
  ];

  console.log("   ✅ 合并后 allow（取并集）:", JSON.stringify(mergedAllow));
  console.log("   ❌ 合并后 deny（取并集）:", JSON.stringify(mergedDeny));
  console.log();

  console.log("📌 合并规则总结:");
  console.log("   • permissions.allow — 所有层级取并集");
  console.log("   • permissions.deny — 所有层级取并集");
  console.log("   • hooks — 同 matcher 的 hook，高优先级覆盖");
  console.log("   • 其他字段 — 高优先级覆盖低优先级");
  console.log();
}

// ============================================================
// Demo 4: 常用配置模式
// ============================================================

function demo4_commonPatterns() {
  console.log("💡 Demo 4: 常用配置模式\n");

  const patterns = [
    {
      name: "安全优先型",
      desc: "适合生产项目，限制危险操作",
      config: {
        permissions: {
          allow: ["Read", "Glob", "Grep"],
          deny: ["Bash(rm *)", "Bash(git push *)", "Write(.env*)"],
        },
      },
    },
    {
      name: "开发宽松型",
      desc: "适合个人项目，减少确认弹窗",
      config: {
        permissions: {
          allow: ["Read", "Glob", "Grep", "Write", "Edit", "Bash(npm *)", "Bash(git *)"],
          deny: ["Bash(rm -rf /)"],
        },
      },
    },
    {
      name: "CI/CD 型",
      desc: "适合自动化流水线",
      config: {
        permissions: {
          allow: ["Read", "Glob", "Grep", "Bash(npm run test)", "Bash(npm run build)"],
          deny: ["Write", "Edit", "Bash(git push *)"],
        },
      },
    },
  ];

  for (const p of patterns) {
    console.log(`  📋 ${p.name}`);
    console.log(`     ${p.desc}`);
    console.log(`     ${JSON.stringify(p.config, null, 2).split("\n").join("\n     ")}\n`);
  }
}

// ============================================================
// Demo 5: 查看示例配置
// ============================================================

async function demo5_viewExamples() {
  console.log("📄 Demo 5: 示例配置文件\n");

  const files = ["global-settings.json", "project-settings.json", "local-settings.json"];

  for (const file of files) {
    const filePath = path.join(SETTINGS_DIR, file);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      console.log(`--- ${file} ---`);
      // 截取前 15 行
      const lines = content.split("\n").slice(0, 15);
      console.log(lines.join("\n"));
      console.log(`(共 ${content.split("\n").length} 行)\n`);
    } catch {
      console.log(`⚠️ ${file} 未找到\n`);
    }
  }
}

// ============================================================
// 主入口
// ============================================================

async function main() {
  console.log("🚀 Settings.json 配置详解\n");
  console.log("=".repeat(60));
  console.log();

  demo1_configLayers();

  console.log("=".repeat(60));
  console.log();

  demo2_permissions();

  console.log("=".repeat(60));
  console.log();

  demo3_mergeRules();

  console.log("=".repeat(60));
  console.log();

  demo4_commonPatterns();

  console.log("=".repeat(60));
  console.log();

  await demo5_viewExamples();

  console.log("=".repeat(60));
  console.log("✅ Settings 详解 Demo 完成！");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("settings-explain.ts");

if (isMainModule) {
  main().catch(console.error);
}
