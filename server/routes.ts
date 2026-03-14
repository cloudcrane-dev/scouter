import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import OpenAI from "openai";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

async function searchTavily(query: string, includeDomains?: string[]): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return "";

  try {
    const body: any = {
      api_key: apiKey,
      query,
      max_results: 5,
      search_depth: "basic",
      include_answer: true,
    };
    if (includeDomains?.length) {
      body.include_domains = includeDomains;
    }

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Tavily API error:", text);
      return "";
    }

    const data = await response.json();
    let context = "";
    if (data.answer) {
      context += `Summary: ${data.answer}\n\n`;
    }
    if (data.results) {
      for (const result of data.results) {
        context += `Source: ${result.title} (${result.url})\n${result.content}\n\n`;
      }
    }
    return context;
  } catch (error) {
    console.error("Tavily search error:", error);
    return "";
  }
}

async function searchSerper(query: string): Promise<string> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return "";

  try {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num: 10, gl: "us", hl: "en" }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Serper API error:", text);
      return "";
    }

    const data = await response.json();
    let context = "";
    if (data.organic) {
      for (const item of data.organic) {
        const snippet = item.snippet || "";
        context += `Source: ${item.title} (${item.link})\n${snippet}\n\n`;
      }
    }
    return context;
  } catch (error) {
    console.error("Serper search error:", error);
    return "";
  }
}

async function extractUrlContent(url: string): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return "";
  try {
    const response = await fetch("https://api.tavily.com/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, urls: [url] }),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return "";
    const data = await response.json();
    const result = data.results?.[0];
    if (!result?.raw_content) return "";
    return result.raw_content.slice(0, 3000);
  } catch {
    return "";
  }
}

async function fetchGitHubProfile(username: string): Promise<string> {
  try {
    const [profileRes, reposRes] = await Promise.all([
      fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
        headers: { Accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(8000),
      }),
      fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=6&type=owner`, {
        headers: { Accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(8000),
      }),
    ]);
    if (!profileRes.ok) return "";
    const profile = await profileRes.json();
    let out = `GitHub username: ${profile.login}\n`;
    if (profile.name) out += `Name: ${profile.name}\n`;
    if (profile.bio) out += `Bio: ${profile.bio}\n`;
    if (profile.company) out += `Company/Org: ${profile.company}\n`;
    if (profile.blog) out += `Website: ${profile.blog}\n`;
    out += `Public repos: ${profile.public_repos}, Followers: ${profile.followers}, Following: ${profile.following}\n`;

    if (reposRes.ok) {
      const repos = await reposRes.json();
      if (Array.isArray(repos) && repos.length > 0) {
        out += `Top repos:\n`;
        for (const r of repos.slice(0, 6)) {
          out += `  - ${r.name}${r.description ? ": " + r.description : ""} [${r.language || "unknown lang"}, ★${r.stargazers_count}]\n`;
        }
      }
    }
    return out.trim();
  } catch {
    return "";
  }
}

async function fetchLeetCodeStats(username: string): Promise<string> {
  try {
    const query = `{
      matchedUser(username: "${username}") {
        username
        profile { realName aboutMe school ranking }
        submitStatsGlobal {
          acSubmissionNum { difficulty count submissions }
        }
        badges { name }
      }
    }`;
    const response = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Referer": "https://leetcode.com" },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return "";
    const data = await response.json();
    const user = data.data?.matchedUser;
    if (!user) return "";
    let out = `LeetCode username: ${user.username}\n`;
    const p = user.profile;
    if (p?.realName) out += `Name: ${p.realName}\n`;
    if (p?.school) out += `School: ${p.school}\n`;
    if (p?.ranking) out += `Global ranking: #${p.ranking}\n`;
    const stats = user.submitStatsGlobal?.acSubmissionNum;
    if (stats) {
      for (const s of stats) {
        if (s.difficulty !== "All") out += `${s.difficulty} solved: ${s.count} (${s.submissions} submissions)\n`;
      }
      const total = stats.find((s: any) => s.difficulty === "All");
      if (total) out += `Total solved: ${total.count}\n`;
    }
    const badges = user.badges?.slice(0, 5).map((b: any) => b.name).join(", ");
    if (badges) out += `Badges: ${badges}\n`;
    return out.trim();
  } catch {
    return "";
  }
}

function parseUsernameFromUrl(url: string, platform: string): string | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    if (platform === "github" || platform === "leetcode") return parts[0] || null;
    if (platform === "linkedin") return parts[1] || null; // /in/username
    if (platform === "behance") return parts[0] || null;
    if (platform === "twitter") return parts[0]?.replace("@", "") || null;
    return null;
  } catch {
    return null;
  }
}

