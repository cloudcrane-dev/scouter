import { storage } from "./storage";
import { sendTopStrengthEmail, sendTopViewsEmail, sendLowStrengthEmail, getISOWeekKey } from "./email";

export interface RankEmailResult {
  weekKey: string;
  topStrength: number;
  topViews: number;
  lowStrength: number;
  skipped: number;
  errors: string[];
}

export async function sendRankEmails(): Promise<RankEmailResult> {
  const weekKey = getISOWeekKey();
  const results: RankEmailResult = { weekKey, topStrength: 0, topViews: 0, lowStrength: 0, skipped: 0, errors: [] };

  const [topStrength, topViews, bottomStrength] = await Promise.all([
    storage.getLeaderboard("strength", 10),
    storage.getLeaderboard("searches", 10),
    storage.getBottomStrengthStudents(50),
  ]);

  for (let i = 0; i < topStrength.length; i++) {
    const s = topStrength[i];
    if (!s.email || s.profileStrength == null) continue;
    const already = await storage.hasEmailBeenSent(s.id, "top_strength", weekKey);
    if (already) { results.skipped++; continue; }
    try {
      await sendTopStrengthEmail({ toEmail: s.email, studentName: s.name, studentId: s.id, rank: i + 1, score: s.profileStrength });
      await storage.recordEmailSent(s.id, "top_strength", weekKey);
      results.topStrength++;
    } catch (e: any) { results.errors.push(`top_strength:${s.id}: ${e.message}`); }
  }

  for (let i = 0; i < topViews.length; i++) {
    const s = topViews[i];
    if (!s.email) continue;
    const already = await storage.hasEmailBeenSent(s.id, "top_views", weekKey);
    if (already) { results.skipped++; continue; }
    try {
      await sendTopViewsEmail({ toEmail: s.email, studentName: s.name, studentId: s.id, rank: i + 1, viewCount: s.searchCount });
      await storage.recordEmailSent(s.id, "top_views", weekKey);
      results.topViews++;
    } catch (e: any) { results.errors.push(`top_views:${s.id}: ${e.message}`); }
  }

  const topStrengthIds = new Set(topStrength.map(s => s.id));
  for (const s of bottomStrength) {
    if (!s.email || s.profileStrength == null) continue;
    if (topStrengthIds.has(s.id)) continue;
    if (s.profileStrength > 45) continue;
    const already = await storage.hasEmailBeenSent(s.id, "low_strength", weekKey);
    if (already) { results.skipped++; continue; }
    try {
      await sendLowStrengthEmail({ toEmail: s.email, studentName: s.name, studentId: s.id, score: s.profileStrength });
      await storage.recordEmailSent(s.id, "low_strength", weekKey);
      results.lowStrength++;
    } catch (e: any) { results.errors.push(`low_strength:${s.id}: ${e.message}`); }
  }

  console.log(`[RankEmails] week=${weekKey} topStrength=${results.topStrength} topViews=${results.topViews} lowStrength=${results.lowStrength} skipped=${results.skipped} errors=${results.errors.length}`);
  return results;
}
