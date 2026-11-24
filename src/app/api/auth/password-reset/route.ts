import { NextResponse, type NextRequest } from "next/server";
import { hash } from "bcryptjs";
import { sendEmail } from "@/lib/email";
import { consumeResetToken, createResetToken } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { clientIp, hitRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { jsonError, readJsonObject } from "@/lib/session";

function readEmail(value: unknown) {
  const email =
    typeof value === "string" ? value.trim().toLocaleLowerCase() : "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

/**
 * Step 1: { email } — emails a reset link if the account exists. The answer
 * is the same either way, so this can't be used to find out who has an account.
 */
export async function POST(request: NextRequest) {
  const body = await readJsonObject(request);
  const email = readEmail(body?.email);
  if (!email) return jsonError("Enter a valid email address.", 400);

  const ip = clientIp(request.headers);
  const limited =
    rateLimitResponse("passwordReset", `email:${email}`) ??
    (ip === "unknown" ? null : rateLimitResponse("passwordReset", `ip:${ip}`));
  if (limited) return limited;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (user) {
    const token = await createResetToken(email);
    const origin = process.env.NEXTAUTH_URL || request.nextUrl.origin;
    const link = `${origin}/reset-password?email=${encodeURIComponent(email)}&token=${token}`;
    await sendEmail({
      to: email,
      subject: "Reset your StreamBox password",
      text: `Someone asked to reset the password for your StreamBox account.\n\nChoose a new password here (the link works once, for 1 hour):\n${link}\n\nIf this wasn't you, you can ignore this email.`,
    });
  }

  return NextResponse.json({ sent: true });
}

/** Step 2: { email, token, password } — sets the new password. */
export async function PUT(request: NextRequest) {
  const body = await readJsonObject(request);
  const email = readEmail(body?.email);
  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !/^[0-9a-f]{64}$/.test(token)) {
    return jsonError("This reset link is invalid. Request a new one.", 400);
  }
  if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    return jsonError(
      "Password must be at least 8 characters and no more than 72 bytes.",
      400,
    );
  }
  // Guessing tokens is hopeless, but don't let anyone try forever.
  if (hitRateLimit("passwordReset", `confirm:${email}`) > 0) {
    return jsonError("Too many attempts. Request a new reset link later.", 429);
  }

  if (!(await consumeResetToken(email, token))) {
    return jsonError(
      "This reset link has expired or was already used. Request a new one.",
      400,
    );
  }

  await prisma.user.update({
    where: { email },
    data: { passwordHash: await hash(password, 12) },
  });
  return NextResponse.json({ reset: true });
}
