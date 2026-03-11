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
  tavilyContext: string,
  feedbackContext: string
): Promise<string> {
  const systemPrompt = `You are a chill analyst for the IIT Jodhpur Student Intelligence System. Write a brief, mildly witty dossier about a student.

BASELINE FACTS (always true — every student in this system is from IIT Jodhpur):
- The student IS confirmed at IIT Jodhpur. Their name, roll number, and email (@iitj.ac.in) are verified.
- Decode the roll number format: e.g. B24CS = B.Tech 2024 CS, M25LDS = M.Des 2025, B23ME = B.Tech 2023 Mechanical, M24EE = M.Tech 2024 EE, PHD = PhD student. Use this to state their program and batch year as fact.
- Common roll prefixes: B=B.Tech, M=M.Tech/M.Des/MSc, PHD=PhD. Department codes: CS=Computer Science, EE=Electrical, ME=Mechanical, AI=AI, LDS=Design, BS=Bioscience, CE=Civil, CH=Chemical, MA=Math, PH=Physics, MT=Metallurgy, etc.

SEARCH RESULT FILTERING:
- DISCARD any result clearly about a DIFFERENT person at a different institution (MNNIT, IIT Kharagpur, Karlsruhe, Chandigarh University, etc.).
- INCLUDE results that mention IIT Jodhpur, iitj.ac.in, or match the student's roll/email.
- Results mentioning the name without a conflicting institution can be included cautiously.

STYLE:
- Write 1-2 short paragraphs. Keep it under 80 words total.
- State their program/batch from the roll number. Mention any work/clubs/projects found in search results.
- Add ONE subtle witty remark or observation — light touch, not a full roast.
- If peer feedback exists, weave it in as a brief quote.
- If no useful search results were found beyond the roll number, keep it short and casual.
- DO NOT list URLs or links.
- DO NOT have section headers or bullet points.
- End with a short **Verdict** — one casual sentence.

Keep it tight. Less is more.`;

  const identifiers = [`**Name:** ${student.name}`];
  if (student.rollNumber) identifiers.push(`**Roll Number:** ${student.rollNumber}`);
  if (student.email) identifiers.push(`**Email:** ${student.email}`);

  const userPrompt = `Write a witty intelligence dossier about this IIT Jodhpur student. Use ONLY the sources and peer feedback below — no invented facts.

${identifiers.join("\n")}

**Intel gathered (web search results):**
${tavilyContext || "No web results available."}

**Street gossip (peer feedback):**
${feedbackContext || "Nobody's talking. Yet."}`;

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

      const ip = getClientIP(req);
      if (!consumeSearch(ip)) {
        return res.status(429).json({ error: "Daily scan limit reached (200/day). Try again tomorrow." });
      }

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
