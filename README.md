# 🚀 AigileXperience

> AI-powered Venture Capital Pitch Deck Generator with LLM Pipeline & Production Automation

**Transform elevator pitches into professional, investor-ready pitch decks using advanced AI models and intelligent assumptions.**

## ✨ Features

- 🤖 **Dual-LLM Pipeline**: Claude Sonnet for analysis + GPT-4o for refinement
- 📊 **Interactive Charts**: Real-time TAM/SAM/SOM, Use-of-Funds, KPI visualization
- 🎯 **Smart Assumptions**: Auto-fill missing data with industry-standard benchmarks
- 📨 **Progressive UI**: Workspace-based IA with stage timeline visualization
- 🏗️ **Modular Architecture**: AppShell with sidebar navigation and section-based dossiers
- 🧪 **E2E Testing**: Playwright-powered production testing
- 🚀 **Full CI/CD**: Automated deployment with AI code reviews

## 🏢 Architecture

```
┌─────────────────────┐
│     Frontend (Next.js)    │
│   Vercel + Tailwind CSS  │
├──────────┬──────────┤
│  Backend  │  Common   │
│ (Fastify) │ (Zod)     │
│  Render   │ Schemas   │
└──────────┴──────────┘

┌────────────────────────┐
│    LLM Pipeline         │
├────────────┤────────────┤
│ 1. Analyze  │ 2. Refine  │
│ Claude 3.5  │ GPT-4o     │
└────────────┴────────────┘
```

## 🎨 UI Modes

1. **Live (LLM only)**: Basic AI analysis
2. **Live + Assumptions**: AI + smart defaults
3. **Live + Assumptions + LLM-Refinement**: Full pipeline with dual-model processing

## 🏗️ Workspace IA

### New Progressive Dossier Interface

- **URL**: `/workspaces/[wsId]/dossier/[section]`
- **Demo**: https://aigilexperience.vercel.app/workspaces/demo/dossier/elevator

**Features:**

- 🎯 **Stage Timeline**: Visual pipeline progress (S1→S2→S3→S4)
- 📊 **Section Navigation**: Pill-based subnav between dossier sections
- 💾 **Auto-Persistence**: LocalStorage sync across all sections
- ⚡ **Progressive Loading**: Sections appear sequentially with animated status

**Available Sections:**

- `elevator` - Pipeline starter with input form
- `executive` - Executive summary view
- `problem` - Problem statement analysis
- `solution` - Solution overview
- `market` - Market analysis & TAM/SAM/SOM
- `gtm` - Go-to-market strategy
- `business` - Business model details
- `financials` - Financial projections
- `competition` - Competitive analysis
- `roadmap` - Product roadmap
- `team` - Team composition
- `ask` - Funding requirements

## 🚀 Quick Start

### Prerequisites

```bash
# Install dependencies
npm install

# Required CLI tools
npm i -g vercel@latest
brew install gh jq  # or apt-get install gh jq
```

### 1. Backend Setup (Render)

```bash
export RENDER_API_KEY="your_render_key"
export OPENAI_API_KEY="your_openai_key"     # or
export ANTHROPIC_API_KEY="your_anthropic_key"

warp run "AigileXperience Render" "1) Backend auf Render provisionieren/aktualisieren"
```

### 2. Get Backend URL

```bash
warp run "AigileXperience Render" "3) Backend URL anzeigen"
# Copy the URL for next step
```

### 3. Frontend Deployment

```bash
export BACKEND_URL="https://your-backend.onrender.com"
warp run "AigileXperience Deploy" "2) Frontend Vercel – Direct Deploy"
```

## 🎯 Production Pipeline

### Full Orchestrated Deployment

For production-ready deployments with AI code review:

```bash
# Set environment variables
export BACKEND_URL="https://your-backend.onrender.com"
export CODERABBIT_PLAN="true"  # optional: for advanced CodeRabbit features

# Run full orchestration
warp run "AigileXperience Orchestrator" "1) Full Orchestration (PR → CodeRabbit → Auto-Merge → Deploy)"
```

**What it does:**

- ✅ Creates automated PR with your changes
- 🤖 Triggers CodeRabbit AI review
- 🔄 Auto-merges when checks pass
- 🚀 Deploys to Vercel production
- 🧪 Runs E2E smoke tests

### Quick Deploy (Skip PR workflow)

```bash
warp run "AigileXperience Orchestrator" "2) Quick Deploy"
```

## 🧪 Testing

### E2E Production Testing

```bash
export PRODUCTION_URL="https://your-app.vercel.app"
warp run "AigileXperience Orchestrator" "3) E2E Production Test"
```

### Local Development

```bash
npm run dev  # Starts frontend:3000 + backend:3001
```

## 🛠️ Configuration

### Backend Environment (apps/backend/.env)

```env
# LLM Provider (choose one or both)
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...

# Best Pipeline Models
MODEL_ANALYZE=claude-3-5-sonnet-20240620
MODEL_REFINE=gpt-4o
USE_ASSUMPTIONS_LLM=true
```

### Warp Workflows Available

- **AigileXperience Ops**: Dev setup, building, testing
- **AigileXperience Render**: Backend deployment
- **AigileXperience Deploy**: Frontend deployment
- **AigileXperience Best-Pipeline**: Model configuration
- **AigileXperience Orchestrator**: Full CI/CD pipeline

## 🚀 Advanced Features

### CodeRabbit Integration

```bash
# Setup CodeRabbit AI reviews
warp run "AigileXperience Orchestrator" "4) Setup CodeRabbit + Branch Protection"
```

### Best Pipeline Configuration

```bash
warp run "AigileXperience Best-Pipeline" "Set Backend ENV (best models)"
warp run "AigileXperience Best-Pipeline" "Test assume_llm"
```

## 📊 Development

```bash
# Development mode
npm run dev

# Build all packages
npm run build

# Run tests
npm test
```

## 📋 API Endpoints

- `POST /api/venture/generate` - Generate pitch deck
- `POST /api/venture/recalc` - Recalculate with overrides

**Modes**: `live`, `dry`, `assume`, `assume_llm`

## 📦 Deployment Architecture

```
Developer
    ↓
┌──────────┐
│   GitHub   │ ←─ Push
└───┬───────┘
     │
     ↓ Auto-Deploy
┌────┴────┐    ┌──────────┐
│  Vercel   │    │  Render   │
│(Frontend)│────│(Backend) │
└──────────┘    └──────────┘
     │               │
     ↓               ↓
┌──────────┐    ┌──────────┐
│   Users   │    │ LLM APIs │
└──────────┘    └──────────┘
```
