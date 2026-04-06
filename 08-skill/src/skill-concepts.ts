/**
 * skill-concepts.ts — Claude Code Skills 概念讲解
 *
 * 详细讲解 Claude Code 的 Skills 系统：
 * - 什么是 Skills（SKILL.md）
 * - Skills 与旧版 Custom Commands 的关系
 * - SKILL.md 文件结构（YAML frontmatter + 指令内容）
 * - 渐进式披露（Progressive Disclosure）三层架构
 * - Skills 的存放位置与作用域
 * - 创建 Skill 的最佳实践
 *
 * 无需 API Key，纯打印讲解
 *
 * 运行: npm run skill-concepts
 */

// ============================================================
// Demo 1: 什么是 Claude Code Skills
// ============================================================

function demo1_whatIsSkills() {
  console.log("📖 Demo 1: 什么是 Claude Code Skills\n");

  console.log("Skills 是 Claude Code 的能力扩展系统。");
  console.log("创建一个包含 SKILL.md 的文件夹，Claude 就会把它加入工具箱。");
  console.log("Claude 会在相关时自动使用 Skill，你也可以用 /skill-name 手动调用。\n");

  console.log(`
  ┌──────────────────────────────────────────────────────────┐
  │               Skills 工作原理                             │
  ├──────────────────────────────────────────────────────────┤
  │                                                          │
  │  ① 你创建一个 Skill 目录，里面放 SKILL.md                  │
  │     .claude/skills/review/SKILL.md                       │
  │                                                          │
  │  ② SKILL.md = YAML frontmatter + Markdown 指令            │
  │     frontmatter 告诉 Claude 何时用、怎么用                  │
  │     Markdown 内容是具体的操作指令                           │
  │                                                          │
  │  ③ Claude 自动发现并按需加载 Skill                          │
  │     → 对话时自动匹配（根据 description）                    │
  │     → 或者你手动输入 /review 触发                           │
  │                                                          │
  │  ④ Skill 目录还可以包含脚本、模板、参考文档等                │
  │     支持渐进式披露，按需加载，不浪费 token                   │
  │                                                          │
  └──────────────────────────────────────────────────────────┘
  `);

  console.log("📌 Skills 已合并 Custom Commands:");
  console.log("   旧版: .claude/commands/review.md    → /project:review");
  console.log("   新版: .claude/skills/review/SKILL.md → /review");
  console.log("   你的旧 commands 文件仍然有效，但 Skills 是推荐方式。");
  console.log("   Skills 额外支持：目录结构、frontmatter 配置、自动触发。");
  console.log();
}

// ============================================================
// Demo 2: SKILL.md 文件结构
// ============================================================

function demo2_skillMdStructure() {
  console.log("📄 Demo 2: SKILL.md 文件结构\n");

  console.log("每个 Skill 的核心是 SKILL.md 文件，由两部分组成:\n");

  console.log("  ┌─────────────── SKILL.md ───────────────┐");
  console.log("  │ ---                                     │ ← YAML frontmatter");
  console.log("  │ name: explain-code                      │    （元数据配置）");
  console.log("  │ description: 用图表和类比解释代码...      │");
  console.log("  │ ---                                     │");
  console.log("  │                                         │");
  console.log("  │ When explaining code, always include:   │ ← Markdown 内容");
  console.log("  │ 1. Start with an analogy                │    （操作指令）");
  console.log("  │ 2. Draw an ASCII diagram                │");
  console.log("  │ 3. Walk through step by step            │");
  console.log("  └─────────────────────────────────────────┘\n");

  console.log("📌 Frontmatter 常用字段:\n");

  const fields = [
    ["name", "推荐", "Skill 名称，也是 /slash-command 名，kebab-case 格式"],
    ["description", "推荐", "描述功能和使用场景，Claude 据此决定何时自动加载"],
    ["disable-model-invocation", "可选", "设为 true 则仅手动 /name 触发，Claude 不会自动调用"],
    ["user-invocable", "可选", "设为 false 则不显示在 / 菜单，仅 Claude 自动调用"],
    ["allowed-tools", "可选", "Skill 激活时允许使用的工具列表"],
    ["context", "可选", "设为 fork 在独立子代理中运行"],
    ["agent", "可选", "配合 context: fork，指定子代理类型"],
    ["argument-hint", "可选", "自动补全时的参数提示，如 [issue-number]"],
  ];

  for (const [field, required, desc] of fields) {
    const tag = required === "推荐" ? "🟢" : "⚪";
    console.log(`   ${tag} ${field.padEnd(28)} ${required.padEnd(4)} ${desc}`);
  }
  console.log();

  console.log("📌 完整 Skill 目录结构:\n");
  console.log("   my-skill/");
  console.log("   ├── SKILL.md           # 主指令文件（必需）");
  console.log("   ├── template.md        # 模板文件（可选）");
  console.log("   ├── examples/");
  console.log("   │   └── sample.md      # 示例输出（可选）");
  console.log("   └── scripts/");
  console.log("       └── validate.sh    # 可执行脚本（可选）");
  console.log();

  console.log("📌 变量替换:\n");
  const vars = [
    ["$ARGUMENTS", "调用时传入的所有参数"],
    ["$ARGUMENTS[N] / $N", "按位置访问参数，如 $0 第一个参数"],
    ["${CLAUDE_SESSION_ID}", "当前会话 ID"],
    ["${CLAUDE_SKILL_DIR}", "Skill 所在目录的路径"],
  ];
  for (const [v, desc] of vars) {
    console.log(`   ${v.padEnd(25)} ${desc}`);
  }
  console.log();
}

