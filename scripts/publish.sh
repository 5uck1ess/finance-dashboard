#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# Sync financeDashboard (private) → finance-dashboard (public)
#
# Usage:
#   ./scripts/publish.sh "commit message"
#   ./scripts/publish.sh                   # auto-generates message
# ─────────────────────────────────────────────────────────────

DEV_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PUBLIC_DIR="$(dirname "$DEV_DIR")/finance-dashboard"

if [[ ! -d "$PUBLIC_DIR/.git" ]]; then
    echo "Error: Public repo not found at $PUBLIC_DIR"
    echo "Expected: $PUBLIC_DIR with a .git directory"
    exit 1
fi

VERSION="$(node -p "require('$DEV_DIR/package.json').version")"
MESSAGE="${1:-"sync from dev — v${VERSION}"}"

echo ""
echo "  Syncing:"
echo "    From: $DEV_DIR"
echo "    To:   $PUBLIC_DIR"
echo ""

rsync -a --delete \
    --exclude='.git' \
    --exclude='.env' \
    --exclude='.env.local' \
    --exclude='.env.*.local' \
    --exclude='node_modules' \
    --exclude='archive/' \
    --exclude='config/stocks.json' \
    --exclude='config/dashboard-snapshot.json' \
    --exclude='.DS_Store' \
    --exclude='*.tar' \
    --exclude='package-lock.json' \
    "$DEV_DIR/" "$PUBLIC_DIR/"

cd "$PUBLIC_DIR"

if git diff --quiet && git diff --cached --quiet && [[ -z "$(git ls-files --others --exclude-standard)" ]]; then
    echo "  No changes to publish."
    echo ""
    exit 0
fi

git add -A
git commit -m "$MESSAGE"

echo ""
echo "  Committed to public repo: $MESSAGE"
echo ""
echo "  To push: cd $PUBLIC_DIR && git push"
echo ""