async function fetchSocialLinkContent(platform: string, url: string): Promise<string> {
  const username = parseUsernameFromUrl(url, platform);

  if (platform === "github" && username) {
    const content = await fetchGitHubProfile(username);
    if (content) return `[GitHub profile for @${username}]\n${content}`;
  }

  if (platform === "leetcode" && username) {
    const content = await fetchLeetCodeStats(username);
    if (content) return `[LeetCode profile for ${username}]\n${content}`;
  }

  const extracted = await extractUrlContent(url);
  if (extracted) {
    const label = platform.charAt(0).toUpperCase() + platform.slice(1);
    return `[${label} profile at ${url}]\n${extracted}`;
  }

  return `[${platform} profile: ${url} — content not fetchable]`;
}

async function gatherSocialLinksContent(links: { platform: string; url: string }[]): Promise<string> {
  if (!links.length) return "";
  const results = await Promise.allSettled(
    links.map(l => fetchSocialLinkContent(l.platform, l.url))
  );
  return results
    .filter(r => r.status === "fulfilled" && r.value)
    .map(r => (r as PromiseFulfilledResult<string>).value)
    .join("\n\n");
}

async function gatherWebContext(name: string, email?: string | null, rollNumber?: string | null): Promise<string> {
  const searchQuery = `${name} IIT Jodhpur`;
  const queries: Promise<string>[] = [
    searchTavily(searchQuery),
    searchSerper(searchQuery),
  ];

  if (rollNumber) {
    queries.push(searchSerper(`"${rollNumber}" IIT Jodhpur`));
  }
  if (email) {
    queries.push(searchSerper(`"${email}"`));
  }

  const settled = await Promise.allSettled(queries);
  const labels = ["Tavily", "Serper-name", "Serper-roll", "Serper-email"];
  for (let i = 0; i < settled.length; i++) {
    const r = settled[i];
    const label = labels[i] || `Query-${i}`;
    if (r.status === "fulfilled" && r.value) {
      console.log(`[${label}] Raw results:\n${r.value.substring(0, 1500)}`);
    } else if (r.status === "rejected") {
      console.error(`[${label}] Failed:`, r.reason);
    }
  }

  const seenUrls = new Set<string>();
  let combined = "";
  for (const result of settled) {
    if (result.status !== "fulfilled" || !result.value) continue;
    for (const line of result.value.split("\n\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const urlMatch = trimmed.match(/^Source:.*\(([^)]+)\)/);
      const url = urlMatch?.[1];
      if (url && seenUrls.has(url)) continue;
      if (url) seenUrls.add(url);
      combined += trimmed + "\n\n";
    }
  }
  return combined || "No web results found.";
}

async function generateAIAnalysis(
  student: { name: string; email?: string | null; rollNumber?: string | null },
  webContext: string,
  feedbackContext: string,
  socialLinksContent: string
): Promise<{ text: string; ratingsJson: string }> {
  const hasSocialContent = !!socialLinksContent.trim();

  const systemPrompt = `You are a sharp, honest profile coach for IIT Jodhpur students. Based on publicly available data and verified social profiles, you give each student a clear, personalised profile review — what's working, what isn't, and exactly how to improve. Write in plain English. No filler, no flattery.

STUDENT CONTEXT:
- This student is confirmed at IIT Jodhpur. Name, roll number, and @iitj.ac.in email are verified.
- Decode the roll number: B24CS = B.Tech 2024 Computer Science, M25LDS = M.Des 2025 Design, B23ME = B.Tech 2023 Mechanical, PHD = PhD student. Always state their program and graduation year.
- Prefixes: B=B.Tech, M=M.Tech/M.Des/MSc, PHD=PhD. Departments: CS, EE, ME, AI, LDS=Design, BS=Bioscience, CE=Civil, CH=Chemical, MA=Math, PH=Physics, MT=Metallurgy, etc.

DATA RULES:
- IGNORE web results clearly about a different person at another institution.
- ONLY use results mentioning IIT Jodhpur, iitj.ac.in, or matching the student's roll/email.
${hasSocialContent ? `- LIVE SOCIAL DATA below is self-verified by the student — treat it as ground truth. Cite specifics: repo names, LeetCode counts, LinkedIn headline, Behance projects.` : ""}
- NEVER reveal phone numbers, salary figures, private contact info, or raw URLs.

OUTPUT STRUCTURE — follow this exactly, using these markdown headers:

Start with 1–2 sentences introducing the student: program, batch year, and a quick summary of their online footprint.

## Strengths
3–5 bullet points. Be specific — name the platform, the number, the project, the club. Vague praise is useless.

## Improvement Areas
3–5 bullet points. Honest gaps. If their LinkedIn Experience is empty, say so. If they have no GitHub, say so. Don't soften real problems.

## Suggestions
4–6 concrete, actionable bullet points. Think like a placement advisor:
- What should they build, write, or publish?
- Which platforms need attention?
- What specific sections on LinkedIn/GitHub/etc. should they fill out?
- Any competitions, open source projects, or certifications worth pursuing for their field?

Make suggestions specific to their branch and year — a 2nd year CS student needs different advice than a final year Metallurgy student.

If peer feedback exists, weave the most relevant insight naturally into Strengths or Improvement Areas — don't create a separate section for it.

End with one line:
**Verdict:** <one honest, direct sentence summarising where they stand and the single most important thing to do next>

OUTPUT FORMAT — STRICT:
After the full review text above, append a [RATINGS] block with exactly these 4 integer scores (1–5):
- onlinePresence: visibility across web + social platforms (5 = strong multi-platform presence, 1 = ghost)
- codingActivity: GitHub, LeetCode, coding projects, technical output (5 = highly active, 1 = no evidence)
- realWorldExperience: internships, research, clubs, competitions, achievements (5 = strong track record, 1 = none found)
- profileCompleteness: claimed profile, photo, social links, filled sections (5 = fully built out, 1 = bare unclaimed profile)

Score honestly. Missing data = low score. Don't round up without evidence.

[RATINGS]
{"onlinePresence":3,"codingActivity":4,"realWorldExperience":2,"profileCompleteness":5}
[/RATINGS]`;

  const identifiers = [`**Name:** ${student.name}`];
  if (student.rollNumber) identifiers.push(`**Roll Number:** ${student.rollNumber}`);
  if (student.email) identifiers.push(`**Email:** ${student.email}`);

  let userPrompt = `Write a profile review for this IIT Jodhpur student using only the sources below. Do not invent facts.

${identifiers.join("\n")}

**Web search results:**
${webContext || "No web results found — student has minimal or no public web presence."}`;

  if (hasSocialContent) {
    userPrompt += `\n\n**Verified social profile data (fetched live from the student's own linked accounts):**\n${socialLinksContent}`;
  }

  userPrompt += `\n\n**Peer feedback (submitted anonymously by others):**\n${feedbackContext || "No peer feedback yet."}`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_completion_tokens: 8192,
  });

  const raw = response.choices[0]?.message?.content || "";

  const ratingsMatch = raw.match(/\[RATINGS\]\s*([\s\S]*?)\s*\[\/RATINGS\]/);
  const ratingsJson = ratingsMatch ? ratingsMatch[1].trim() : JSON.stringify({ onlinePresence: 1, codingActivity: 1, realWorldExperience: 1, profileCompleteness: 1 });
  const text = raw.replace(/\[RATINGS\][\s\S]*?\[\/RATINGS\]/g, "").trim() || "Unable to generate analysis.";

  return { text, ratingsJson };
}