// ============================================================
// Demo 3: 渐进式披露（Progressive Disclosure）
// ============================================================

function demo3_progressiveDisclosure() {
  console.log("🔍 Demo 3: 渐进式披露架构\n");

  console.log("Skills 采用三层渐进式加载，最大限度节省 token:\n");

  console.log(`
  ┌──────────────────────────────────────────────────────────────┐
  │ Layer 1: 元数据（约 100 tokens）              ← 始终加载      │
  │ ─────────────────────────────────────────────                │
  │ 只读取 YAML frontmatter 的 name + description               │
  │ Claude 扫描所有 Skill，判断哪个与当前任务相关                 │
  ├──────────────────────────────────────────────────────────────┤
  │ Layer 2: 主指令（< 5000 tokens）              ← 匹配时加载   │
  │ ─────────────────────────────────────────────                │
  │ Claude 判断某个 Skill 相关后，加载完整 SKILL.md 内容          │
  │ 包含操作步骤、规则约束、输出格式等                            │
  ├──────────────────────────────────────────────────────────────┤
  │ Layer 3: 附属资源                              ← 按需加载    │
  │ ─────────────────────────────────────────────                │
  │ scripts/、templates/、references/ 中的文件                   │
  │ 仅在 Claude 执行具体步骤时才读取                              │
  └──────────────────────────────────────────────────────────────┘
  `);

  console.log("   💡 对比旧方案：Custom Commands 一次性加载全部内容到上下文");
  console.log("      Skills 通过分层加载，上下文占用降低 80%+");
  console.log();
}

// ============================================================
// Demo 4: Skills 存放位置与作用域
// ============================================================

function demo4_locations() {
  console.log("📁 Demo 4: Skills 存放位置与作用域\n");

  console.log("存放位置决定了谁能使用这个 Skill:\n");

  const locations = [
    ["Enterprise（企业）", "managed settings 管理", "组织内所有用户"],
    ["Personal（个人）", "~/.claude/skills/<name>/SKILL.md", "你的所有项目"],
    ["Project（项目）", ".claude/skills/<name>/SKILL.md", "仅当前项目"],
    ["Plugin（插件）", "<plugin>/skills/<name>/SKILL.md", "启用插件的项目"],
  ];

  console.log("  ┌──────────────┬──────────────────────────────────┬──────────────────┐");
  console.log("  │ 级别         │ 路径                              │ 适用范围         │");
  console.log("  ├──────────────┼──────────────────────────────────┼──────────────────┤");
  for (const [level, path, scope] of locations) {
    console.log(`  │ ${level.padEnd(12)} │ ${path.padEnd(32)} │ ${scope.padEnd(16)} │`);
  }
  console.log("  └──────────────┴──────────────────────────────────┴──────────────────┘");
  console.log();

  console.log("📌 优先级: Enterprise > Personal > Project");
  console.log("   同名 Skill 高优先级覆盖低优先级。");
  console.log("   Plugin Skill 使用 plugin-name:skill-name 命名空间，不会冲突。");
  console.log();

  console.log("📌 Monorepo 支持:");
  console.log("   在子目录工作时，Claude 自动发现嵌套的 .claude/skills/");
  console.log("   例如编辑 packages/frontend/ 下的文件时，");
  console.log("   也会加载 packages/frontend/.claude/skills/ 中的 Skill。");
  console.log();
}

// ============================================================
// Demo 5: 调用控制与实战示例
// ============================================================

