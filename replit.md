# IIT Jodhpur Student Scouter

## Overview
A mobile-friendly web application for scouting and analyzing IIT Jodhpur students. Uses Tavily for web search and OpenAI (via Replit AI Integrations) for AI-powered student analysis.

## Architecture
- **Frontend**: React + Vite + TailwindCSS + Shadcn UI
- **Backend**: Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: OpenAI GPT-5.2 via Replit AI Integrations (no API key needed)
- **Search**: Tavily API for web search context

## Key Features
1. **Student Search** - Autocomplete search by name or email
2. **AI Analysis** - Tavily web search + peer feedback fed to GPT for comprehensive student profiles
3. **Response Caching** - AI responses cached in DB, regenerated only when new feedback is added
4. **Peer Feedback** - Users can add insights/feedback per student
5. **Leaderboard** - Global ranking by search count and feedback count
6. **Mobile-first Design** - Bottom navigation, responsive layout

## Data Flow
1. User searches student by name/email
2. User selects a student profile (search count increments)
3. User clicks "Generate Analysis" → Tavily search runs → feedback fetched → both sent to AI
4. AI generates strengths/weaknesses/overview → cached in DB
5. On next visit: if no new feedback, cached response returned; otherwise regenerated
6. Users can submit feedback which enriches future AI analyses

## Database Tables
- `students` - name, email, phone, pictureUrl, searchCount, feedbackCount
- `feedback` - studentId, content, authorName, createdAt
- `cached_responses` - studentId, response, feedbackCountAtGeneration, createdAt
- `conversations`, `messages` - chat integration tables (from blueprint)

## API Endpoints
- `GET /api/students/search?q=` - Search students
- `GET /api/students/:id` - Get student (increments search count)
- `POST /api/students/:id/analyze` - Generate/get AI analysis
- `GET /api/students/:id/feedback` - Get feedback list
- `POST /api/students/:id/feedback` - Submit feedback
- `GET /api/leaderboard?sort=searches|feedback` - Get leaderboard
- `GET /api/stats` - Get total student count

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (auto-provisioned)
- `TAVILY_API_KEY` - Tavily API key for web search
- `AI_INTEGRATIONS_OPENAI_API_KEY` - Auto-set by Replit AI Integrations
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - Auto-set by Replit AI Integrations
- `SESSION_SECRET` - Session secret
