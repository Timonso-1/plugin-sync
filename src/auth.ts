import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import GitHub from "next-auth/providers/github";
import { splitList } from "@/lib/util";

const allowedUsers = new Set(splitList(process.env.ALLOWED_USERS));

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub, Discord],
  trustHost: true,
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    // Nur explizit freigegebene Accounts, Format provider:accountId
    signIn({ account }) {
      if (!account) return false;
      return allowedUsers.has(`${account.provider}:${account.providerAccountId}`);
    },
  },
});
