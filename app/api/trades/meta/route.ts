import { NextRequest, NextResponse } from "next/server"
import { Types } from "mongoose"
import { auth } from "@/lib/auth"
import dbConnect from "@/lib/db"
import Trade from "@/lib/models/Trade"

export async function GET(req: NextRequest) {
  const session = await auth()
  const userId = session!.user!.id

  await dbConnect()

  const [strategies, tagsResult] = await Promise.all([
    Trade.distinct("strategy", { userId, strategy: { $ne: "" } }),
    Trade.aggregate([
      { $match: { userId: new Types.ObjectId(userId) } },
      { $unwind: "$tags" },
      { $group: { _id: "$tags" } },
      { $project: { _id: 0, tag: "$_id" } },
    ]),
  ])

  const tags = tagsResult.map((r: { tag: string }) => r.tag)

  return NextResponse.json({ data: { strategies, tags } })
}
