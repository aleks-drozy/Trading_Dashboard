import { NextRequest, NextResponse } from "next/server"
import bcryptjs from "bcryptjs"
import dbConnect from "@/lib/db"
import User from "@/lib/models/User"
import { registerSchema } from "@/schemas/auth"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = registerSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    )
  }

  await dbConnect()

  const existingUser = await User.findOne({ email: parsed.data.email })
  if (existingUser) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 }
    )
  }

  const passwordHash = await bcryptjs.hash(parsed.data.password, 12)
  await User.create({
    email: parsed.data.email,
    name: parsed.data.name,
    passwordHash,
    provider: "credentials",
  })

  return NextResponse.json({ message: "Account created" }, { status: 201 })
}
