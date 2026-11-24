import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

const identifierFor = (email: string) => `password-reset:${email}`;
const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

/**
 * Creates a one-time reset token for the email and returns it. Only a hash is
 * stored, so a leaked database can't be used to reset passwords. Any earlier
 * token for the same email stops working.
 */
export async function createResetToken(email: string) {
  const token = randomBytes(32).toString("hex");
  const identifier = identifierFor(email);
  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier } }),
    prisma.verificationToken.create({
      data: {
        identifier,
        token: hashToken(token),
        expires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    }),
  ]);
  return token;
}

/** Checks a reset token and uses it up. Returns true if it was valid. */
export async function consumeResetToken(email: string, token: string) {
  const identifier = identifierFor(email);
  const stored = await prisma.verificationToken.findFirst({
    where: { identifier },
  });
  if (!stored) return false;

  const expected = Buffer.from(stored.token, "hex");
  const actual = Buffer.from(hashToken(token), "hex");
  const matches =
    expected.length === actual.length && timingSafeEqual(expected, actual);
  if (!matches) return false;

  // Delete before checking expiry: an expired token is useless either way.
  const deleted = await prisma.verificationToken.deleteMany({
    where: { identifier, token: stored.token },
  });
  return deleted.count === 1 && stored.expires > new Date();
}
