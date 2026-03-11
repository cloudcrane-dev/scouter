import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

async function searchTavily(query: string, includeDomains?: string[]): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("TAVILY_API_KEY not set");

  const body: any = {
    api_key: apiKey,
    query,
    max_results: 7,
    search_depth: "advanced",
    include_answer: true,
  };
  if (includeDomains?.length) {
    body.include_domains = includeDomains;
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("Tavily API error:", text);
    return "No web results found.";
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
  return context || "No web results found.";
}

async function gatherWebContext(name: string, email?: string | null, rollNumber?: string | null): Promise<string> {
  const queries: Promise<string>[] = [];

  queries.push(searchTavily(`"${name}" IIT Jodhpur student profile achievements projects`));

  queries.push(searchTavily(`"${name}" site:linkedin.com OR site:github.com OR site:codeforces.com OR site:leetcode.com`));

  if (rollNumber) {
    queries.push(searchTavily(`"${rollNumber}" IIT Jodhpur`));
  }

  if (email && !email.endsWith("@iitj.ac.in")) {
    queries.push(searchTavily(`"${email}"`));
  }

  const results = await Promise.all(queries);
  const seen = new Set<string>();
  let combined = "";
  for (const r of results) {
    for (const line of r.split("\n\n")) {
      const trimmed = line.trim();
      if (trimmed && !seen.has(trimmed)) {
        seen.add(trimmed);
        combined += trimmed + "\n\n";
      }
    }
  }
  return combined || "No web results found.";
}

async function generateAIAnalysis(
  student: { name: string; email?: string | null; rollNumber?: string | null },
  tavilyContext: string,
  feedbackContext: string
): Promise<string> {
  const systemPrompt = `You are an intelligence analyst for the IIT Jodhpur Student Intelligence System. Your job is to build the most comprehensive dossier possible on a student from web data and peer intel.

Instructions:
- Extract EVERY concrete detail from the web results: specific projects, repos, roles, companies, publications, competition ranks, skills, technologies, club memberships, social handles.
- Synthesize information across sources — connect GitHub activity to LinkedIn roles, match competition results to skills, etc.
- When information is genuinely unavailable, state it briefly and move on. Do NOT pad sections with generic statements about what "typically indicates" or what "suggests". Only report what you actually found.
- If a section has nothing concrete, write "No data found." and move on. Short is better than speculative.
- Never fabricate information. Never hedge with "likely" or "typically" unless backed by actual evidence.
- Be direct, concise, and specific.

Format your analysis with these sections:
1. **Overview** — Who they are: program, batch year, department (if found). 2-3 sentences max.
2. **Technical Profile** — Languages, frameworks, tools, GitHub repos, coding competition profiles, technical projects found online.
3. **Professional Experience** — Internships, jobs, companies, roles, durations if available.
4. **Achievements & Recognition** — Competition ranks, awards, publications, open source contributions, hackathon results.
5. **Campus & Extracurriculars** — Clubs, societies, positions of responsibility, event organizing.
6. **Peer Intel** — Summarize peer feedback if available. If none, write "No peer intel submitted."
7. **Assessment** — 2-3 sentence overall picture based ONLY on concrete evidence found.

Use markdown formatting.`;

  const identifiers = [`**Name:** ${student.name}`];
  if (student.rollNumber) identifiers.push(`**Roll Number:** ${student.rollNumber}`);
  if (student.email) identifiers.push(`**Email:** ${student.email}`);

  const userPrompt = `Build a dossier on this IIT Jodhpur student:

${identifiers.join("\n")}

**Web Intelligence:**
${tavilyContext || "No web results available."}

**Peer Intel:**
${feedbackContext || "No peer feedback available yet."}`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_completion_tokens: 8192,
  });

  return response.choices[0]?.message?.content || "Unable to generate analysis.";
}

const DAILY_SEARCH_LIMIT = 200;
const ipSearchCounts = new Map<string, { count: number; date: string }>();

function getClientIP(req: any): string {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function getIPSearchInfo(ip: string) {
  const today = new Date().toDateString();
  const entry = ipSearchCounts.get(ip);
  if (!entry || entry.date !== today) {
    return { used: 0, limit: DAILY_SEARCH_LIMIT, remaining: DAILY_SEARCH_LIMIT };
  }
  return { used: entry.count, limit: DAILY_SEARCH_LIMIT, remaining: DAILY_SEARCH_LIMIT - entry.count };
}

function consumeSearch(ip: string): boolean {
  const today = new Date().toDateString();
  const entry = ipSearchCounts.get(ip);
  if (!entry || entry.date !== today) {
    ipSearchCounts.set(ip, { count: 1, date: today });
    return true;
  }
  if (entry.count >= DAILY_SEARCH_LIMIT) return false;
  entry.count++;
  return true;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/search-limit", (req, res) => {
    const ip = getClientIP(req);
    res.json(getIPSearchInfo(ip));
  });

  app.get("/api/students/search", async (req, res) => {
    try {
      const rawQuery = (req.query.q as string) || "";
      const query = rawQuery.replace(/[%_]/g, "").trim();
      if (!query || query.length < 2) {
        return res.json([]);
      }
      const ip = getClientIP(req);
      if (!consumeSearch(ip)) {
        return res.status(429).json({ error: "Daily search limit reached (200/day). Try again tomorrow." });
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
      res.json(student);
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
      await storage.incrementSearchCount(id);
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
      const student = await storage.getStudent(id);
      if (!student) return res.status(404).json({ error: "Student not found" });

      const currentFeedback = await storage.getFeedback(id);
      const cachedResponse = await storage.getCachedResponse(id);

      if (cachedResponse && cachedResponse.feedbackCountAtGeneration === student.feedbackCount) {
        return res.json({ analysis: cachedResponse.response, cached: true });
      }

      const tavilyContext = await gatherWebContext(student.name, student.email, student.rollNumber);

      const feedbackContext = currentFeedback.length > 0
        ? currentFeedback.map((f, i) =>
            `Feedback ${i + 1}${f.authorName ? ` (by ${f.authorName})` : ""}: ${f.content}`
          ).join("\n")
        : "";

      const analysis = await generateAIAnalysis(
        { name: student.name, email: student.email, rollNumber: student.rollNumber },
        tavilyContext,
        feedbackContext
      );

      await storage.saveCachedResponse(id, analysis, student.feedbackCount);

      res.json({ analysis, cached: false });
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

  app.get("/api/leaderboard", async (req, res) => {
    try {
      const sortBy = (req.query.sort as string) === "feedback" ? "feedback" : "searches";
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
      const count = await storage.getStudentCount();
      res.json({ totalStudents: count });
    } catch (error) {
      res.status(500).json({ error: "Failed to get stats" });
    }
  });

  return httpServer;
}