async function moderateContent(text: string): Promise<{ allowed: boolean; reason: string }> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      messages: [
        {
          role: "system",
          content: `You are a content moderator. Evaluate if the following peer feedback about a student is appropriate. 

REJECT if it contains ANY of:
- Vulgar language, slurs, profanity, or sexual content
- Personal attacks, bullying, threats, or harassment
- Discriminatory remarks (caste, religion, gender, race, sexuality)
- Defamatory or false accusations
- Doxxing or sharing private information (phone numbers, addresses, passwords)
- Spam, gibberish, or completely irrelevant content

ALLOW if it is:
- Constructive feedback (positive or negative) about skills, work ethic, academics, projects, personality traits
- Honest opinions expressed respectfully, even if critical

Respond with EXACTLY one line:
ALLOW — if the content is acceptable
REJECT: <short reason> — if the content violates the rules`
        },
        { role: "user", content: text }
      ],
      max_completion_tokens: 50,
    });

    const result = (response.choices[0]?.message?.content || "").trim();
    if (result.startsWith("REJECT")) {
      const reason = result.replace(/^REJECT:?\s*/, "").trim() || "Content violates community guidelines.";
      return { allowed: false, reason: `Submission rejected: ${reason}` };
    }
    return { allowed: true, reason: "" };
  } catch (error) {
    console.error("Moderation error:", error);
    return { allowed: true, reason: "" };
  }
}

