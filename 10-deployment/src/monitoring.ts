/**
 * monitoring.ts — 监控与日志
 *
 * 演示生产环境的结构化日志、性能指标收集、Dashboard 汇总。
 * 纯逻辑演示，无需 API Key。
 *
 * 运行: npm run monitoring
 */

// ============================================================
// 1. 结构化日志
// ============================================================

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  data?: Record<string, unknown>;
  duration_ms?: number;
  request_id?: string;
}

class StructuredLogger {
  private logs: LogEntry[] = [];

  log(level: LogLevel, event: string, data?: Record<string, unknown>, extra?: Partial<LogEntry>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      data,
      ...extra,
    };
    this.logs.push(entry);

    // 同时输出到控制台
    const icon = { info: "ℹ️", warn: "⚠️", error: "❌", debug: "🔍" }[level];
    const json = JSON.stringify(entry);
    console.log(`  ${icon} ${json}`);
  }

  info(event: string, data?: Record<string, unknown>, extra?: Partial<LogEntry>): void {
    this.log("info", event, data, extra);
  }

  warn(event: string, data?: Record<string, unknown>, extra?: Partial<LogEntry>): void {
    this.log("warn", event, data, extra);
  }

  error(event: string, data?: Record<string, unknown>, extra?: Partial<LogEntry>): void {
    this.log("error", event, data, extra);
  }

  getAllLogs(): LogEntry[] {
    return [...this.logs];
  }
}

// ============================================================
// 2. 性能指标收集器
// ============================================================

interface MetricPoint {
  timestamp: number;
  value: number;
}

class MetricsCollector {
  private metrics: Map<string, MetricPoint[]> = new Map();

  /** 记录一个指标值 */
  record(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push({ timestamp: Date.now(), value });
  }

  /** 获取指标统计 */
  getStats(name: string): { count: number; min: number; max: number; avg: number; p50: number; p95: number; p99: number } | null {
    const points = this.metrics.get(name);
    if (!points || points.length === 0) return null;

    const values = points.map((p) => p.value).sort((a, b) => a - b);
    const count = values.length;
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count,
      min: values[0],
      max: values[count - 1],
      avg: sum / count,
      p50: values[Math.floor(count * 0.5)],
      p95: values[Math.floor(count * 0.95)],
      p99: values[Math.floor(count * 0.99)],
    };
  }

  /** 获取所有指标名称 */
  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }
}

// ============================================================
// 3. Dashboard
// ============================================================

interface DashboardReport {
  period: string;
  totalRequests: number;
  successRate: string;
  avgLatency: string;
  totalTokens: number;
  totalCost: string;
  errorBreakdown: Record<string, number>;
}

class Dashboard {
  private requestCount = 0;
  private successCount = 0;
  private errorCount = 0;
  private errors: Record<string, number> = {};
  private totalTokens = 0;
  private totalCost = 0;
  private latencies: number[] = [];

  recordRequest(success: boolean, latencyMs: number, tokens: number, cost: number, errorType?: string): void {
    this.requestCount++;
    this.latencies.push(latencyMs);
    this.totalTokens += tokens;
    this.totalCost += cost;

    if (success) {
      this.successCount++;
    } else {
      this.errorCount++;
      if (errorType) {
        this.errors[errorType] = (this.errors[errorType] || 0) + 1;
      }
    }
  }

  getReport(): DashboardReport {
    const avgLatency = this.latencies.length > 0
      ? (this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length).toFixed(0)
      : "0";

    return {
      period: new Date().toISOString().split("T")[0],
      totalRequests: this.requestCount,
      successRate: this.requestCount > 0
        ? `${((this.successCount / this.requestCount) * 100).toFixed(1)}%`
        : "N/A",
      avgLatency: `${avgLatency}ms`,
      totalTokens: this.totalTokens,
      totalCost: `$${this.totalCost.toFixed(4)}`,
      errorBreakdown: { ...this.errors },
    };
  }
}

// ============================================================
// Demo 函数
// ============================================================