function demo5_invocationAndExamples() {
  console.log("🎮 Demo 5: 调用控制与实战示例\n");

  console.log("📌 谁来调用 Skill？\n");

  console.log("  ┌────────────────────────────────┬──────────┬────────────┬─────────────────────┐");
  console.log("  │ frontmatter 配置               │ 你可调用 │ Claude调用 │ 典型场景            │");
  console.log("  ├────────────────────────────────┼──────────┼────────────┼─────────────────────┤");
  console.log("  │ （默认）                        │ ✅       │ ✅         │ 通用 Skill          │");
  console.log("  │ disable-model-invocation: true │ ✅       │ ❌         │ deploy / commit     │");
  console.log("  │ user-invocable: false          │ ❌       │ ✅         │ 背景知识 / 约定     │");
  console.log("  └────────────────────────────────┴──────────┴────────────┴─────────────────────┘");
  console.log();

  console.log("📌 实战示例 1: 代码审查 Skill（默认，双向可调用）\n");
  console.log("   .claude/skills/review/SKILL.md:");
  console.log("   ┌────────────────────────────────────────────────────┐");
  console.log("   │ ---                                                │");
  console.log("   │ name: review                                       │");
  console.log("   │ description: Review code for quality, security,    │");
  console.log("   │   and best practices. Use when reviewing PRs or    │");
  console.log("   │   checking code changes.                           │");
  console.log("   │ ---                                                │");
  console.log("   │                                                    │");
  console.log("   │ Review the code with these criteria:               │");
  console.log("   │ 1. Security vulnerabilities                        │");
  console.log("   │ 2. Performance issues                              │");
  console.log("   │ 3. Code style and naming                           │");
  console.log("   │ Rate: 🔴 must fix / 🟡 suggest / 🟢 minor          │");
  console.log("   └────────────────────────────────────────────────────┘");
  console.log("   用法: /review src/auth.ts  或让 Claude 自动触发\n");

  console.log("📌 实战示例 2: 部署 Skill（仅手动触发）\n");
  console.log("   .claude/skills/deploy/SKILL.md:");
  console.log("   ┌────────────────────────────────────────────────────┐");
  console.log("   │ ---                                                │");
  console.log("   │ name: deploy                                       │");
  console.log("   │ description: Deploy application to production      │");
  console.log("   │ disable-model-invocation: true                     │");
  console.log("   │ ---                                                │");
  console.log("   │                                                    │");
  console.log("   │ Deploy $ARGUMENTS to production:                   │");
  console.log("   │ 1. Run test suite                                  │");
  console.log("   │ 2. Build the application                           │");
  console.log("   │ 3. Push to deployment target                       │");
  console.log("   │ 4. Verify deployment succeeded                     │");
  console.log("   └────────────────────────────────────────────────────┘");
  console.log("   用法: /deploy staging （Claude 不会自动触发部署）\n");

  console.log("📌 实战示例 3: 动态上下文注入（!`command` 语法）\n");
  console.log("   Skill 中可以用 !`command` 在发送给 Claude 前执行 shell 命令，");
  console.log("   输出会替换到 Skill 内容中：\n");
  console.log("   ┌────────────────────────────────────────────────────┐");
  console.log("   │ ---                                                │");
  console.log("   │ name: pr-summary                                   │");
  console.log("   │ description: Summarize PR changes                  │");
  console.log("   │ context: fork                                      │");
  console.log("   │ agent: Explore                                     │");
  console.log("   │ ---                                                │");
  console.log("   │                                                    │");
  console.log("   │ ## PR Context                                      │");
  console.log("   │ - Diff: !`gh pr diff`                              │");
  console.log("   │ - Comments: !`gh pr view --comments`               │");
  console.log("   │                                                    │");
  console.log("   │ Summarize this pull request.                       │");
  console.log("   └────────────────────────────────────────────────────┘");
  console.log("   !`gh pr diff` 先执行，Claude 收到的是实际 diff 内容\n");
}

// ============================================================
// Demo 6: 内置 Bundled Skills
// ============================================================

function demo6_bundledSkills() {
  console.log("📦 Demo 6: 内置 Bundled Skills\n");

  console.log("Claude Code 自带以下 Bundled Skills，每个会话都可用:\n");

  const bundled = [
    ["/batch <instruction>", "大规模并行改代码，每个单元在独立 worktree 中执行并开 PR"],
    ["/claude-api", "加载 Claude API 参考文档（支持多语言 SDK）"],
    ["/debug [description]", "开启 debug 日志并排查问题"],
    ["/loop [interval] <prompt>", "定时重复执行提示（如每 5 分钟检查部署）"],
    ["/simplify [focus]", "审查最近修改的代码，并行检查复用性/质量/效率"],
  ];

  for (const [cmd, desc] of bundled) {
    console.log(`   ${cmd.padEnd(30)} ${desc}`);
  }
  console.log();

  console.log("   💡 Bundled Skills 和自定义 Skills 的区别:");
  console.log("      Bundled Skills 是 prompt-based 的，它们给 Claude 一个详细的 playbook，");
  console.log("      Claude 可以派生并行 agent、读文件、适配你的代码库。");
  console.log();
}

