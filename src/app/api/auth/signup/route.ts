import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimitResponse } from "@/lib/rate-limit";

type SignupInput = {
  name?: unknown;
  email?: unknown;
  password?: unknown;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function handleFromName(name: string, userId: string) {
  const normalized =
    name
      .toLocaleLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 20) || "creator";

  return `${normalized}-${userId.slice(-6)}`;
}

export async function POST(request: Request) {
  // Limit by IP when the proxy tells us one (locally there usually isn't).
  const ip = clientIp(request.headers);
  const limited = ip === "unknown" ? null : rateLimitResponse("signup", ip);
  if (limited) return limited;

  let input: SignupInput | null;
  try {
    const body: unknown = await request.json();
    input =
      typeof body === "object" && body !== null && !Array.isArray(body)
        ? (body as SignupInput)
        : null;
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  if (!input) {
    return NextResponse.json(
      { error: "Request body must be a JSON object." },
      { status: 400 },
    );
  }

  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email =
    typeof input.email === "string"
      ? input.email.trim().toLocaleLowerCase()
      : "";
  const password = typeof input.password === "string" ? input.password : "";

  if (name.length < 2 || name.length > 60) {
    return NextResponse.json(
      { error: "Name must be between 2 and 60 characters." },
      { status: 400 },
    );
  }
  if (email.length > 254 || !isValidEmail(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }
  if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    return NextResponse.json(
      {
        error:
          "Password must be at least 8 characters and no more than 72 bytes.",
      },
      { status: 400 },
    );
  }

  const passwordHash = await hash(password, 12);

  try {
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        channel: {
          create: {
            name,
            handle: handleFromName(name, randomUUID().replaceAll("-", "")),
          },
        },
      },
      select: { id: true, email: true, name: true },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "An account with that email already exists." },
        { status: 409 },
      );
    }

    console.error("Account registration failed.", error);
    return NextResponse.json(
      { error: "Unable to create the account right now." },
      { status: 500 },
    );
  }
}
