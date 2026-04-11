import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

async function searchTavily(query: string): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("TAVILY_API_KEY not set");

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: 5,
      include_answer: true,
    }),
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
      context += `Source: ${result.title}\n${result.content}\n\n`;
    }
  }
  return context || "No web results found.";
}

async function generateAIAnalysis(
  studentName: string,
  tavilyContext: string
): Promise<string> {
  const systemPrompt = `You are an intelligent student profiling assistant for IIT Jodhpur. Given information about a student from web searches, provide a comprehensive analysis including:

1. **Overview**: A brief introduction about the person
2. **Strengths**: Key strengths based on available information
3. **Areas of Interest**: Academic or extracurricular interests
4. **Notable Achievements**: Any achievements found online
5. **Overall Impression**: A balanced, respectful summary

Be factual and respectful. If information is limited, say so honestly. Never fabricate information. Format using markdown.`;

  const userPrompt = `Analyze this student from IIT Jodhpur:

**Name:** ${studentName}

**Web Search Results:**
${tavilyContext || "No web results available."}

Please provide a detailed, insightful analysis.`;

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

type ResumeRatingResult = {
  rating: number;
  summary: string;
  improvementFactors: string[];
};

async function generateResumeRating(resumeText: string): Promise<ResumeRatingResult> {
  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    messages: [
      {
        role: "system",
        content: "You are a resume reviewer. Return strict JSON only with keys: rating (0-100 integer), summary (string), improvementFactors (array of 3-8 short actionable strings)."
      },
      {
        role: "user",
        content: `Review this resume and score it:\n\n${resumeText}`,
      },
    ],
    max_completion_tokens: 1200,
  });

  const raw = response.choices[0]?.message?.content?.trim() || "";
  const jsonText = raw.startsWith("{") ? raw : raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  const parsed = JSON.parse(jsonText);

  const rating = Math.max(0, Math.min(100, Math.round(Number(parsed.rating) || 0)));
  const summary = String(parsed.summary || "No summary available.").slice(0, 1200);
  const improvementFactors = Array.isArray(parsed.improvementFactors)
    ? parsed.improvementFactors.map((item) => String(item).trim()).filter(Boolean).slice(0, 8)
    : [];

  return {
    rating,
    summary,
    improvementFactors,
  };
}

function requireAuth(req: Request): { handle: string; displayName: string } | null {
  return req.session.user ?? null;
}

const DAILY_SEARCH_LIMIT = 200;
let dailySearchCount = 0;
let lastResetDate = new Date().toDateString();

function getDailySearchInfo() {
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    dailySearchCount = 0;
    lastResetDate = today;
  }
  return { used: dailySearchCount, limit: DAILY_SEARCH_LIMIT, remaining: DAILY_SEARCH_LIMIT - dailySearchCount };
}

