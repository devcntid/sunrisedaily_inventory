import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getUserByEmail } from "@/lib/queries/auth";
import { signToken, COOKIE_NAME, getSecondsToNextMidnight } from "@/lib/auth";
import { cookies } from "next/headers";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        try {
          const dbUser = await getUserByEmail(user.email.toLowerCase().trim());
          if (dbUser) {
            const token = signToken({
              userId: dbUser.id,
              email: dbUser.email,
              role: dbUser.role as any,
              outletId: dbUser.outlet_id ?? null,
              name: dbUser.name,
            });

            const cookieStore = await cookies();
            cookieStore.set(COOKIE_NAME, token, {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "lax",
              maxAge: getSecondsToNextMidnight(),
              path: "/",
            });
            return true;
          } else {
            return "/login?error=Email tidak terdaftar";
          }
        } catch (error) {
          console.error("Error during Google sign in:", error);
          return "/login?error=Terjadi kesalahan pada server";
        }
      }
      return false;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login", // Redirect back to login on error
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
