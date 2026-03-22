import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import { loginSchema } from "@/schemas/auth"
import dbConnect from "@/lib/db"
import UserModel from "@/lib/models/User"
import bcryptjs from "bcryptjs"

// next-auth@5 beta.30 has a type resolution issue in Next.js builds.
// The function is callable at runtime; this cast restores type safety.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createNextAuth = NextAuth as any

export const { auth, handlers, signIn, signOut } = createNextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      credentials: {
        email: { type: "email" },
        password: { type: "password" },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      authorize: async (credentials: any) => {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        await dbConnect()
        const user = await UserModel.findOne({ email: parsed.data.email })
        if (!user || !user.passwordHash) return null

        const valid = await bcryptjs.compare(parsed.data.password, user.passwordHash)
        if (!valid) return null

        return { id: user._id.toString(), email: user.email, name: user.name }
      },
    }),
  ],
  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async signIn({ user, account }: { user: any; account: any }) {
      if (account?.provider === "google") {
        await dbConnect()
        const existingUser = await UserModel.findOne({ email: user.email })
        if (!existingUser) {
          const newUser = await UserModel.create({
            email: user.email,
            name: user.name,
            image: user.image,
            provider: "google",
          })
          user.id = newUser._id.toString()
        } else {
          user.id = existingUser._id.toString()
        }
      }
      return true
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jwt({ token, user }: { token: any; user?: any }) {
      if (user) token.userId = user.id
      return token
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    session({ session, token }: { session: any; token: any }) {
      if (token.userId) session.user.id = token.userId as string
      return session
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: { strategy: "jwt" },
})
