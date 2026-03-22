import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { uploadToCloudinary } from "@/lib/cloudinary"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

export async function POST(req: NextRequest) {
  const session = await auth()
  const userId = session!.user!.id

  const formData = await req.formData()
  const file = formData.get("file") as File | null

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Only image files are accepted (jpg, png, gif, webp)" },
      { status: 400 }
    )
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File size must not exceed 5 MB" },
      { status: 400 }
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const folder = `trade-journal/charts/${userId}`

  try {
    const result = await uploadToCloudinary(buffer, folder)
    return NextResponse.json({ data: { url: result.secure_url } })
  } catch {
    return NextResponse.json({ error: "Image upload failed" }, { status: 500 })
  }
}
