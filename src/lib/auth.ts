import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { JWT } from "next-auth/jwt"
import { Session } from "next-auth"

interface ExtendedToken extends JWT {
  accessToken?: string
  refreshToken?: string
  accessTokenExpires?: number
  user?: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
  error?: string
}

interface ExtendedSession extends Session {
  accessToken?: string
  error?: string
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  debug: true,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope: [
            "https://www.googleapis.com/auth/calendar",
            "https://www.googleapis.com/auth/calendar.events",
            "openid",
            "email",
            "profile",
          ].join(" ")
        },
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, account, user }): Promise<ExtendedToken> {
      // Initial sign in
      if (account && user) {
        console.log('Initial sign in, setting token:', { account, user })
        return {
          accessToken: account.access_token,
          accessTokenExpires: Date.now() + (account.expires_in as number) * 1000,
          refreshToken: account.refresh_token,
          user,
        }
      }

      // Return previous token if the access token has not expired yet
      if (Date.now() < (token.accessTokenExpires as number)) {
        console.log('Token still valid')
        return token
      }

      console.log('Token expired, trying to refresh')
      return {
        ...token,
        error: "RefreshAccessTokenError",
      }
    },
    async session({ session, token }): Promise<ExtendedSession> {
      if (token?.error) {
        session.error = token.error
      }

      if (token?.accessToken) {
        session.accessToken = token.accessToken
      }

      if (token?.user) {
        session.user = {
          name: token.user.name,
          email: token.user.email,
          image: token.user.image,
        }
      }

      return session
    },
  },
  events: {
    async signIn({ user, account, profile }) {
      console.log('Sign in event:', { user, account, profile })
    },
    async signOut({ session, token }) {
      console.log('Sign out event:', { session, token })
    },
  },
}