/** Demo 1: 生产环境监控要素讲解 */
function demo1_concepts(): void {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 1: 生产环境监控要素                        ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  console.log("📚 LLM 应用监控的关键指标：");
  console.log("─────────────────────────────────────────");
  console.log("  📊 请求指标");
  console.log("     • QPS / RPM — 每秒/每分钟请求数");
  console.log("     • 成功率 — 非错误响应占比");
  console.log("     • 延迟分布 — P50 / P95 / P99\n");

  console.log("  💰 成本指标");
  console.log("     • Token 消耗量（输入 + 输出）");
  console.log("     • 实时/日/月成本");
  console.log("     • 各模型成本占比\n");

  console.log("  ❌ 错误指标");
  console.log("     • 错误率 & 错误类型分布");
  console.log("     • 429 限流次数");
  console.log("     • 超时次数\n");

  console.log("  🔍 质量指标");
  console.log("     • 输出长度分布");
  console.log("     • 用户满意度（如有反馈）");
  console.log("     • 缓存命中率\n");

  console.log("🛠️  监控工具推荐：");
  console.log("  • 结构化日志: Pino / Winston → ELK / Loki");
  console.log("  • 指标收集: Prometheus + Grafana");
  console.log("  • APM: Datadog / New Relic / Sentry");
  console.log("  • 自建: 结构化 JSON 日志 + 定期聚合报表");
  console.log("");
}

/** Demo 2: 结构化日志 */
function demo2_structuredLogging(): void {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 2: 结构化日志                              ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const logger = new StructuredLogger();

  console.log("📋 模拟 LLM API 调用的结构化日志：\n");

  // 模拟请求
  const requestId = "req_" + Math.random().toString(36).slice(2, 10);

  logger.info("llm.request.start", {
    model: "gpt-4o-mini",
    prompt_length: 150,
    max_tokens: 500,
  }, { request_id: requestId });

  logger.info("llm.request.complete", {
    model: "gpt-4o-mini",
    prompt_tokens: 42,
    completion_tokens: 128,
    total_tokens: 170,
    cost_usd: 0.000083,
  }, { request_id: requestId, duration_ms: 1230 });

  logger.warn("llm.rate_limit.approaching", {
    model: "gpt-4o-mini",
    current_rpm: 450,
    limit_rpm: 500,
    utilization: "90%",
  });

  logger.error("llm.request.failed", {
    model: "gpt-4o",
    error_code: 429,
    error_message: "Rate limit exceeded",
    retry_after: 2,
  }, { request_id: "req_abc123" });

  console.log("\n💡 结构化日志优势：");
  console.log("  • JSON 格式易于机器解析和搜索");
  console.log("  • request_id 串联完整请求链路");
  console.log("  • duration_ms 追踪性能");
  console.log("  • 结合 ELK 等工具实现可视化查询");
  console.log("");
}

/** Demo 3: 性能指标收集 */
function demo3_metricsCollection(): void {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 3: 性能指标收集与统计                      ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const metrics = new MetricsCollector();

  // 模拟 50 次请求的延迟数据
  console.log("📊 模拟 50 次 API 请求的性能数据...\n");

  for (let i = 0; i < 50; i++) {
    // 正常延迟 200-800ms，偶尔慢请求 1000-3000ms
    const isSlow = Math.random() < 0.1;
    const latency = isSlow
      ? 1000 + Math.random() * 2000
      : 200 + Math.random() * 600;

    metrics.record("latency_ms", Math.round(latency));
    metrics.record("tokens_used", Math.round(50 + Math.random() * 450));
  }

  // 打印统计
  const latencyStats = metrics.getStats("latency_ms");
  const tokenStats = metrics.getStats("tokens_used");

  if (latencyStats) {
    console.log("⏱️  延迟统计 (ms)：");
    console.log("  ┌──────────┬──────────┐");
    console.log(`  │ 指标      │ 值        │`);
    console.log("  ├──────────┼──────────┤");
    console.log(`  │ 请求数    │ ${String(latencyStats.count).padStart(8)} │`);
    console.log(`  │ 最小值    │ ${String(latencyStats.min).padStart(8)} │`);
    console.log(`  │ 最大值    │ ${String(latencyStats.max).padStart(8)} │`);
    console.log(`  │ 平均值    │ ${latencyStats.avg.toFixed(0).padStart(8)} │`);
    console.log(`  │ P50      │ ${String(latencyStats.p50).padStart(8)} │`);
    console.log(`  │ P95      │ ${String(latencyStats.p95).padStart(8)} │`);
    console.log(`  │ P99      │ ${String(latencyStats.p99).padStart(8)} │`);
    console.log("  └──────────┴──────────┘\n");
  }

  if (tokenStats) {
    console.log("🎫 Token 使用统计：");
    console.log(`  平均: ${tokenStats.avg.toFixed(0)} tokens/请求`);
    console.log(`  P95: ${tokenStats.p95} tokens/请求`);
    console.log(`  总计: ${tokenStats.count * tokenStats.avg | 0} tokens\n`);
  }
}

