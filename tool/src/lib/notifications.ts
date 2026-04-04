import nodemailer from "nodemailer";

export interface NotificationPayload {
  type: "phase_complete" | "review_needed" | "phase_failed";
  engagementId: string;
  clientName: string;
  phaseNumber: number;
  phaseLabel: string;
  message: string;
}

const STATUS_EMOJI: Record<NotificationPayload["type"], string> = {
  phase_complete: ":white_check_mark:",
  review_needed: ":eyes:",
  phase_failed: ":x:",
};

const STATUS_LABEL: Record<NotificationPayload["type"], string> = {
  phase_complete: "Phase Complete",
  review_needed: "Review Needed",
  phase_failed: "Phase Failed",
};

async function sendSlackNotification(payload: NotificationPayload): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const engagementUrl = `${appUrl}/engagements/${payload.engagementId}`;
  const emoji = STATUS_EMOJI[payload.type];
  const label = STATUS_LABEL[payload.type];

  const body = {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${emoji} ${label}: ${payload.clientName}`,
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Engagement:*\n${payload.clientName}`,
          },
          {
            type: "mrkdwn",
            text: `*Phase:*\nPhase ${payload.phaseNumber} — ${payload.phaseLabel}`,
          },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: payload.message,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Open Engagement",
              emoji: true,
            },
            url: engagementUrl,
          },
        ],
      },
    ],
  };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Slack notification failed: ${response.status} ${response.statusText}`);
  }
}

function buildEmailHtml(payload: NotificationPayload): string {
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const engagementUrl = `${appUrl}/engagements/${payload.engagementId}`;
  const label = STATUS_LABEL[payload.type];

  const headerColor =
    payload.type === "phase_failed"
      ? "#dc2626"
      : payload.type === "review_needed"
        ? "#d97706"
        : "#16a34a";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${label}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:${headerColor};padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;">${label}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom:16px;">
                    <strong>Engagement:</strong> ${payload.clientName}
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:16px;">
                    <strong>Phase:</strong> Phase ${payload.phaseNumber} — ${payload.phaseLabel}
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:24px;color:#374151;">
                    ${payload.message}
                  </td>
                </tr>
                <tr>
                  <td>
                    <a href="${engagementUrl}"
                       style="display:inline-block;background:${headerColor};color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">
                      Open Engagement
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;background:#f9fafb;color:#6b7280;font-size:12px;text-align:center;">
              Presales Tool — automated notification
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendEmailNotification(payload: NotificationPayload): Promise<void> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_TO } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_TO) return;

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT ? parseInt(SMTP_PORT, 10) : 587,
    secure: SMTP_PORT === "465",
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  const label = STATUS_LABEL[payload.type];
  const subject = `[Presales] ${label}: ${payload.clientName} — Phase ${payload.phaseNumber}`;

  await transporter.sendMail({
    from: SMTP_FROM ?? SMTP_USER,
    to: SMTP_TO,
    subject,
    html: buildEmailHtml(payload),
    text: `${label}\n\nEngagement: ${payload.clientName}\nPhase: Phase ${payload.phaseNumber} — ${payload.phaseLabel}\n\n${payload.message}`,
  });
}

export async function sendNotification(payload: NotificationPayload): Promise<void> {
  await Promise.allSettled([
    sendSlackNotification(payload),
    sendEmailNotification(payload),
  ]);
}

// ---------------------------------------------------------------------------
// Helpers that require only engagementId + phaseNumber — fetch names from DB
// ---------------------------------------------------------------------------

async function buildPayload(
  type: NotificationPayload["type"],
  engagementId: string,
  phaseNumber: number,
  message: string
): Promise<NotificationPayload> {
  // Lazy import to avoid circular deps and keep notifications.ts usable outside Next.js
  const { prisma } = await import("@/lib/db");

  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    select: { clientName: true },
  });

  return {
    type,
    engagementId,
    clientName: engagement?.clientName ?? engagementId,
    phaseNumber,
    phaseLabel: `Phase ${phaseNumber}`,
    message,
  };
}

export async function notifyPhaseComplete(
  engagementId: string,
  phaseNumber: number
): Promise<void> {
  const payload = await buildPayload(
    "phase_complete",
    engagementId,
    phaseNumber,
    `Phase ${phaseNumber} completed successfully and is ready for review.`
  );
  await sendNotification(payload);
}

export async function notifyReviewNeeded(
  engagementId: string,
  phaseNumber: number
): Promise<void> {
  const payload = await buildPayload(
    "review_needed",
    engagementId,
    phaseNumber,
    `Phase ${phaseNumber} output is ready and requires your review before proceeding.`
  );
  await sendNotification(payload);
}
