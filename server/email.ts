import { Resend } from "resend";

let connectionSettings: any;

async function getCredentials(): Promise<{ apiKey: string; fromEmail: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? "depl " + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error("X-Replit-Token not found for repl/depl");
  }

  connectionSettings = await fetch(
    "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=resend",
    {
      headers: {
        Accept: "application/json",
        "X-Replit-Token": xReplitToken,
      },
    }
  )
    .then((res) => res.json())
    .then((data) => data.items?.[0]);

  if (!connectionSettings?.settings?.api_key) {
    throw new Error("Resend not connected");
  }

  const fromEmail = connectionSettings.settings.from_email || "SkillSniffer <noreply@skillsniffer.in>";
  return { apiKey: connectionSettings.settings.api_key, fromEmail };
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

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New insight on your SkillSniffer profile</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Courier New',Courier,monospace;color:#e5e5e5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:480px;background:#111111;border:1px solid rgba(255,255,255,0.08);">

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
              <p style="margin:0;font-size:13px;line-height:1.65;color:#aaa;">
                Hi ${opts.studentName.split(" ")[0]},
              </p>
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
              <a href="${loginUrl}"
                style="display:inline-block;padding:10px 22px;background:#f5f5f5;color:#111;font-size:11px;
                       font-family:'Courier New',Courier,monospace;letter-spacing:0.1em;text-transform:uppercase;
                       text-decoration:none;font-weight:700;">
                login &amp; view insight →
              </a>
              <p style="margin:16px 0 0;font-size:11px;color:#555;">
                Or view your public profile: <a href="${profileUrl}" style="color:#888;text-decoration:underline;">${profileUrl}</a>
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:16px 28px;border-top:1px solid rgba(255,255,255,0.05);">
              <p style="margin:0;font-size:10px;color:#444;line-height:1.5;">
                You're receiving this because someone added an insight to your profile on SkillSniffer,
                a student discovery platform for IIT Jodhpur.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  await resend.emails.send({
    from: fromEmail,
    to: opts.toEmail,
    subject: `Someone left an insight on your SkillSniffer profile`,
    html,
  });
}
