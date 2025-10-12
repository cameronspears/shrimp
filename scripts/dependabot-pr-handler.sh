#!/bin/bash
# Dependabot PR Handler Script
# Run this to bulk-handle Dependabot PRs

echo "🦐 Shrimp Health - Dependabot PR Handler"
echo "========================================="
echo ""

# Check if gh CLI is available
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) not found. Install it first:"
    echo "   brew install gh"
    echo "   # or visit: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub CLI."
    echo "   Run: gh auth login"
    exit 1
fi

echo "📋 Fetching Dependabot PRs..."
echo ""

# Get all open Dependabot PRs
PRS=$(gh pr list --label "dependencies" --json number,title,labels,headRefName --jq '.[] | select(.labels[].name == "dependencies") | "\(.number)|\(.title)|\(.headRefName)"')

if [ -z "$PRS" ]; then
    echo "✅ No Dependabot PRs found!"
    exit 0
fi

# Count PRs
PR_COUNT=$(echo "$PRS" | wc -l | tr -d ' ')
echo "Found $PR_COUNT Dependabot PR(s)"
echo ""

# Categorize PRs
SECURITY_PRS=()
DEV_PRS=()
MAJOR_PRS=()
MINOR_PRS=()

while IFS='|' read -r num title branch; do
    # Check if security update
    if echo "$title" | grep -qi "security"; then
        SECURITY_PRS+=("$num|$title")
    # Check if dev dependency
    elif echo "$title" | grep -qE "@types/|eslint|prettier|husky|@typescript-eslint"; then
        DEV_PRS+=("$num|$title")
    # Check if major version bump
    elif echo "$branch" | grep -qE "dependabot/npm_and_yarn/.*-[0-9]+\.0\.0"; then
        MAJOR_PRS+=("$num|$title")
    else
        MINOR_PRS+=("$num|$title")
    fi
done <<< "$PRS"

echo "📊 Categorization:"
echo "   🔒 Security updates: ${#SECURITY_PRS[@]}"
echo "   🛠️  Dev dependencies: ${#DEV_PRS[@]}"
echo "   ⬆️  Major updates: ${#MAJOR_PRS[@]}"
echo "   📦 Minor/patch updates: ${#MINOR_PRS[@]}"
echo ""

# Function to merge PR
merge_pr() {
    local pr_num=$1
    local pr_title=$2
    echo "   Merging #$pr_num: ${pr_title:0:60}..."
    if gh pr merge "$pr_num" --auto --squash --delete-branch 2>/dev/null; then
        echo "   ✅ Merged #$pr_num"
    else
        echo "   ⚠️  Could not auto-merge #$pr_num (may need manual review)"
    fi
}

# Merge security PRs automatically
if [ ${#SECURITY_PRS[@]} -gt 0 ]; then
    echo "🔒 Merging SECURITY updates..."
    for pr in "${SECURITY_PRS[@]}"; do
        IFS='|' read -r num title <<< "$pr"
        merge_pr "$num" "$title"
    done
    echo ""
fi

# Merge dev dependency PRs
if [ ${#DEV_PRS[@]} -gt 0 ]; then
    echo "🛠️  Merging DEV DEPENDENCY updates..."
    for pr in "${DEV_PRS[@]}"; do
        IFS='|' read -r num title <<< "$pr"
        merge_pr "$num" "$title"
    done
    echo ""
fi

# Handle minor/patch updates
if [ ${#MINOR_PRS[@]} -gt 0 ]; then
    echo "📦 Minor/patch updates found:"
    for pr in "${MINOR_PRS[@]}"; do
        IFS='|' read -r num title <<< "$pr"
        echo "   #$num: ${title:0:70}..."
    done
    echo ""
    read -p "Merge all minor/patch updates? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        for pr in "${MINOR_PRS[@]}"; do
            IFS='|' read -r num title <<< "$pr"
            merge_pr "$num" "$title"
        done
    else
        echo "   Skipped minor/patch updates"
    fi
    echo ""
fi

# Handle major updates (manual review recommended)
if [ ${#MAJOR_PRS[@]} -gt 0 ]; then
    echo "⬆️  MAJOR version updates (review recommended):"
    for pr in "${MAJOR_PRS[@]}"; do
        IFS='|' read -r num title <<< "$pr"
        echo "   #$num: ${title:0:70}..."
        echo "   View: https://github.com/cameronspears/shrimp/pull/$num"
    done
    echo ""
    echo "   ⚠️  Review these manually before merging"
fi

echo "✨ Done!"
