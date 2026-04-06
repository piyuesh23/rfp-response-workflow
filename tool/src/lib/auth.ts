import NextAuth, { type NextAuthOptions, getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/db";
import type { UserRole } from "@/generated/prisma/enums";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const email = user.email;
      if (!email) return false;

      const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN;
      if (allowedDomain) {
        const domain = email.split("@")[1];
        if (domain !== allowedDomain) return false;
      }

      const dbUser = await prisma.user.upsert({
        where: { email },
        update: { lastLoginAt: new Date() },
        create: {
          email,
          name: user.name ?? email.split("@")[0],
          avatarUrl: user.image ?? null,
          lastLoginAt: new Date(),
        },
      });

      // Block sign-in for blocked users
      if (dbUser.isBlocked) return false;

      return true;
    },
    async session({ session }) {
      if (session.user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: session.user.email },
          select: { id: true, role: true },
        });
        if (dbUser) {
          session.user.id = dbUser.id;
          session.user.role = dbUser.role;
        }
      }
      return session;
    },
    async jwt({ token }) {
      return token;
    },
  },
  pages: {
    signIn: "/login",
  },
};

export const handlers = NextAuth(authOptions);

/**
 * Server-side session helper — use in Server Components and Route Handlers.
 * Equivalent to NextAuth v5's `auth()`.
 */
export const auth = () => getServerSession(authOptions);

/**
 * Re-export client-side helpers for use in Client Components.
 */
export { signIn, signOut } from "next-auth/react";
