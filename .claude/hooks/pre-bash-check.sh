#!/bin/bash
# pre-bash-check.sh
# Claude Code PreToolUse 훅 — 위험한 bash 명령 차단
# stdin으로 JSON {"tool_input": {"command": "..."}} 수신

INPUT=$(cat)
CMD=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null)

if [ -z "$CMD" ]; then
  exit 0
fi

# ─── 1. 파괴적 rm 명령 차단 ──────────────────────────────
if echo "$CMD" | grep -qE 'rm\s+-rf\s+(/|~/|~\b)'; then
  echo "❌ BLOCKED: rm -rf / or rm -rf ~/ is forbidden." >&2
  exit 1
fi

# ─── 2. force push to main/master 차단 ──────────────────
if echo "$CMD" | grep -qE 'git\s+push.*(--force|-f)'; then
  if echo "$CMD" | grep -qE '(main|master)'; then
    echo "❌ BLOCKED: git push --force to main/master is forbidden." >&2
    exit 1
  fi
fi

# ─── 3. .env.local 직접 쓰기 차단 ───────────────────────
if echo "$CMD" | grep -qE '>\s*\.env\.local|tee\s+\.env\.local'; then
  echo "❌ BLOCKED: Direct write to .env.local via shell redirect is forbidden." >&2
  echo "   Use: cp .env.example .env.local  and edit manually." >&2
  exit 1
fi

# ─── 4. npm publish 차단 ────────────────────────────────
if echo "$CMD" | grep -qE 'npm\s+publish'; then
  echo "❌ BLOCKED: npm publish requires explicit user confirmation." >&2
  exit 1
fi

# ─── 5. git reset --hard 경고 (차단은 아님) ─────────────
if echo "$CMD" | grep -qE 'git\s+reset\s+--hard'; then
  echo "⚠️  WARNING: git reset --hard will discard all uncommitted changes." >&2
  echo "   Proceeding — ensure this is intentional." >&2
fi

exit 0
