# RodneysBrain - Famous AI App Builder

## Original Problem Statement
Build RodneysBrain – a self-hosted, open-source, "Famous AI" app-builder that competes with Emergent. Core MVP: Landing → Prompt → Code-Gen → Live Preview.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Monaco Editor + Framer Motion
- **Backend**: FastAPI (Python 3.11) with async MongoDB (motor)
- **Database**: MongoDB for users and projects
- **LLM**: OpenAI GPT-4o via Emergent Universal Key
- **Auth**: JWT-based authentication

## User Personas
1. **Indie Hackers**: Quick prototyping without coding
2. **Developers**: Rapid scaffolding and code generation
3. **Entrepreneurs**: MVP creation for validation

## Core Requirements (Static)
- [x] Landing page with prompt input
- [x] JWT authentication (register/login)
- [x] Project creation and management
- [x] AI-powered code generation with SSE streaming
- [x] Live preview in iframe
- [x] Code editor with syntax highlighting
- [x] Project dashboard with status badges

## What's Been Implemented (Jan 2026)
- ✅ Full-stack MVP with FastAPI + React + MongoDB
- ✅ Landing page with hero section and example prompts
- ✅ Auth modal with login/register flow
- ✅ Dashboard with project cards and search
- ✅ Code generation page with Monaco Editor + live preview
- ✅ Project detail page with file tree and resizable panels
- ✅ SSE streaming for real-time code generation
- ✅ Console output showing generation progress
- ✅ Dark theme with glassmorphism UI

## Prioritized Backlog

### P0 (Critical - Done)
- [x] Landing page
- [x] Auth flow
- [x] Code generation
- [x] Live preview

### P1 (High Priority - Phase 2)
- [ ] GitHub OAuth integration
- [ ] Project templates/remix
- [ ] Code editing (not just viewing)
- [ ] Export to ZIP

### P2 (Medium Priority)
- [ ] Real Docker containers for isolation
- [ ] Git integration for version control
- [ ] Team collaboration
- [ ] Custom domain deployment

## Next Tasks
1. Add GitHub OAuth for easier auth
2. Implement project templates
3. Add code editing capability
4. Enable ZIP download of all files
5. Add project sharing/public URLs
