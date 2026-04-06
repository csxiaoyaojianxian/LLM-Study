#!/bin/bash
# post-commit-notify.sh — 提交后通知
#
# Hook 类型: PostToolUse (Bash)
# 用途: 检测 git commit 操作，提交成功后发送通知
#
# 安装方式: 复制到 .claude/hooks/ 目录

# 从 stdin 读取 JSON 输入
INPUT=$(cat)

# 检查是否是 git commit 命令
COMMAND=$(echo "$INPUT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
params = data.get('tool_input', {})
print(params.get('command', ''))
" 2>/dev/null)

# 只处理 git commit 命令
case "$COMMAND" in
  *"git commit"*)
    # 获取最新提交信息
    COMMIT_MSG=$(git log -1 --pretty=format:"%s" 2>/dev/null)
    COMMIT_HASH=$(git log -1 --pretty=format:"%h" 2>/dev/null)
    BRANCH=$(git branch --show-current 2>/dev/null)

    if [ -n "$COMMIT_HASH" ]; then
      echo "📦 提交成功！"
      echo "   分支: $BRANCH"
      echo "   Hash: $COMMIT_HASH"
      echo "   消息: $COMMIT_MSG"

      # 可选: 发送桌面通知（macOS）
      # osascript -e "display notification \"$COMMIT_MSG\" with title \"Git Commit\" subtitle \"$BRANCH ($COMMIT_HASH)\""

      # 可选: 发送到 Webhook
      # curl -s -X POST "https://hooks.example.com/notify" \
      #   -H "Content-Type: application/json" \
      #   -d "{\"text\": \"[${BRANCH}] ${COMMIT_HASH}: ${COMMIT_MSG}\"}"
    fi
    ;;
esac

exit 0
