import type { NextAuthOptions, User } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { isAdminEmail } from "@/lib/admin-emails";
import { prisma } from "@/lib/prisma";
import { hitRateLimit, resetRateLimit } from "@/lib/rate-limit";

/** Shown on the login form when too many attempts were made. */
export const TOO_MANY_ATTEMPTS = "TooManyAttempts";

async function ensureChannel(user: User) {
  if (!user.id) return;

  const existing = await prisma.channel.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (existing) return;

  const displayName =
    user.name?.trim() || user.email?.split("@")[0] || "Creator";
  const baseHandle =
    displayName
      .toLocaleLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 20) || "creator";

  await prisma.channel.create({
    data: {
      userId: user.id,
      name: displayName,
      handle: `${baseHandle}-${user.id.slice(-6)}`,
      avatarUrl: user.image,
    },
  });
}

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "Email and password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials, request) {
      const email = credentials?.email?.trim().toLocaleLowerCase();
      const password = credentials?.password;
      if (!email || !password) return null;

      // Limit guesses per account and per IP address. Throwing makes
      // NextAuth report this message to the login form.
      const forwarded = request?.headers?.["x-forwarded-for"];
      const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
        ?.split(",")[0]
        ?.trim();
      if (
        hitRateLimit("login", email) > 0 ||
        (ip && hitRateLimit("loginIp", ip) > 0)
      ) {
        throw new Error(TOO_MANY_ATTEMPTS);
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user?.passwordHash) return null;

      const validPassword = await compare(password, user.passwordHash);
      if (!validPassword) return null;
      resetRateLimit("login", email);

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      };
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) session.user.id = token.id;
      // Checked on every request, so editing ADMIN_EMAILS applies right away.
      if (session.user) session.user.isAdmin = isAdminEmail(session.user.email);
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      await ensureChannel(user);
    },
  },
};
