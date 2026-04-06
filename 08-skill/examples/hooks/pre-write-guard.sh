#!/bin/bash
# pre-write-guard.sh — 禁止写入敏感文件
#
# Hook 类型: PreToolUse (Write/Edit)
# 用途: 在 Claude 写入文件前检查路径，阻止修改敏感文件
#
# 安装方式: 复制到 .claude/hooks/ 目录
# 配置方式: 在 settings.json 中添加 hooks.PreToolUse 配置

# 从 stdin 读取 JSON 输入
INPUT=$(cat)

# 提取文件路径（兼容 Write 和 Edit 工具）
FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
params = data.get('tool_input', {})
print(params.get('file_path', params.get('path', '')))
" 2>/dev/null)

# 定义受保护的文件/目录模式
PROTECTED_PATTERNS=(
  ".env"
  ".env.local"
  ".env.production"
  "credentials"
  "secrets"
  "private_key"
  "id_rsa"
  "*.pem"
  "*.key"
)

# 检查是否匹配受保护模式
for pattern in "${PROTECTED_PATTERNS[@]}"; do
  case "$FILE_PATH" in
    *"$pattern"*)
      # 输出 JSON 阻止操作
      echo '{"decision": "block", "reason": "🔒 安全防护: 禁止修改敏感文件 '"$FILE_PATH"'"}'
      exit 0
      ;;
  esac
done

# 允许操作（空输出或无 decision 字段）
exit 0