function consumeSearch(): boolean {
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    dailySearchCount = 0;
    lastResetDate = today;
  }
  if (dailySearchCount >= DAILY_SEARCH_LIMIT) return false;
  dailySearchCount++;
  return true;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/auth/me", (req, res) => {
    if (!req.session.user) {
      return res.status(401).json({ loggedIn: false });
    }
    return res.json({ loggedIn: true, user: req.session.user });
  });

  app.post("/api/auth/login", (req, res) => {
    const rawHandle = typeof req.body?.handle === "string" ? req.body.handle.trim() : "";
    if (!rawHandle) {
      return res.status(400).json({ error: "Handle is required" });
    }
    const normalized = rawHandle.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 32);
    if (!normalized) {
      return res.status(400).json({ error: "Handle must include letters or numbers" });
    }

    req.session.user = {
      handle: normalized,
      displayName: rawHandle.slice(0, 40),
    };

    return res.json({ loggedIn: true, user: req.session.user });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.clearCookie("connect.sid");
      return res.json({ loggedIn: false });
    });
  });

  app.get("/api/search-limit", (_req, res) => {
    res.json(getDailySearchInfo());
  });

  app.get("/api/students/search", async (req, res) => {
    try {
      const query = (req.query.q as string) || "";
      if (!query || query.length < 2) {
        return res.json([]);
      }
      if (!consumeSearch()) {
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

      const cachedResponse = await storage.getCachedResponse(id);

      if (cachedResponse) {
        return res.json({ analysis: cachedResponse.response, cached: true });
      }

      const tavilyQuery = `${student.name} IIT Jodhpur`;
      const tavilyContext = await searchTavily(tavilyQuery);

      const analysis = await generateAIAnalysis(student.name, tavilyContext);

      await storage.saveCachedResponse(id, analysis);

      res.json({ analysis, cached: false });
    } catch (error) {
      console.error("Analysis error:", error);
      res.status(500).json({ error: "Failed to generate analysis" });
    }
  });

  app.get("/api/students/:id/upvote-status", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid student ID" });
      const student = await storage.getStudent(id);
      if (!student) return res.status(404).json({ error: "Student not found" });

      const user = requireAuth(req);
      const hasUpvoted = user ? await storage.hasUpvoted(id, user.handle) : false;
      res.json({ upvoteCount: student.upvoteCount, hasUpvoted });
    } catch (error) {
      console.error("Upvote status error:", error);
      res.status(500).json({ error: "Failed to get upvote status" });
    }
  });

  app.post("/api/students/:id/upvote", async (req, res) => {
    try {
      const user = requireAuth(req);
      if (!user) return res.status(401).json({ error: "Login required" });

      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid student ID" });
      const student = await storage.getStudent(id);
      if (!student) return res.status(404).json({ error: "Student not found" });

      const hasUpvoted = await storage.hasUpvoted(id, user.handle);
      if (hasUpvoted) {
        return res.status(409).json({ error: "Already upvoted" });
      }

      await storage.addUpvote({
        studentId: id,
        voterHandle: user.handle,
      });

      const updated = await storage.getStudent(id);
      return res.status(201).json({ success: true, upvoteCount: updated?.upvoteCount ?? student.upvoteCount + 1 });
    } catch (error) {
      console.error("Upvote error:", error);
      res.status(500).json({ error: "Failed to upvote profile" });
    }
  });

  app.post("/api/students/:id/resume-rating", async (req, res) => {
    try {
      const user = requireAuth(req);
      if (!user) return res.status(401).json({ error: "Login required" });

      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid student ID" });
      const student = await storage.getStudent(id);
      if (!student) return res.status(404).json({ error: "Student not found" });

      const { resumeText, fileName } = req.body;
      if (!resumeText || typeof resumeText !== "string") {
        return res.status(400).json({ error: "Resume content is required" });
      }
      const trimmedResume = resumeText.trim();
      if (trimmedResume.length < 100) {
        return res.status(400).json({ error: "Resume content is too short" });
      }
      if (trimmedResume.length > 30000) {
        return res.status(400).json({ error: "Resume content is too long" });
      }

      const aiRating = await generateResumeRating(trimmedResume);
      const created = await storage.addResumeRating({
        studentId: id,
        reviewerHandle: user.handle,
        fileName: typeof fileName === "string" ? fileName.slice(0, 255) : "resume.txt",
        resumeText: trimmedResume,
        rating: aiRating.rating,
        summary: aiRating.summary,
        improvementFactors: JSON.stringify(aiRating.improvementFactors),
      });

      res.status(201).json({
        id: created.id,
        rating: created.rating,
        summary: created.summary,
        improvementFactors: aiRating.improvementFactors,
        fileName: created.fileName,
        createdAt: created.createdAt,
      });
    } catch (error) {
      console.error("Resume rating error:", error);
      res.status(500).json({ error: "Failed to generate resume rating" });
    }
  });

  app.post("/api/students/:id/resumes", async (req, res) => {
    try {
      const user = requireAuth(req);
      if (!user) return res.status(401).json({ error: "Login required" });

      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid student ID" });
      const student = await storage.getStudent(id);
      if (!student) return res.status(404).json({ error: "Student not found" });

      const { fileName, mimeType, contentBase64, sizeBytes } = req.body;
      if (typeof fileName !== "string" || !fileName.trim()) {
        return res.status(400).json({ error: "fileName is required" });
      }
      if (typeof mimeType !== "string" || !mimeType.trim()) {
        return res.status(400).json({ error: "mimeType is required" });
      }
      if (typeof contentBase64 !== "string" || !contentBase64.trim()) {
        return res.status(400).json({ error: "contentBase64 is required" });
      }
      const parsedSize = Number(sizeBytes);
      if (!Number.isFinite(parsedSize) || parsedSize <= 0 || parsedSize > 8 * 1024 * 1024) {
        return res.status(400).json({ error: "Resume must be under 8MB" });
      }

      const created = await storage.addStudentResume({
        studentId: id,
        fileName: fileName.trim().slice(0, 255),
        mimeType: mimeType.trim().slice(0, 120),
        contentBase64: contentBase64.trim(),
        sizeBytes: Math.round(parsedSize),
        uploadedBy: user.handle,
      });

      return res.status(201).json({
        id: created.id,
        fileName: created.fileName,
        mimeType: created.mimeType,
        sizeBytes: created.sizeBytes,
        uploadedBy: created.uploadedBy,
        createdAt: created.createdAt,
      });
    } catch (error) {
      console.error("Resume upload error:", error);
      return res.status(500).json({ error: "Failed to upload resume" });
    }
  });

  app.get("/api/students/:id/resumes", async (req, res) => {
    try {
      const user = requireAuth(req);
      if (!user) return res.status(401).json({ error: "Login required" });

      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid student ID" });
      const student = await storage.getStudent(id);
      if (!student) return res.status(404).json({ error: "Student not found" });

      const resumes = await storage.listStudentResumes(id);
      return res.json(
        resumes.map((resume) => ({
          id: resume.id,
          fileName: resume.fileName,
          mimeType: resume.mimeType,
          sizeBytes: resume.sizeBytes,
          uploadedBy: resume.uploadedBy,
          createdAt: resume.createdAt,
        }))
      );
    } catch (error) {
      console.error("List resumes error:", error);
      return res.status(500).json({ error: "Failed to list resumes" });
    }
  });

  app.get("/api/students/:id/resumes/:resumeId/download", async (req, res) => {
    try {
      const user = requireAuth(req);
      if (!user) return res.status(401).json({ error: "Login required" });

      const id = parseInt(req.params.id);
      const resumeId = parseInt(req.params.resumeId);
      if (isNaN(id) || isNaN(resumeId)) {
        return res.status(400).json({ error: "Invalid student or resume ID" });
      }

      const student = await storage.getStudent(id);
      if (!student) return res.status(404).json({ error: "Student not found" });

      const resume = await storage.getStudentResumeById(id, resumeId);
      if (!resume) return res.status(404).json({ error: "Resume not found" });

      const fileBuffer = Buffer.from(resume.contentBase64, "base64");
      res.setHeader("Content-Type", resume.mimeType || "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename=\"${resume.fileName.replace(/\"/g, "")}\"`);
      res.setHeader("Content-Length", String(fileBuffer.length));
      return res.send(fileBuffer);
    } catch (error) {
      console.error("Download resume error:", error);
      return res.status(500).json({ error: "Failed to download resume" });
    }
  });

  app.get("/api/students/:id/resume-rating/me", async (req, res) => {
    try {
      const user = requireAuth(req);
      if (!user) return res.status(401).json({ error: "Login required" });

      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid student ID" });
      const student = await storage.getStudent(id);
      if (!student) return res.status(404).json({ error: "Student not found" });

      const latest = await storage.getLatestResumeRating(id, user.handle);
      if (!latest) {
        return res.json(null);
      }

      return res.json({
        id: latest.id,
        rating: latest.rating,
        summary: latest.summary,
        improvementFactors: JSON.parse(latest.improvementFactors) as string[],
        fileName: latest.fileName,
        createdAt: latest.createdAt,
      });
    } catch (error) {
      console.error("Latest resume rating error:", error);
      return res.status(500).json({ error: "Failed to get latest resume rating" });
    }
  });

  app.get("/api/leaderboard", async (req, res) => {
    try {
      const sortBy = (req.query.sort as string) === "upvotes" ? "upvotes" : "searches";
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
