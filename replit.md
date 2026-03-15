# IIT Jodhpur Student Intelligence System

## Overview
A mobile-friendly web application for scouting and analyzing IIT Jodhpur students. Uses Tavily for web search and OpenAI (via Replit AI Integrations) for AI-powered student analysis. Dark theme enforced globally. 3,640 real student contacts imported from CSV. Supports @iitj.ac.in Google OAuth login for students to claim profiles and add social links.

## Architecture
- **Frontend**: React + Vite + TailwindCSS + Shadcn UI + Framer Motion
- **Backend**: Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: OpenAI GPT-5.2 via Replit AI Integrations (no API key needed)
- **Search**: Tavily API + Serper (Google Search) API (dual-source, parallel)
- **Auth**: Google OAuth via Passport.js (restricted to @iitj.ac.in), sessions stored in PostgreSQL via connect-pg-simple

## Key Features
1. **Student Search** - Autocomplete search by name, email, or roll number with debounced dropdown
2. **AI Analysis** - Tavily + Google dual web search + peer feedback + verified social links fed to GPT for student dossiers
3. **Response Caching** - AI responses cached in DB, regenerated only when new feedback is added
4. **Anonymous Peer Insights** - Users can add insights/feedback per student (no author name)
5. **Leaderboard** - Global ranking by search count or feedback count (filters out zeros)
6. **Daily Search Limit** - 200 searches/day per IP with visible counter on home screen
7. **Google OAuth Login** - @iitj.ac.in only, links Google account to matching student profile
8. **Social Links** - Authenticated students can add GitHub, LinkedIn, LeetCode, Behance, X, portfolio links
9. **Verified Profiles** - Claimed student profiles show a green shield badge
10. **Mobile-first Design** - Bottom navigation (search, ranks, profile when logged in), responsive layout
11. **Dark Theme** - Forced dark mode via `class="dark"` on `<html>` in index.html (no flash)

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
- Social link buttons below student info card (GitHub, LinkedIn, etc.)
- Green ShieldCheck icon for verified/claimed profiles

## Data Import
- Source: `contacts-1.csv` (3,700 rows, 3,640 after filtering institutional entries)
- Roll numbers extracted from name field pattern `Name (ROLL)` → stored in `rollNumber` column
- Photo URLs upgraded from `s72` thumbnails to `s400`
- Institutional entries (symposiums, dean offices, etc.) filtered out
- Batch insert with ON CONFLICT DO NOTHING for dedup

## Database Tables
- `students` - name, email, rollNumber, phone, pictureUrl, searchCount, feedbackCount
- `users` - googleId, email, name, pictureUrl, studentId (FK to students, nullable)
- `social_links` - studentId (FK), platform, url
- `feedback` - studentId, content, authorName, createdAt
- `cached_responses` - studentId, response, feedbackCountAtGeneration, createdAt
- `session` - PostgreSQL session store (auto-created by connect-pg-simple)
- Indexes: name (lower), roll_number, search_count DESC, feedback_count DESC

## API Endpoints
- `GET /api/students/search?q=` - Search students (by name, email, or roll number)
- `GET /api/students/:id` - Get student details + social links + claimed status
- `POST /api/students/:id/view` - Increment search/view count
- `POST /api/students/:id/analyze` - Generate/get AI analysis (includes verified social links)
- `GET /api/students/:id/feedback` - Get feedback list
- `POST /api/students/:id/feedback` - Submit anonymous feedback
- `GET /api/students/:id/social-links` - Get social links for a student
- `PUT /api/students/:id/social-links` - Update social links (auth required, own profile only)
- `GET /api/leaderboard?sort=strength|searches|personality&trait=<key>&limit=N` - Get leaderboard; personality sort supports optional trait filter (e.g. trait=funny); returns dominant trait + score /5; other tabs include verified badge
- `GET /api/students/:id/personality` - Get personality trait data (8 traits, avgScore, raterCount, myRating)
- `POST /api/students/:id/personality-rate` - Submit personality ratings 1-5 per trait (auth required, blocks self-rating)
- `GET /api/stats` - Get total student count
- `GET /api/search-limit` - Get daily search quota for current IP
- `GET /api/me` - Get current authenticated user
- `GET /api/auth/status` - Check if Google OAuth is enabled
- `GET /auth/google` - Initiate Google OAuth flow
- `GET /auth/google/callback` - Google OAuth callback
- `POST /auth/logout` - Logout

## Auth Flow
1. User clicks "iitj login" button on home page
2. Redirects to Google OAuth with `hd: "iitj.ac.in"` restriction
3. Callback verifies email ends with @iitj.ac.in
4. Creates user record, auto-links to matching student by email
5. Session stored in PostgreSQL, 30-day cookie
6. Authenticated users see "profile" tab in bottom nav
7. Profile page shows verified status, link to public profile, and social links editor

## Rate Limiting
- 200 searches/day per IP address (in-memory tracker, resets at midnight)
- Search input sanitizes SQL wildcards (`%`, `_`) before ILIKE queries

## Web Search Pipeline
- Runs Tavily and Serper (Google) searches in parallel for each analysis
- Tavily: basic depth, 5 results per query
- Serper: 7 results per query (Google search via serper.dev)
- Additional Serper queries for roll number and email when available
- Results deduplicated by URL across all sources
- Content moderation via GPT on all peer feedback submissions (blocks abuse, vulgar remarks, harassment)

## Social Profile Live Fetching
When a student has verified social links, their content is fetched live during analysis:
- **GitHub**: GitHub REST API — profile bio, public repo count, followers, top 6 repos with names/descriptions/languages/stars
- **LeetCode**: LeetCode public GraphQL API — total problems solved, difficulty breakdown (Easy/Medium/Hard), global ranking, badges
- **LinkedIn / Behance / Portfolio / Other**: Tavily extract endpoint — fetches raw page content (up to 3000 chars)
- All fetches run in parallel alongside web search
- Fetched content is passed to GPT as high-trust verified data with platform-specific instructions
- AI is instructed to cite specific details (repo names, problem counts, rankings) naturally in the dossier

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (auto-provisioned)
- `TAVILY_API_KEY` - Tavily API key for web search
- `SERPER_API_KEY` - Serper.dev API key for Google search results
- `AI_INTEGRATIONS_OPENAI_API_KEY` - Auto-set by Replit AI Integrations
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - Auto-set by Replit AI Integrations
- `SESSION_SECRET` - Session secret
- `GOOGLE_CLIENT_ID` - Google OAuth client ID (required for login feature)
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret (required for login feature)

## Valid Social Link Platforms
linkedin, github, leetcode, behance, twitter, portfolio, other
