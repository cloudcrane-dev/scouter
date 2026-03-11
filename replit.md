# IIT Jodhpur Student Intelligence System

## Overview
A mobile-friendly web application for scouting and analyzing IIT Jodhpur students. Uses Tavily for web search and OpenAI (via Replit AI Integrations) for AI-powered student analysis. Dark theme enforced globally. 3,640 real student contacts imported from CSV.

## Architecture
- **Frontend**: React + Vite + TailwindCSS + Shadcn UI + Framer Motion
- **Backend**: Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: OpenAI GPT-5.2 via Replit AI Integrations (no API key needed)
- **Search**: Tavily API for web search context

## Key Features
1. **Student Search** - Autocomplete search by name, email, or roll number with debounced dropdown
2. **AI Analysis** - Tavily web search + peer feedback fed to GPT for comprehensive student profiles
3. **Response Caching** - AI responses cached in DB, regenerated only when new feedback is added
4. **Anonymous Peer Insights** - Users can add insights/feedback per student (no author name)
5. **Leaderboard** - Global ranking by search count or feedback count (filters out zeros)
6. **Daily Search Limit** - 200 searches/day per IP with visible counter on home screen
7. **Mobile-first Design** - Bottom navigation, responsive layout
8. **Dark Theme** - Forced dark mode via `class="dark"` on `<html>` in index.html (no flash)

## UI Design
- Hacker/terminal aesthetic: pure black & white, no color
- Font: JetBrains Mono (monospace throughout) with variable weight
- Scanline overlay animation
- Sharp edges (no border-radius), minimal borders (border-white/8)
- Framer Motion animations: staggered lists, terminal-style loader
- Bottom nav with active indicator (thin white line)
- Roll number displayed on student profile when available
- Phone number NOT shown on student profile
- Peer feedback list NOT shown (only insight submission)
- Compact AI Analysis section with terminal-style "$ run analysis" button

## Data Import
- Source: `contacts-1.csv` (3,700 rows, 3,640 after filtering institutional entries)
- Roll numbers extracted from name field pattern `Name (ROLL)` → stored in `rollNumber` column
- Photo URLs upgraded from `s72` thumbnails to `s400`
- Institutional entries (symposiums, dean offices, etc.) filtered out
- Batch insert with ON CONFLICT DO NOTHING for dedup

## Database Tables
- `students` - name, email, rollNumber, phone, pictureUrl, searchCount, feedbackCount
- `feedback` - studentId, content, authorName, createdAt
- `cached_responses` - studentId, response, feedbackCountAtGeneration, createdAt
- Indexes: name (lower), roll_number, search_count DESC, feedback_count DESC

## API Endpoints
- `GET /api/students/search?q=` - Search students (by name, email, or roll number)
- `GET /api/students/:id` - Get student details
- `POST /api/students/:id/view` - Increment search/view count
- `POST /api/students/:id/analyze` - Generate/get AI analysis
- `GET /api/students/:id/feedback` - Get feedback list
- `POST /api/students/:id/feedback` - Submit anonymous feedback
- `GET /api/leaderboard?sort=searches|feedback&limit=N` - Get leaderboard (filters zeros)
- `GET /api/stats` - Get total student count
- `GET /api/search-limit` - Get daily search quota for current IP

## Rate Limiting
- 200 searches/day per IP address (in-memory tracker, resets at midnight)
- Search input sanitizes SQL wildcards (`%`, `_`) before ILIKE queries

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (auto-provisioned)
- `TAVILY_API_KEY` - Tavily API key for web search
- `AI_INTEGRATIONS_OPENAI_API_KEY` - Auto-set by Replit AI Integrations
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - Auto-set by Replit AI Integrations
- `SESSION_SECRET` - Session secret
