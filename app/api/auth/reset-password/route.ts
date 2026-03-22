import { NextRequest } from "next/server"
import bcryptjs from "bcryptjs"
import dbConnect from "@/lib/db"
import User from "@/lib/models/User"
import PasswordReset from "@/lib/models/PasswordReset"
import { resetPasswordSchema } from "@/schemas/auth"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { token, ...passwordData } = body

  if (!token) {
    return Response.json({ error: "Token is required" }, { status: 400 })
  }

  const parsed = resetPasswordSchema.safeParse(passwordData)
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    )
  }

  await dbConnect()

  const resetRecord = await PasswordReset.findOne({
    token,
    used: false,
    expiresAt: { $gt: new Date() },
  })

  if (!resetRecord) {
    return Response.json(
      { error: "Invalid or expired reset link" },
      { status: 400 }
    )
  }

  const user = await User.findOne({ email: resetRecord.email })
  if (!user) {
    return Response.json(
      { error: "Invalid or expired reset link" },
      { status: 400 }
    )
  }

  const passwordHash = await bcryptjs.hash(parsed.data.password, 12)
  user.passwordHash = passwordHash
  await user.save()

  resetRecord.used = true
  await resetRecord.save()

  return Response.json({ message: "Password reset successfully" })
}
