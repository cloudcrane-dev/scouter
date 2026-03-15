import { Resend } from "resend";

let connectionSettings: any;

async function getCredentials(): Promise<{ apiKey: string; fromEmail: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? "depl " + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) throw new Error("X-Replit-Token not found for repl/depl");

  connectionSettings = await fetch(
    "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=resend",
    { headers: { Accept: "application/json", "X-Replit-Token": xReplitToken } }
  )
    .then((r) => r.json())
    .then((d) => d.items?.[0]);

  if (!connectionSettings?.settings?.api_key) throw new Error("Resend not connected");

  const fromEmail = connectionSettings.settings.from_email || "SkillSniffer <noreply@skillsniffer.in>";
  return { apiKey: connectionSettings.settings.api_key, fromEmail };
}

export function getISOWeekKey(): string {
  const now = new Date();
  const jan4 = new Date(now.getFullYear(), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const diff = now.getTime() - startOfWeek1.getTime();
  const week = Math.floor(diff / (7 * 24 * 3600 * 1000)) + 1;
  return `${now.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function baseHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Courier New',Courier,monospace;color:#e5e5e5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:500px;background:#111111;border:1px solid rgba(255,255,255,0.08);">
          ${body}
          <tr>
            <td style="padding:14px 28px;border-top:1px solid rgba(255,255,255,0.05);">
              <p style="margin:0;font-size:10px;color:#444;line-height:1.5;">
                SkillSniffer · IIT Jodhpur student discovery platform · skillsniffer.in
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export async function sendInsightNotification(opts: {
  toEmail: string;
  studentName: string;
  studentId: number;
}): Promise<void> {
  const { apiKey, fromEmail } = await getCredentials();
  const resend = new Resend(apiKey);
  const appUrl = process.env.APP_URL || "https://skillsniffer.in";
  const profileUrl = `${appUrl}/student/${opts.studentId}`;
  const loginUrl = `${appUrl}/auth/google`;

  const html = baseHtml("New insight on your SkillSniffer profile", `
    <tr>
      <td style="padding:24px 28px 16px;">
        <p style="margin:0;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#888;">skillsniffer.in</p>
        <h1 style="margin:10px 0 0;font-size:17px;font-weight:700;letter-spacing:-0.02em;color:#f5f5f5;">
          someone left an insight about you
        </h1>
      </td>
    </tr>
    <tr>
      <td style="padding:0 28px 20px;">
        <p style="margin:0;font-size:13px;line-height:1.65;color:#aaa;">Hi ${opts.studentName.split(" ")[0]},</p>
        <p style="margin:12px 0 0;font-size:13px;line-height:1.65;color:#aaa;">
          A peer just submitted an anonymous insight on your SkillSniffer profile.
          Insights are kept private — only you can see them when you're logged in.
        </p>
        <p style="margin:12px 0 0;font-size:13px;line-height:1.65;color:#aaa;">
          Log in with your <strong style="color:#e5e5e5;">@iitj.ac.in</strong> Google account to read what was written.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:0 28px 28px;">
        <a href="${loginUrl}" style="display:inline-block;padding:10px 22px;background:#f5f5f5;color:#111;font-size:11px;font-family:'Courier New',Courier,monospace;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;font-weight:700;">
          login &amp; view insight →
        </a>
        <p style="margin:16px 0 0;font-size:11px;color:#555;">
          View your public profile: <a href="${profileUrl}" style="color:#888;text-decoration:underline;">${profileUrl}</a>
        </p>
      </td>
    </tr>
  `);

  await resend.emails.send({
    from: fromEmail,
    to: opts.toEmail,
    subject: `Someone left an insight on your SkillSniffer profile`,
    html,
  });
}

export async function sendPersonalityRatingNotification(opts: {
  toEmail: string;
  studentName: string;
  studentId: number;
}): Promise<void> {
  const { apiKey, fromEmail } = await getCredentials();
  const resend = new Resend(apiKey);
  const appUrl = process.env.APP_URL || "https://skillsniffer.in";
  const profileUrl = `${appUrl}/student/${opts.studentId}`;
  const loginUrl = `${appUrl}/auth/google`;
  const firstName = opts.studentName.split(" ")[0];

  const html = baseHtml("Someone just rated your vibe ✨", `
    <tr>
      <td style="padding:24px 28px 16px;">
        <p style="margin:0;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#888;">skillsniffer.in</p>
        <h1 style="margin:10px 0 0;font-size:17px;font-weight:700;letter-spacing:-0.02em;color:#f5f5f5;">
          someone just rated your vibe ✨
        </h1>
      </td>
    </tr>
    <tr>
      <td style="padding:0 28px 20px;">
        <p style="margin:0;font-size:13px;line-height:1.65;color:#aaa;">Hey ${firstName},</p>
        <p style="margin:12px 0 0;font-size:13px;line-height:1.65;color:#aaa;">
          A batchmate just rated your personality traits on SkillSniffer.
          Your vibe scores just got updated — log in to see how people perceive you.
        </p>
        <p style="margin:12px 0 0;font-size:13px;line-height:1.65;color:#aaa;">
          Traits like <strong style="color:#e5e5e5;">Looks, Brains, Fitness, Funny, Charm</strong> and <strong style="color:#e5e5e5;">Romantic</strong>
          — all scored anonymously by your peers. 👀
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:0 28px 28px;">
        <a href="${loginUrl}" style="display:inline-block;padding:10px 22px;background:#f5f5f5;color:#111;font-size:11px;font-family:'Courier New',Courier,monospace;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;font-weight:700;">
          see your ratings →
        </a>
        <p style="margin:16px 0 0;font-size:11px;color:#555;">
          View your profile: <a href="${profileUrl}" style="color:#888;text-decoration:underline;">${profileUrl}</a>
        </p>
      </td>
    </tr>
  `);

  await resend.emails.send({
    from: fromEmail,
    to: opts.toEmail,
    subject: `Someone just rated your vibe on SkillSniffer ✨`,
    html,
  });
}

export function getDayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export async function sendTopStrengthEmail(opts: {
  toEmail: string;
  studentName: string;
  studentId: number;
  rank: number;
  score: number;
}): Promise<void> {
  const { apiKey, fromEmail } = await getCredentials();
  const resend = new Resend(apiKey);
  const appUrl = process.env.APP_URL || "https://skillsniffer.in";
  const profileUrl = `${appUrl}/student/${opts.studentId}`;
  const firstName = opts.studentName.split(" ")[0];

  const rankLabel = opts.rank === 1 ? "#1 🥇" : opts.rank === 2 ? "#2 🥈" : opts.rank === 3 ? "#3 🥉" : `#${opts.rank}`;

  const html = baseHtml("You're in the Top 10 on SkillSniffer 🔥", `
    <tr>
      <td style="padding:24px 28px 8px;">
        <p style="margin:0;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#888;">skillsniffer.in</p>
        <h1 style="margin:10px 0 0;font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#f5f5f5;">
          you're literally ${rankLabel} 🔥
        </h1>
      </td>
    </tr>
    <tr>
      <td style="padding:12px 28px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);">
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0;font-size:11px;color:#666;font-family:'Courier New',Courier,monospace;text-transform:uppercase;letter-spacing:0.1em;">profile strength</p>
              <p style="margin:4px 0 0;font-size:32px;font-weight:700;color:#f5f5f5;letter-spacing:-0.03em;">${opts.score}<span style="font-size:16px;color:#666;">/100</span></p>
              <p style="margin:4px 0 0;font-size:11px;color:#888;">top ${opts.rank} out of all IITJ students on SkillSniffer</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 28px 8px;">
        <p style="margin:0;font-size:13px;line-height:1.7;color:#aaa;">
          Hey ${firstName}, no cap — you're one of the most well-built profiles on SkillSniffer right now. 
          Recruiters, batchmates, and seniors are scanning profiles daily. 
          Being top 10 on strength means your digital footprint is actually doing the work for you. 🙌
        </p>
        <p style="margin:12px 0 0;font-size:13px;line-height:1.7;color:#aaa;">
          Keep your GitHub active, LinkedIn updated, and social links fresh — that's what keeps you up here.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 28px 28px;">
        <a href="${profileUrl}" style="display:inline-block;padding:10px 22px;background:#f5f5f5;color:#111;font-size:11px;font-family:'Courier New',Courier,monospace;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;font-weight:700;">
          see your profile →
        </a>
      </td>
    </tr>
  `);

  await resend.emails.send({
    from: fromEmail,
    to: opts.toEmail,
    subject: `you're ${rankLabel} on SkillSniffer strength — keep it up 🔥`,
    html,
  });
}

export async function sendTopViewsEmail(opts: {
  toEmail: string;
  studentName: string;
  studentId: number;
  rank: number;
  viewCount: number;
}): Promise<void> {
  const { apiKey, fromEmail } = await getCredentials();
  const resend = new Resend(apiKey);
  const appUrl = process.env.APP_URL || "https://skillsniffer.in";
  const profileUrl = `${appUrl}/student/${opts.studentId}`;
  const loginUrl = `${appUrl}/auth/google`;
  const firstName = opts.studentName.split(" ")[0];

  const html = baseHtml("People are looking you up 👀", `
    <tr>
      <td style="padding:24px 28px 8px;">
        <p style="margin:0;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#888;">skillsniffer.in</p>
        <h1 style="margin:10px 0 0;font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#f5f5f5;">
          people are looking you up 👀
        </h1>
      </td>
    </tr>
    <tr>
      <td style="padding:12px 28px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);">
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0;font-size:11px;color:#666;font-family:'Courier New',Courier,monospace;text-transform:uppercase;letter-spacing:0.1em;">profile views</p>
              <p style="margin:4px 0 0;font-size:32px;font-weight:700;color:#f5f5f5;letter-spacing:-0.03em;">${opts.viewCount}</p>
              <p style="margin:4px 0 0;font-size:11px;color:#888;">rank #${opts.rank} on the views leaderboard</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 28px 8px;">
        <p style="margin:0;font-size:13px;line-height:1.7;color:#aaa;">
          ${firstName}, your profile is being scouted. fr. You're #${opts.rank} on SkillSniffer by views — 
          that means batchmates, seniors, and potentially recruiters are actively running your name.
        </p>
        <p style="margin:12px 0 0;font-size:13px;line-height:1.7;color:#aaa;">
          Make sure what they see is actually good. Log in and boost your profile strength — 
          add your GitHub, LinkedIn, LeetCode — so the AI gives you a proper analysis instead of just guessing. 
          Don't let the attention go to waste. 💀
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 28px 28px;">
        <a href="${loginUrl}" style="display:inline-block;padding:10px 22px;background:#f5f5f5;color:#111;font-size:11px;font-family:'Courier New',Courier,monospace;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;font-weight:700;">
          claim &amp; upgrade profile →
        </a>
        <p style="margin:14px 0 0;font-size:11px;color:#555;">
          View your profile: <a href="${profileUrl}" style="color:#888;text-decoration:underline;">${profileUrl}</a>
        </p>
      </td>
    </tr>
  `);

  await resend.emails.send({
    from: fromEmail,
    to: opts.toEmail,
    subject: `${opts.viewCount} people looked you up on SkillSniffer 👀 — you're #${opts.rank}`,
    html,
  });
}

export async function sendLowStrengthEmail(opts: {
  toEmail: string;
  studentName: string;
  studentId: number;
  score: number;
}): Promise<void> {
  const { apiKey, fromEmail } = await getCredentials();
  const resend = new Resend(apiKey);
  const appUrl = process.env.APP_URL || "https://skillsniffer.in";
  const profileUrl = `${appUrl}/student/${opts.studentId}`;
  const loginUrl = `${appUrl}/auth/google`;
  const firstName = opts.studentName.split(" ")[0];

  const tier = opts.score <= 20
    ? { label: "ghost mode 👻", vibe: "barely any digital presence" }
    : opts.score <= 35
    ? { label: "needs work 😬", vibe: "some presence but lots of gaps" }
    : { label: "mid tier 🫤", vibe: "decent but easily improvable" };

  const html = baseHtml("Your SkillSniffer score needs attention", `
    <tr>
      <td style="padding:24px 28px 8px;">
        <p style="margin:0;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#888;">skillsniffer.in</p>
        <h1 style="margin:10px 0 0;font-size:18px;font-weight:700;letter-spacing:-0.02em;color:#f5f5f5;">
          your profile score is ${tier.label}
        </h1>
      </td>
    </tr>
    <tr>
      <td style="padding:12px 28px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,100,100,0.15);">
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0;font-size:11px;color:#666;font-family:'Courier New',Courier,monospace;text-transform:uppercase;letter-spacing:0.1em;">your profile strength</p>
              <p style="margin:4px 0 0;font-size:32px;font-weight:700;color:#f5f5f5;letter-spacing:-0.03em;">${opts.score}<span style="font-size:16px;color:#666;">/100</span></p>
              <p style="margin:4px 0 0;font-size:11px;color:#777;">${tier.vibe}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 28px 4px;">
        <p style="margin:0;font-size:13px;line-height:1.7;color:#aaa;">
          Okay ${firstName}, real talk — your SkillSniffer profile strength is sitting at ${opts.score}/100 right now, 
          and that's lowkey a problem. When recruiters or seniors look you up, the AI literally has nothing good to say 
          because there's not enough out there about you. That's fixable tho. Here's what actually moves the needle:
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 28px 4px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          ${[
            ["🔗", "Add your social links", "GitHub, LinkedIn, LeetCode, Behance — whatever's relevant. This lets the AI scan your real activity and gives you a proper score bump. Log in → Profile → Social Links."],
            ["✅", "Claim your profile", "Sign in with your @iitj.ac.in Google account to officially own your profile. Unclaimed profiles get a completeness score of basically zero."],
            ["💻", "Get active on GitHub", "Even a few consistent commits per week signals that you're doing things. Create repos for your projects, push your code, write READMEs."],
            ["🧠", "Nail your LinkedIn", "Fill in: Education, Skills, Projects, Experience. A bare LinkedIn is a massive red flag for anyone doing due diligence on you."],
            ["🏆", "Add LeetCode / competitive programming", "Even 50 solved problems on LeetCode or a Codeforces rating goes a long way for CS/EE folks."],
          ].map(([icon, title, desc]) => `
          <tr>
            <td style="padding:6px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);">
                <tr>
                  <td style="padding:12px 16px;width:32px;vertical-align:top;font-size:16px;">${icon}</td>
                  <td style="padding:12px 12px 12px 0;">
                    <p style="margin:0;font-size:12px;font-weight:700;color:#e5e5e5;">${title}</p>
                    <p style="margin:4px 0 0;font-size:11px;color:#777;line-height:1.5;">${desc}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`).join("")}
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 28px 8px;">
        <p style="margin:0;font-size:13px;line-height:1.7;color:#aaa;">
          Your strength score is based on <strong style="color:#e5e5e5;">online presence</strong>, 
          <strong style="color:#e5e5e5;">coding activity</strong>, 
          <strong style="color:#e5e5e5;">real-world experience</strong>, and 
          <strong style="color:#e5e5e5;">profile completeness</strong>. 
          Each one is scored 1–10 by the AI. Hit the leaderboard and you'll actually show up when people search. 📈
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 28px 28px;">
        <a href="${loginUrl}" style="display:inline-block;padding:10px 22px;background:#f5f5f5;color:#111;font-size:11px;font-family:'Courier New',Courier,monospace;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;font-weight:700;">
          fix my profile now →
        </a>
        <p style="margin:14px 0 0;font-size:11px;color:#555;">
          Your profile: <a href="${profileUrl}" style="color:#888;text-decoration:underline;">${profileUrl}</a>
        </p>
      </td>
    </tr>
  `);

  await resend.emails.send({
    from: fromEmail,
    to: opts.toEmail,
    subject: `your SkillSniffer score is ${opts.score}/100 — here's how to fix it`,
    html,
  });
}
