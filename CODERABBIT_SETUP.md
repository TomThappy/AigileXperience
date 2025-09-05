# CodeRabbit Setup & CI/CD Pipeline

## 1. CodeRabbit GitHub App Installation

### In GitHub Repository:
1. Go to [CodeRabbit GitHub App](https://github.com/apps/coderabbitai)
2. Click "Install" and authorize for your `AigileXperience` repository
3. Grant necessary permissions (read repository, write PR comments)

### Branch Protection Setup:
1. Go to **Settings** → **Branches** in your GitHub repo
2. Add rule for `main` branch:
   - ✅ **Require pull request reviews before merging**
   - ✅ **Require status checks to pass before merging**
   - Add required status checks:
     - `CodeRabbit AI Review`
     - `build-test` (from CI workflow)
   - ✅ **Require branches to be up to date before merging**
   - ✅ **Include administrators**

### Optional: Environment Protection
In **Settings** → **Environments** → **production**:
- Add required reviewers for production deployments
- This gates deployments until human approval

## 2. Required GitHub Secrets

### Navigate to Settings → Secrets and variables → Actions

Add these secrets for the deploy workflow:

#### Render Secrets:
```
RENDER_API_KEY          # Your Render API key
RENDER_BACKEND_ID       # srv-d2qovbl6ubrc73dnh89g  
RENDER_WORKER_ID        # srv-d2t8v3er433s73d628j0
```

#### Vercel Secrets:
```
VERCEL_TOKEN           # Vercel deployment token
VERCEL_ORG_ID         # Your Vercel organization ID  
VERCEL_PROJECT_ID     # Your Vercel project ID
```

## 3. How to Get Secret Values

### Render API Key:
```bash
# Login to Render CLI first
render auth login

# Your API key is in the Render dashboard:
# Account Settings → API Keys → Create new key
```

### Vercel Tokens:
```bash
# Install Vercel CLI and login
npm i -g vercel
vercel login

# Get project info:
vercel project list
vercel env ls  # shows project ID in output
```

## 4. Workflow Usage

### Development Flow:
```bash
# 1. Create feature branch
git checkout -b feat/my-feature
git commit -am "feat: add new feature"
git push -u origin feat/my-feature

# 2. Open PR (uses template automatically)
gh pr create --title "Add new feature" --body-file .github/PULL_REQUEST_TEMPLATE.md

# 3. CodeRabbit reviews automatically on PR events
# 4. Address feedback, commit changes
# 5. Merge when CI + CodeRabbit approve

# 6. Auto-deploy triggers on merge to main
```

### Quick Commands (from Warp aliases):
```bash
# Check service status
rls                    # List Render services
api_test              # Test backend health  
worker_test          # Test worker health

# View logs
rlogs                 # Backend logs (tail)
wlogs                 # Worker logs (tail)

# Toggle dry run mode
dry_on                # Enable dry run
dry_off               # Disable dry run

# Manual deployment
rdeploy               # Deploy backend + worker
deploy                # Trigger GitHub Actions deploy
```

## 5. CodeRabbit Configuration

The `.coderabbit.yaml` file configures:
- **Monorepo awareness**: Separate rules for backend/frontend
- **Review priorities**: Security, correctness, performance 
- **TypeScript/NextJS optimizations**
- **Custom checks**: SSE resilience, env var safety
- **Labels**: `deep-review` triggers extended analysis

### PR Labels for Enhanced Reviews:
- Add `deep-review` label for comprehensive analysis
- Add `skip-review` label to bypass CodeRabbit (emergency only)

## 6. Troubleshooting

### CodeRabbit not posting reviews:
1. Check app installation and repository access
2. Verify branch protection requires "CodeRabbit AI Review" status
3. Ensure PR events are triggered (not direct push to main)
4. Check `.coderabbit.yaml` syntax

### Deploy workflow failing:
1. Verify all secrets are set correctly
2. Check service IDs match your Render services
3. Ensure GitHub Actions have necessary permissions
4. Review failed workflow logs in Actions tab

### Service health issues:
```bash
# Check status
rls
rlogs  # or wlogs for detailed logs

# Environment troubleshooting  
render services env list $RENDER_BACKEND_ID
render services env list $RENDER_WORKER_ID
```

## 7. Best Practices

### PR Creation:
- Use descriptive titles and fill out the PR template
- Reference issues with `#issue-number`
- Use conventional commit messages (`feat:`, `fix:`, `docs:`)

### Code Reviews:
- Address all CodeRabbit suggestions or explain why not
- Test changes locally before pushing
- Keep PRs focused and reasonably sized

### Deployment:
- Monitor logs after deployment: `rlogs` / `wlogs`
- Test critical paths: `api_test` / `worker_test`
- Use `dry_on` for testing without real API calls

---

## Quick Reference

**Service IDs:**
- Backend: `srv-d2qovbl6ubrc73dnh89g`
- Worker: `srv-d2t8v3er433s73d628j0`

**Key URLs:**  
- Backend: `https://aigilexperience-backend.onrender.com`
- Frontend: [Vercel URL]

**Status Pages:**
- `/api/health` - Backend health
- `/api/queue/health` - Worker queue health
- `/api/config` - Configuration status
