import { NextRequest } from "next/server"
import crypto from "crypto"
import dbConnect from "@/lib/db"
import User from "@/lib/models/User"
import PasswordReset from "@/lib/models/PasswordReset"
import { Resend } from "resend"
import { forgotPasswordSchema } from "@/schemas/auth"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = forgotPasswordSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: "Invalid email" }, { status: 400 })
  }

  await dbConnect()

  // Always return success — no account enumeration (D-08)
  const user = await User.findOne({ email: parsed.data.email })
  if (user) {
    const token = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour (D-07)

    await PasswordReset.create({ email: parsed.data.email, token, expiresAt, used: false })

    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`

    try {
      await resend.emails.send({
        from: "TradeJournal <onboarding@resend.dev>",
        to: [parsed.data.email],
        subject: "Reset your password",
        html: `
          <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto;">
            <h2>Reset your password</h2>
            <p>Click the link below to reset your password. This link expires in 1 hour.</p>
            <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #00ff88; color: #0f0f0f; text-decoration: none; border-radius: 8px; font-weight: bold;">Reset Password</a>
            <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
          </div>
        `,
      })
    } catch (e) {
      console.error("Failed to send reset email:", e)
    }
  }

  // Same response regardless of whether user exists (D-08)
  return Response.json({
    message: "If that email exists, you'll receive a reset link.",
  })
}