const DAILY_SEARCH_LIMIT = 200;
let globalSearchCount = { count: 0, date: "" };

function getClientIP(req: any): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const first = (typeof forwarded === "string" ? forwarded : forwarded[0]).split(",")[0].trim();
    if (first) return first;
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function getGlobalSearchInfo() {
  const today = new Date().toDateString();
  if (globalSearchCount.date !== today) {
    return { used: 0, limit: DAILY_SEARCH_LIMIT, remaining: DAILY_SEARCH_LIMIT };
  }
  return { used: globalSearchCount.count, limit: DAILY_SEARCH_LIMIT, remaining: DAILY_SEARCH_LIMIT - globalSearchCount.count };
}

function consumeSearch(_ip: string): boolean {
  const today = new Date().toDateString();
  if (globalSearchCount.date !== today) {
    globalSearchCount = { count: 1, date: today };
    return true;
  }
  if (globalSearchCount.count >= DAILY_SEARCH_LIMIT) return false;
  globalSearchCount.count++;
  return true;
}

const VALID_PLATFORMS = ["linkedin", "github", "leetcode", "behance", "twitter", "portfolio", "other"];

function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "Not authenticated" });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  const PgSession = connectPgSimple(session);

  app.use(session({
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  }));

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const hasGoogleAuth = !!(googleClientId && googleClientSecret);

  if (hasGoogleAuth) {
    const callbackURL = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}/auth/google/callback`;

    passport.use(new GoogleStrategy({
      clientID: googleClientId!,
      clientSecret: googleClientSecret!,
      callbackURL,
    }, async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email || !email.endsWith("@iitj.ac.in")) {
          return done(null, false, { message: "Only @iitj.ac.in email addresses are allowed." });
        }

        let user = await storage.findUserByGoogleId(profile.id);
        if (!user) {
          const student = await storage.getStudentByEmail(email);
          user = await storage.createUser({
            googleId: profile.id,
            email,
            name: profile.displayName || email.split("@")[0],
            pictureUrl: profile.photos?.[0]?.value,
            studentId: student?.id,
          });
        } else if (!user.studentId) {
          const student = await storage.getStudentByEmail(email);
          if (student) {
            await storage.updateUserStudentId(user.id, student.id);
            user = { ...user, studentId: student.id };
          }
        }

        return done(null, user);
      } catch (error) {
        return done(error as Error);
      }
    }));

    passport.serializeUser((user: any, done) => {
      done(null, user.id);
    });

    passport.deserializeUser(async (id: number, done) => {
      try {
        const [user] = await (await import("./db")).db
          .select().from((await import("@shared/schema")).users)
          .where((await import("drizzle-orm")).eq((await import("@shared/schema")).users.id, id));
        done(null, user || null);
      } catch (error) {
        done(error);
      }
    });

    app.use(passport.initialize());
    app.use(passport.session());

    app.get("/auth/google", passport.authenticate("google", {
      scope: ["profile", "email"],
      hd: "iitj.ac.in",
    }));

    app.get("/auth/google/callback",
      passport.authenticate("google", { failureRedirect: "/?auth=failed" }),
      (_req, res) => {
        res.redirect("/?auth=success");
      }
    );

    app.post("/auth/logout", (req, res) => {
      req.logout(() => {
        res.json({ success: true });
      });
    });
  } else {
    app.use(passport.initialize());

    app.get("/auth/google", (_req, res) => {
      res.status(503).json({ error: "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." });
    });

    app.post("/auth/logout", (_req, res) => {
      res.json({ success: true });
    });
  }

  app.get("/api/me", (req, res) => {
    if (req.isAuthenticated && req.isAuthenticated()) {
      const user = req.user as any;
      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        pictureUrl: user.pictureUrl,
        studentId: user.studentId,
        authenticated: true,
      });
    } else {
      res.json({ authenticated: false });
    }
  });

  app.get("/api/auth/status", (_req, res) => {
    res.json({ googleAuthEnabled: hasGoogleAuth });
  });

  app.get("/api/search-limit", (_req, res) => {
    res.json(getGlobalSearchInfo());
  });

  app.get("/api/students/search", async (req, res) => {
    try {
      const rawQuery = (req.query.q as string) || "";
      const query = rawQuery.replace(/[%_]/g, "").trim();
      if (!query || query.length < 2) {
        return res.json([]);
      }
      const results = await storage.searchStudents(query);
      res.json(results);
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });

  app.get("/api/students/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid student ID" });
      const student = await storage.getStudent(id);
      if (!student) return res.status(404).json({ error: "Student not found" });

      const links = await storage.getSocialLinks(id);
      const claimedBy = await storage.getUserByStudentId(id);

      res.json({
        ...student,
        socialLinks: links,
        claimed: !!claimedBy,
      });
    } catch (error) {
      console.error("Get student error:", error);
      res.status(500).json({ error: "Failed to get student" });
    }
  });

  app.post("/api/students/:id/view", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid student ID" });
      const student = await storage.getStudent(id);
      if (!student) return res.status(404).json({ error: "Student not found" });
      const ip = getClientIP(req);
      await Promise.all([
        storage.incrementSearchCount(id),
        storage.recordVisit(ip),
      ]);
      res.json({ success: true });
    } catch (error) {
      console.error("View count error:", error);
      res.status(500).json({ error: "Failed to record view" });
    }
  });

  app.post("/api/students/:id/analyze", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid student ID" });

      const ip = getClientIP(req);
      if (!consumeSearch(ip)) {
        return res.status(429).json({ error: "Daily scan limit reached (200/day). Try again tomorrow." });
      }

      const student = await storage.getStudent(id);
      if (!student) return res.status(404).json({ error: "Student not found" });

      const currentFeedback = await storage.getFeedback(id);
      const force = req.query.force === "true";
      const cachedResponse = force ? null : await storage.getCachedResponse(id);

      if (cachedResponse && cachedResponse.feedbackCountAtGeneration === student.feedbackCount) {
        let ratings: Record<string, number> | null = null;
        try { if (cachedResponse.ratings) ratings = JSON.parse(cachedResponse.ratings); } catch { ratings = null; }
        return res.json({ analysis: cachedResponse.response, ratings, cached: true });
      }

      const socialLinksData = await storage.getSocialLinks(id);

      const [webContext, socialLinksContent] = await Promise.all([
        gatherWebContext(student.name, student.email, student.rollNumber),
        gatherSocialLinksContent(socialLinksData),
      ]);

      if (socialLinksContent) {
        console.log(`[Social] Fetched content for ${socialLinksData.length} link(s):\n${socialLinksContent.substring(0, 1000)}`);
      }

      const feedbackContext = currentFeedback.length > 0
        ? currentFeedback.map((f, i) =>
            `Feedback ${i + 1}${f.authorName ? ` (by ${f.authorName})` : ""}: ${f.content}`
          ).join("\n")
        : "";

      const { text: analysis, ratingsJson } = await generateAIAnalysis(
        { name: student.name, email: student.email, rollNumber: student.rollNumber },
        webContext,
        feedbackContext,
        socialLinksContent
      );

      await storage.saveCachedResponse(id, analysis, student.feedbackCount, ratingsJson);

      let ratings: Record<string, number> | null = null;
      try { ratings = JSON.parse(ratingsJson); } catch { ratings = null; }

      res.json({ analysis, ratings, cached: false });
    } catch (error) {
      console.error("Analysis error:", error);
      res.status(500).json({ error: "Failed to generate analysis" });
    }
  });

  app.get("/api/students/:id/feedback", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid student ID" });
      const feedbackList = await storage.getFeedback(id);
      res.json(feedbackList);
    } catch (error) {
      console.error("Get feedback error:", error);
      res.status(500).json({ error: "Failed to get feedback" });
    }
  });

  app.post("/api/students/:id/feedback", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid student ID" });
      const student = await storage.getStudent(id);
      if (!student) return res.status(404).json({ error: "Student not found" });
      const { content, authorName } = req.body;
      if (!content || typeof content !== "string" || content.trim().length === 0) {
        return res.status(400).json({ error: "Feedback content is required" });
      }
      if (content.trim().length > 2000) {
        return res.status(400).json({ error: "Feedback must be under 2000 characters" });
      }
      if (content.trim().length < 10) {
        return res.status(400).json({ error: "Feedback must be at least 10 characters" });
      }

      const moderation = await moderateContent(content.trim());
      if (!moderation.allowed) {
        return res.status(400).json({ error: moderation.reason });
      }

      const fb = await storage.addFeedback({
        studentId: id,
        content: content.trim(),
        authorName: typeof authorName === "string" ? authorName.trim().slice(0, 100) || null : null,
      });
      res.status(201).json(fb);
    } catch (error) {
      console.error("Add feedback error:", error);
      res.status(500).json({ error: "Failed to add feedback" });
    }
  });

  app.get("/api/students/:id/social-links", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid student ID" });
      const links = await storage.getSocialLinks(id);
      res.json(links);
    } catch (error) {
      console.error("Get social links error:", error);
      res.status(500).json({ error: "Failed to get social links" });
    }
  });

  app.put("/api/students/:id/social-links", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid student ID" });

      const user = req.user as any;
      if (user.studentId !== id) {
        return res.status(403).json({ error: "You can only edit your own profile links." });
      }

      const { links } = req.body;
      if (!Array.isArray(links)) {
        return res.status(400).json({ error: "links must be an array" });
      }

      if (links.length > 10) {
        return res.status(400).json({ error: "Maximum 10 links allowed" });
      }

      for (const link of links) {
        if (!link.platform || !link.url) {
          return res.status(400).json({ error: "Each link must have platform and url" });
        }
        if (!VALID_PLATFORMS.includes(link.platform)) {
          return res.status(400).json({ error: `Invalid platform: ${link.platform}. Valid: ${VALID_PLATFORMS.join(", ")}` });
        }
        try {
          const parsed = new URL(link.url);
          if (!["http:", "https:"].includes(parsed.protocol)) {
            return res.status(400).json({ error: `Only http/https URLs allowed: ${link.url}` });
          }
        } catch {
          return res.status(400).json({ error: `Invalid URL: ${link.url}` });
        }
      }

      const saved = await storage.setSocialLinks(id, links);
      await storage.invalidateCache(id);
      res.json(saved);
    } catch (error) {
      console.error("Set social links error:", error);
      res.status(500).json({ error: "Failed to save social links" });
    }
  });

  app.get("/api/leaderboard", async (req, res) => {
    try {
      const rawSort = req.query.sort as string;
      const sortBy = rawSort === "feedback" ? "feedback" : rawSort === "strength" ? "strength" : "searches";
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const leaderboard = await storage.getLeaderboard(sortBy, limit);
      res.json(leaderboard);
    } catch (error) {
      console.error("Leaderboard error:", error);
      res.status(500).json({ error: "Failed to get leaderboard" });
    }
  });

  app.get("/api/stats", async (req, res) => {
    try {
      const [totalStudents, dau, mau, vau] = await Promise.all([
        storage.getStudentCount(),
        storage.getDailyActiveUsers(),
        storage.getMonthlyActiveUsers(),
        storage.getVerifiedActiveUsers(),
      ]);
      res.json({ totalStudents, dau, mau, vau });
    } catch (error) {
      res.status(500).json({ error: "Failed to get stats" });
    }
  });

  return httpServer;
}
