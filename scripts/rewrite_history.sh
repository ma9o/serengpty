#!/bin/bash
# =============================================================================
# Git Commit History Rewrite Script
# =============================================================================
# 
# This script rewrites git commit history to improve commit messages and make
# them more descriptive according to conventional commit standards.
#
# WARNING: This script rewrites git history. It should only be used on branches
# that haven't been pushed to shared repositories, or when all team members
# are aware that a force push will occur.
#
# Usage:
#   1. Modify the commit SHA hashes and messages to match your project
#   2. Ensure you have a backup or the changes are committed to a remote
#   3. Run the script: ./scripts/rewrite_history.sh
#
# How it works:
#   - Creates a temporary branch
#   - Cherry-picks each commit and amends with a better message
#   - Applies the changes back to the original branch
#   - Force-updates the remote (requires manual push --force)
#
# =============================================================================

# Save the current branch
current_branch=$(git rev-parse --abbrev-ref HEAD)
echo "Current branch: $current_branch"

# Create a temporary branch for the rewrite
git checkout -b temp_rewrite_branch

# Reset to a point before the commits we want to rewrite
# Adjust the number to match how many commits you want to rewrite
git reset --hard HEAD~5

# First commit - OnboardingForm
git cherry-pick 25031d4
git commit --amend -m "feat(web): create OnboardingForm component with secure password generation
- Implement client-side zip file processing
- Add drag-and-drop interface with visual feedback
- Create landing page components for improved user flow
- Reorganize landing page components in dedicated directory"

# Second commit - arrows
git cherry-pick 566d126
git commit --amend -m "feat(web): add directional arrows for onboarding guidance
- Add SVG assets for start and end arrows
- Update onboarding form with visual flow indicators
- Enhance zip-dropzone component with guidance elements
- Improve user experience with visual cues"

# Third commit - causality
git cherry-pick b6e5e6e
git commit --amend -m "feat(data): implement causality detection architecture
- Create long_range_causality and short_range_causality modules
- Restructure AI conversations assets for better maintainability
- Add conversation skeleton extraction framework
- Clean up deprecated human conversation assets"

# Fourth commit - short range causality filter
git cherry-pick 92cfafe
git commit --amend -m "feat(data): add short-range causality filter with time-based constraints
- Implement 7-day filtering window for related conversations
- Add embedding similarity calculations using FAISS
- Create LLM prompts for identifying cause-effect relationships
- Update notebook explorations with new filtering capabilities"

# Fifth commit - finishing causality implementation
git cherry-pick c9641ef
git commit --amend -m "feat(data): integrate embedding-based conversation filtering
- Add similarity threshold filtering for conversation relationships
- Implement batch processing for analyzing conversation causality
- Remove deprecated WhatsApp parsing utilities
- Update embedding client for improved vector operations"

# Latest commit - keep as is
git cherry-pick 80f821a

# Force update the original branch with our rewritten history
git checkout $current_branch
git reset --hard temp_rewrite_branch

# Clean up the temporary branch
git branch -D temp_rewrite_branch

echo "Commit history has been rewritten successfully."
echo "To update the remote repository, use: git push --force origin $current_branch"
