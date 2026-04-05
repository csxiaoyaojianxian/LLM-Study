/**
 * chunking.ts — 文本分块策略实验
 *
 * 自行实现三种分块策略，对比不同策略的效果差异：
 * 1. 固定大小分块（Fixed-size）
 * 2. 递归字符分块（Recursive Character）— 中文友好
 * 3. 段落分块（Paragraph-based）
 *
 * 运行: npm run chunking
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================
// 1. 固定大小分块
// ============================================================

export interface FixedSizeOptions {
  chunkSize: number;   // 每块字符数
  overlap: number;     // 重叠字符数
}

/**
 * 按固定字符数切分文本
 * 优点：实现简单，块大小均匀
 * 缺点：可能在语义中间截断
 */
export function fixedSizeChunk(
  text: string,
  options: FixedSizeOptions = { chunkSize: 200, overlap: 50 }
): string[] {
  const { chunkSize, overlap } = options;
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    start += chunkSize - overlap;
  }

  return chunks;
}

// ============================================================
// 2. 递归字符分块（中文友好）
// ============================================================

export interface RecursiveOptions {
  chunkSize: number;      // 目标块大小
  overlap: number;        // 重叠大小
  separators?: string[];  // 分隔符优先级（从粗到细）
}

/**
 * 按分隔符优先级递归切分文本
 * 优先保留段落 → 句子 → 子句的完整性
 * 对中文内容友好，使用中文标点作为分隔符
 * 
 * 核心思想：用最粗粒度的分隔符切分文本，切不动再换更细的分隔符
 * 
 第1层: 尝试用 "\n\n"(段落) 切
    → 得到 [段落A(500字), 段落B(200字), 段落C(800字), ...]
    → 段落B ≤ 300 ✅ 直接保留
    → 段落A > 300 ❌ 递归，用下一级分隔符切 ↓

    第2层: 对段落A，尝试用 "\n"(换行) 切
      → 得到 [行1(150字), 行2(350字)]
      → 行1 ≤ 300 ✅
      → 行2 > 300 ❌ 继续递归 ↓

      第3层: 对行2，尝试用 "。"(句号) 切
        → 得到 [句1(120字), 句2(100字), 句3(130字)]
        → 合并: 句1+句2 = 220 ≤ 300 ✅ 放一块
        → 句3 单独一块 ✅
 */
export function recursiveCharacterChunk(
  text: string,
  options: RecursiveOptions = { chunkSize: 200, overlap: 50 }
): string[] {
  const { chunkSize, overlap } = options;
  const separators = options.separators ?? [
    "\n\n",   // 段落
    "\n",     // 换行
    "。",     // 中文句号
    "！",     // 中文感叹号
    "？",     // 中文问号
    "；",     // 中文分号
    ". ",     // 英文句号
    "! ",     // 英文感叹号
    "? ",     // 英文问号
    "，",     // 中文逗号
    ", ",     // 英文逗号
    " ",      // 空格
    "",       // 字符级（兜底）
  ];

  return recursiveSplit(text, separators, chunkSize, overlap);
}

