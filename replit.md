# IIT Jodhpur Student Scouter

## Overview
A mobile-friendly web application for scouting and analyzing IIT Jodhpur students. Uses Tavily for web search and OpenAI (via Replit AI Integrations) for AI-powered student analysis. Dark theme enforced globally.

## Architecture
- **Frontend**: React + Vite + TailwindCSS + Shadcn UI + Framer Motion
- **Backend**: Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: OpenAI GPT-5.2 via Replit AI Integrations (no API key needed)
- **Search**: Tavily API for web search context

## Key Features
1. **Student Search** - Autocomplete search by name or email with debounced dropdown
2. **AI Analysis** - Tavily web search + peer feedback fed to GPT for comprehensive student profiles
3. **Response Caching** - AI responses cached in DB, regenerated only when new feedback is added
4. **Anonymous Peer Insights** - Users can add insights/feedback per student (no author name)
5. **Leaderboard** - Global ranking by search count or feedback count with sort toggle
6. **Mobile-first Design** - Bottom navigation, responsive layout, glassmorphism cards
7. **Dark Theme** - Forced dark mode via `class="dark"` on `<html>` in index.html (no flash)

## UI Design
- Hacker/terminal aesthetic: pure black & white, no color
- Font: JetBrains Mono (monospace throughout) with variable weight
- Particle physics canvas: floating particles with mouse repulsion, connections, click burst
- Scanline overlay animation
- Sharp edges (no border-radius), minimal borders (border-white/8)
- Framer Motion animations: staggered lists, terminal-style loader
- Bottom nav with active indicator (thin white line)
- No trending section on home page
- Phone number NOT shown on student profile
- Peer feedback list NOT shown (only insight submission)
- Compact AI Analysis section with terminal-style "$ run analysis" button

## Data Flow
1. User searches student by name/email
2. User selects a student profile (POST /view increments search count)
3. User clicks "Generate Analysis" → Tavily search runs → feedback fetched → both sent to AI
4. AI generates insights → cached in DB
5. On next visit: if no new feedback, cached response returned; otherwise regenerated
6. Users can submit anonymous insights which enrich future AI analyses

## Database Tables
- `students` - name, email, phone, pictureUrl, searchCount, feedbackCount
- `feedback` - studentId, content, authorName, createdAt
- `cached_responses` - studentId, response, feedbackCountAtGeneration, createdAt

## API Endpoints
- `GET /api/students/search?q=` - Search students
- `GET /api/students/:id` - Get student details
- `POST /api/students/:id/view` - Increment search/view count
- `POST /api/students/:id/analyze` - Generate/get AI analysis
- `GET /api/students/:id/feedback` - Get feedback list
- `POST /api/students/:id/feedback` - Submit anonymous feedback
- `GET /api/leaderboard?sort=searches|feedback&limit=N` - Get leaderboard
- `GET /api/stats` - Get total student count

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (auto-provisioned)
- `TAVILY_API_KEY` - Tavily API key for web search
- `AI_INTEGRATIONS_OPENAI_API_KEY` - Auto-set by Replit AI Integrations
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - Auto-set by Replit AI Integrations
- `SESSION_SECRET` - Session secret