/** Demo 4: Dashboard 汇总 */
function demo4_dashboard(): void {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 4: Dashboard 监控报表                      ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const dashboard = new Dashboard();

  // 模拟 100 次请求
  console.log("📊 模拟 100 次 API 请求...\n");

  for (let i = 0; i < 100; i++) {
    const rand = Math.random();
    const latency = 200 + Math.random() * 800;
    const tokens = 50 + Math.floor(Math.random() * 400);
    const cost = tokens * 0.000001; // 简化计算

    if (rand < 0.85) {
      // 85% 成功
      dashboard.recordRequest(true, latency, tokens, cost);
    } else if (rand < 0.93) {
      // 8% 限流
      dashboard.recordRequest(false, latency, 0, 0, "429_rate_limit");
    } else if (rand < 0.97) {
      // 4% 超时
      dashboard.recordRequest(false, 30000, 0, 0, "timeout");
    } else {
      // 3% 其他错误
      dashboard.recordRequest(false, latency, 0, 0, "500_server_error");
    }
  }

  const report = dashboard.getReport();

  console.log("═══════════════════════════════════════════");
  console.log("          📊 LLM 服务监控 Dashboard         ");
  console.log("═══════════════════════════════════════════\n");

  console.log(`  📅 日期: ${report.period}`);
  console.log(`  📨 总请求数: ${report.totalRequests}`);
  console.log(`  ✅ 成功率: ${report.successRate}`);
  console.log(`  ⏱️  平均延迟: ${report.avgLatency}`);
  console.log(`  🎫 总 Token: ${report.totalTokens}`);
  console.log(`  💰 总成本: ${report.totalCost}\n`);

  if (Object.keys(report.errorBreakdown).length > 0) {
    console.log("  ❌ 错误分布：");
    for (const [type, count] of Object.entries(report.errorBreakdown)) {
      const bar = "█".repeat(Math.min(count, 20));
      console.log(`     ${type.padEnd(20)} ${bar} ${count}`);
    }
  }

  console.log("\n═══════════════════════════════════════════\n");

  console.log("💡 Dashboard 实践建议：");
  console.log("  • 定时（每分钟/每小时）生成报表");
  console.log("  • 设置告警阈值（成功率 < 95%、P95 > 5s）");
  console.log("  • 按模型/业务线分维度统计");
  console.log("  • 接入 Grafana 等可视化工具");
  console.log("");
}

// ============================================================
// 主入口
// ============================================================

async function main(): Promise<void> {
  console.log("\n📊 ===== 10-deployment: 监控与日志 =====\n");

  demo1_concepts();
  demo2_structuredLogging();
  demo3_metricsCollection();
  demo4_dashboard();

  console.log("🎉 监控与日志演示完成！\n");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("monitoring.ts");
if (isMainModule) {
  main().catch(console.error);
}

export { StructuredLogger, MetricsCollector, Dashboard };