// ============================================================
// Demo 7: Skills vs 旧版四大定制机制
// ============================================================

function demo7_skillsVsLegacy() {
  console.log("⚖️  Demo 7: Skills 体系 vs 旧版定制机制\n");

  console.log("Skills 是 Claude Code 定制能力的新统一入口，与 Hooks/Settings/CLAUDE.md 协同:\n");

  console.log(`
  ┌──────────────────────────────────────────────────────────────────┐
  │                    Claude Code 定制体系全景                       │
  ├──────────────────────────────────────────────────────────────────┤
  │                                                                  │
  │  ┌─────────────────────┐   ┌──────────────────────────┐         │
  │  │ Skills（SKILL.md）  │   │ CLAUDE.md（项目记忆）    │         │
  │  │ 可复用的能力包       │   │ 项目上下文和约定         │         │
  │  │ /命令 + 自动触发    │   │ 启动时自动加载           │         │
  │  │ 合并了 Commands     │   │                          │         │
  │  └────────┬────────────┘   └──────────────────────────┘         │
  │           │                                                      │
  │  ┌────────▼────────────┐   ┌──────────────────────────┐         │
  │  │ Hooks（钩子）       │   │ Settings（权限配置）     │         │
  │  │ 事件驱动的自动化     │   │ allow/deny 工具访问      │         │
  │  │ Skill 可自带 hooks  │   │ 三层优先级               │         │
  │  └─────────────────────┘   └──────────────────────────┘         │
  │                                                                  │
  │  协同方式:                                                       │
  │  • CLAUDE.md 告诉 Claude「你在哪个项目、有什么规范」              │
  │  • Skills   告诉 Claude「你能做什么、怎么做」                     │
  │  • Hooks    告诉 Claude「操作前后自动执行什么」                   │
  │  • Settings 告诉 Claude「你的权限边界在哪里」                     │
  │                                                                  │
  └──────────────────────────────────────────────────────────────────┘
  `);

  console.log("📌 Skills 与旧版 Custom Commands 的对比:\n");

  console.log("  ┌──────────────────────┬───────────────────────┬───────────────────────┐");
  console.log("  │ 特性                 │ Custom Commands (旧)  │ Skills (新)           │");
  console.log("  ├──────────────────────┼───────────────────────┼───────────────────────┤");
  console.log("  │ 文件格式             │ 单个 .md 文件          │ SKILL.md + 目录       │");
  console.log("  │ 存放位置             │ .claude/commands/     │ .claude/skills/       │");
  console.log("  │ 调用方式             │ /project:name 或      │ /name                 │");
  console.log("  │                      │ /user:name            │                       │");
  console.log("  │ 自动触发             │ ❌ 仅手动调用          │ ✅ Claude 自动匹配     │");
  console.log("  │ 附属文件             │ ❌ 只有一个 .md        │ ✅ 脚本/模板/参考      │");
  console.log("  │ Frontmatter 配置     │ ❌                    │ ✅ 丰富的控制选项      │");
  console.log("  │ 渐进式披露           │ ❌ 全量加载            │ ✅ 三层按需加载        │");
  console.log("  │ 子代理执行           │ ❌                    │ ✅ context: fork       │");
  console.log("  │ 自带 Hooks           │ ❌                    │ ✅ hooks 字段          │");
  console.log("  └──────────────────────┴───────────────────────┴───────────────────────┘");
  console.log();
  console.log("   💡 旧版 .claude/commands/*.md 仍然有效，但推荐迁移到 Skills。");
  console.log();
}

// ============================================================
// 主入口
// ============================================================

function main() {
  console.log("🚀 Claude Code Skills 概念讲解\n");
  console.log("=".repeat(60));
  console.log();

  demo1_whatIsSkills();

  console.log("=".repeat(60));
  console.log();

  demo2_skillMdStructure();

  console.log("=".repeat(60));
  console.log();

  demo3_progressiveDisclosure();

  console.log("=".repeat(60));
  console.log();

  demo4_locations();

  console.log("=".repeat(60));
  console.log();

  demo5_invocationAndExamples();

  console.log("=".repeat(60));
  console.log();

  demo6_bundledSkills();

  console.log("=".repeat(60));
  console.log();

  demo7_skillsVsLegacy();

  console.log("=".repeat(60));
  console.log("✅ Claude Code Skills 概念讲解完成！");
  console.log("💡 接下来运行 npm run showcase 了解 Hooks / Settings / CLAUDE.md 详情");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("skill-concepts.ts");

if (isMainModule) {
  main();
}
