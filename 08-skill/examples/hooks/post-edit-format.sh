#!/bin/bash
# post-edit-format.sh — 编辑后自动格式化
#
# Hook 类型: PostToolUse (Write/Edit)
# 用途: 在 Claude 编辑文件后自动运行格式化工具
#
# 安装方式: 复制到 .claude/hooks/ 目录

# 从 stdin 读取 JSON 输入
INPUT=$(cat)

# 提取文件路径
FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
params = data.get('tool_input', {})
print(params.get('file_path', params.get('path', '')))
" 2>/dev/null)

# 如果没有文件路径，跳过
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# 根据文件扩展名选择格式化工具
case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.css|*.md)
    # 使用 Prettier 格式化（如果存在）
    if command -v npx &> /dev/null; then
      npx prettier --write "$FILE_PATH" 2>/dev/null
      if [ $? -eq 0 ]; then
        echo "✅ 已自动格式化: $FILE_PATH"
      fi
    fi
    ;;
  *.py)
    # 使用 Black 格式化 Python 文件（如果存在）
    if command -v black &> /dev/null; then
      black "$FILE_PATH" 2>/dev/null
      echo "✅ 已自动格式化: $FILE_PATH"
    fi
    ;;
esac

exit 0
