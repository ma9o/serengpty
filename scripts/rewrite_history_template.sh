#!/bin/bash
# =============================================================================
# Git Commit History Rewrite Template
# =============================================================================
# 
# This template helps rewrite git commit history to improve commit messages
# according to conventional commit standards.
#
# WARNING: This script rewrites git history. It should only be used on branches
# that haven't been pushed to shared repositories, or when all team members
# are aware that a force push will occur.
#
# Usage:
#   1. Copy this template and modify for your specific commits
#   2. Replace the COMMIT_SHA placeholders with actual commit SHAs
#   3. Replace the commit messages with your improved messages
#   4. Adjust the number in HEAD~N to match how many commits you want to rewrite
#   5. Run the script after making it executable with chmod +x
#
# =============================================================================

# Save the current branch
current_branch=$(git rev-parse --abbrev-ref HEAD)
echo "Current branch: $current_branch"

# Create a temporary branch for the rewrite
git checkout -b temp_rewrite_branch

# Reset to a point before the commits you want to rewrite
# Adjust the number to match how many commits you want to rewrite
git reset --hard HEAD~N  # Replace N with the number of commits to rewrite

# First commit
git cherry-pick COMMIT_SHA_1  # Replace with actual commit SHA
git commit --amend -m "feat(scope): descriptive title for first commit
- Bullet point describing a key change
- Another bullet point with more details
- Additional context or information
- Summary of impact or importance"

# Second commit
git cherry-pick COMMIT_SHA_2  # Replace with actual commit SHA
git commit --amend -m "feat(scope): descriptive title for second commit
- Bullet point describing a key change
- Another bullet point with more details
- Additional context or information
- Summary of impact or importance"

# Third commit
git cherry-pick COMMIT_SHA_3  # Replace with actual commit SHA
git commit --amend -m "feat(scope): descriptive title for third commit
- Bullet point describing a key change
- Another bullet point with more details
- Additional context or information
- Summary of impact or importance"

# Add more commits as needed following the same pattern...

# Force update the original branch with our rewritten history
git checkout $current_branch
git reset --hard temp_rewrite_branch

# Clean up the temporary branch
git branch -D temp_rewrite_branch

echo "Commit history has been rewritten successfully."
echo "To update the remote repository, use: git push --force origin $current_branch"