function recursiveSplit(
  text: string,
  separators: string[],
  chunkSize: number,
  overlap: number
): string[] {
  if (text.length <= chunkSize) {
    return text.trim() ? [text.trim()] : [];
  }

  // 找到当前最合适的分隔符
  let currentSep = "";
  for (const sep of separators) {
    if (sep === "" || text.includes(sep)) {
      currentSep = sep;
      break;
    }
  }

  // 按分隔符切分
  const parts = currentSep
    ? text.split(currentSep).filter((p) => p.trim().length > 0)
    : [...text]; // 字符级切分

  const chunks: string[] = [];
  let currentChunk = "";

  for (const part of parts) {
    const candidate = currentChunk
      ? currentChunk + currentSep + part
      : part;

    if (candidate.length <= chunkSize) {
      currentChunk = candidate;
    } else {
      // 当前块已满
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }

      // 如果单个 part 超过 chunkSize，递归使用更细的分隔符
      if (part.length > chunkSize) {
        const remainingSeps = separators.slice(separators.indexOf(currentSep) + 1);
        if (remainingSeps.length > 0) {
          const subChunks = recursiveSplit(part, remainingSeps, chunkSize, overlap);
          chunks.push(...subChunks);
          currentChunk = "";
        } else {
          currentChunk = part;
        }
      } else {
        // 实现 overlap：从上一个块末尾取部分文本
        if (overlap > 0 && chunks.length > 0) {
          const lastChunk = chunks[chunks.length - 1];
          const overlapText = lastChunk.slice(-overlap);
          currentChunk = overlapText + currentSep + part;
        } else {
          currentChunk = part;
        }
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// ============================================================
// 3. 段落分块
// ============================================================

export interface ParagraphOptions {
  minChunkSize?: number;  // 最小块大小，小段落会合并
}

/**
 * 按自然段落切分文本
 * 优点：最好地保留语义完整性
 * 缺点：块大小不均匀
 */
export function paragraphChunk(
  text: string,
  options: ParagraphOptions = { minChunkSize: 100 }
): string[] {
  const { minChunkSize = 100 } = options;

  // 按双换行分段
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  // 合并过小的段落
  const chunks: string[] = [];
  let currentChunk = "";

  for (const para of paragraphs) {
    if (currentChunk && (currentChunk + "\n\n" + para).length > minChunkSize * 3) {
      // 当前块已经够大，先保存
      chunks.push(currentChunk);
      currentChunk = para;
    } else if (currentChunk) {
      currentChunk += "\n\n" + para;
    } else {
      currentChunk = para;
    }

    // 如果当前块已达到最小大小且是完整段落，可以保存
    if (currentChunk.length >= minChunkSize && para.endsWith("。")) {
      chunks.push(currentChunk);
      currentChunk = "";
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// ============================================================
// 4. Demo 入口 — 三种策略对比
// ============================================================

function printChunks(label: string, chunks: string[]) {
  console.log(`\n📦 ${label}（共 ${chunks.length} 块）`);
  console.log("-".repeat(60));

  for (let i = 0; i < chunks.length; i++) {
    const preview = chunks[i].replace(/\n/g, "↵").slice(0, 60);
    console.log(`  [${i + 1}] (${chunks[i].length}字) ${preview}...`);
  }
}

function printComparisonTable(results: { name: string; chunks: string[] }[]) {
  console.log("\n" + "=".repeat(60));
  console.log("📊 分块策略对比表");
  console.log("=".repeat(60));
  console.log(
    `${"策略".padEnd(20)}  ${"块数".padStart(6)}  ${"平均长度".padStart(8)}  ${"最小".padStart(6)}  ${"最大".padStart(6)}`
  );
  console.log("-".repeat(60));

  for (const { name, chunks } of results) {
    const lengths = chunks.map((c) => c.length);
    const avg = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
    const min = Math.min(...lengths);
    const max = Math.max(...lengths);

    console.log(
      `${name.padEnd(20)}  ${String(chunks.length).padStart(6)}  ${String(avg).padStart(8)}  ${String(min).padStart(6)}  ${String(max).padStart(6)}`
    );
  }
}

async function main() {
  console.log("✂️  chunking.ts — 文本分块策略实验\n");

  // 加载示例知识库
  const knowledgePath = resolve(__dirname, "../data/knowledge.md");
  const text = readFileSync(knowledgePath, "utf-8");
  console.log(`📄 加载文档: knowledge.md（${text.length} 字符）\n`);

  // 策略 1：固定大小
  const fixedChunks = fixedSizeChunk(text, { chunkSize: 300, overlap: 50 });
  printChunks("策略1 — 固定大小分块（300字/块，50字重叠）", fixedChunks);

  // 策略 2：递归字符
  const recursiveChunks = recursiveCharacterChunk(text, { chunkSize: 300, overlap: 50 });
  printChunks("策略2 — 递归字符分块（300字/块，中文标点优先）", recursiveChunks);

  // 策略 3：段落
  const paragraphChunks = paragraphChunk(text, { minChunkSize: 150 });
  printChunks("策略3 — 段落分块（最小150字）", paragraphChunks);

  // 对比表
  printComparisonTable([
    { name: "固定大小 (300/50)", chunks: fixedChunks },
    { name: "递归字符 (300/50)", chunks: recursiveChunks },
    { name: "段落分块 (min 150)", chunks: paragraphChunks },
  ]);

  console.log("\n" + "=".repeat(60));
  console.log("✅ 分块策略对比 Demo 完成！");
  console.log("\n💡 提示：递归字符分块通常是 RAG 场景的推荐选择，兼顾语义完整性和块大小均匀性。");
}

// 仅当直接运行时执行 demo
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("chunking.ts");

if (isMainModule) {
  main().catch(console.error);
}
