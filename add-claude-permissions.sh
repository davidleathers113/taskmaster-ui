#!/bin/bash

# Add Claude Code Permissions Script
# Adds common development commands to Claude's allowed tools list

echo "🔧 Adding common development commands to Claude Code permissions..."

# Common development commands to allow
COMMANDS=(
    "Bash(npm run lint:*)"
    "Bash(npm run typecheck:*)"
    "Bash(npm run build:*)"
    "Bash(npm run test:*)"
    "Bash(npm test:*)"
    "Bash(git status:*)"
    "Bash(git diff:*)"
    "Bash(git log:*)"
    "Bash(tsc --noEmit:*)"
    "Bash(eslint:*)"
    "Bash(prettier:*)"
    "Bash(npm run dev:*)"
    "Bash(npm start:*)"
    "Bash(yarn lint:*)"
    "Bash(yarn typecheck:*)"
    "Bash(yarn build:*)"
    "Bash(yarn test:*)"
)

echo "📋 Will add the following commands:"
for cmd in "${COMMANDS[@]}"; do
    echo "  ✓ $cmd"
done

echo ""
read -p "Continue? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Adding permissions..."
    
    for cmd in "${COMMANDS[@]}"; do
        echo "Adding: $cmd"
        claude config add allowedTools "$cmd"
    done
    
    echo ""
    echo "✅ Permissions added successfully!"
    echo ""
    echo "📋 Current allowed tools:"
    claude config get allowedTools
    
else
    echo "❌ Cancelled."
    exit 1
fi

echo ""
echo "🎉 Done! Claude Code will now run these commands without asking for permission."