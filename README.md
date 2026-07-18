# GhostAudit

> AI Fraud Pattern & Compliance Risk Triage Copilot — Bengaluru AI Sprint 2026

**Stack:** React + Vite · Node.js/Express · SQLite · Python/FastAPI · Google Gemma AI

---

## Quick Start

Double-click `start-all.bat` to launch all 3 services, or run each manually:

```bash
# Terminal 1 — Backend
cd backend && node src/index.js

# Terminal 2 — AI Service  
cd ai-service && uvicorn main:app --reload --port 8000

# Terminal 3 — Frontend
cd frontend && npm run dev
```

**Open:** http://localhost:5173  
**Login:** `admin@ghostaudit.ai` / `ghostaudit123`

---

## API Key Setup

Edit `ai-service/.env` and set your Gemini API key:
```
GEMINI_API_KEY=your_key_here
GEMMA_MODEL=gemma-3-27b-it
```

Get your key: https://aistudio.google.com/app/apikey

---

## Project Structure

```
├── frontend/       React + Vite app (port 5173)
├── backend/        Node.js/Express API (port 3001)
├── ai-service/     Python FastAPI + Gemma (port 8000)
├── database/       SQLite schema + mock seed data
├── docs/           API contracts
└── start-all.bat   Launch all services
```

## Tier 1 Features Built

- ✅ Split Invoice / Round-Tripping Detection Engine
- ✅ Ghost Vendor Verification (GSTIN, address, bank pattern scoring)
- ✅ AI Risk Replay (step-by-step Gemma reasoning trail)
- ✅ AI Prosecutor (Evidence → Defense → Verdict via Gemma)
- ✅ Reviewer Compliance Copilot / Triage Queue
- ✅ Explain Like I'm Not an Auditor (plain-language Gemma explanation)
- ✅ Audit-Ready Report Generator (Gemma + PDF export)
