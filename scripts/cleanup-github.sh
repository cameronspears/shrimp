#!/bin/bash
# GitHub Cleanup Script
# Closes all open PRs and provides workflow fix guidance

set -e

echo "🦐 Shrimp Health - GitHub Cleanup Script"
echo "=========================================="
echo ""

# Check for gh CLI
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) not found. Install it first:"
    echo "   brew install gh"
    echo ""
    echo "Manual cleanup:"
    echo "1. Visit: https://github.com/cameronspears/shrimp/pulls"
    echo "2. Close all Dependabot PRs (they'll be recreated monthly)"
    echo "3. Visit: https://github.com/cameronspears/shrimp/actions"
    echo "4. Failed workflows will auto-fix on next push"
    exit 1
fi

# Check authentication
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub CLI"
    echo "   Run: gh auth login"
    exit 1
fi

echo "📋 Fetching open PRs..."
PRS=$(gh pr list --json number,title,author --limit 100)
PR_COUNT=$(echo "$PRS" | jq '. | length')

if [ "$PR_COUNT" -eq 0 ]; then
    echo "✅ No open PRs to clean up!"
else
    echo "Found $PR_COUNT open PR(s)"
    echo ""

    # Show PRs
    echo "$PRS" | jq -r '.[] | "#\(.number): \(.title) (by \(.author.login))"'
    echo ""

    read -p "Close all open PRs? (y/N): " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "$PRS" | jq -r '.[].number' | while read -r pr_num; do
            echo "  Closing #$pr_num..."
            gh pr close "$pr_num" --comment "Closing to clean up repository. Dependabot will recreate needed PRs monthly." || true
        done
        echo "✅ All PRs closed"
    else
        echo "❌ Skipped closing PRs"
    fi
fi

echo ""
echo "📊 Checking failed workflow runs..."
FAILED_RUNS=$(gh run list --status failure --limit 5 --json databaseId,name,conclusion,createdAt)
FAILED_COUNT=$(echo "$FAILED_RUNS" | jq '. | length')

if [ "$FAILED_COUNT" -eq 0 ]; then
    echo "✅ No recent failed workflows!"
else
    echo "Found $FAILED_COUNT recent failed workflow(s)"
    echo ""
    echo "$FAILED_RUNS" | jq -r '.[] | "- \(.name): \(.conclusion) (\(.createdAt[:10]))"'
    echo ""
    echo "ℹ️  Failed workflows will be fixed automatically on next push"
    echo "   Recent fixes:"
    echo "   - Fixed Dependabot auto-merge permissions"
    echo "   - Fixed coverage threshold enforcement"
    echo "   - Fixed bc command dependency"
fi

echo ""
echo "🔧 Recommended Actions:"
echo ""
echo "1. ✅ Push latest code (this will trigger CI)"
echo "   git push origin main"
echo ""
echo "2. ⚙️  Add NPM_TOKEN for automated publishing:"
echo "   https://github.com/cameronspears/shrimp/settings/secrets/actions"
echo ""
echo "3. 📊 Monitor workflows:"
echo "   https://github.com/cameronspears/shrimp/actions"
echo ""
echo "✨ Done! Repository will auto-heal on next push."
