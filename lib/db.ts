import mongoose from "mongoose"

const MONGODB_URI = process.env.MONGODB_URI!

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI environment variable is not defined")
}

async function dbConnect() {
  await mongoose.connect(MONGODB_URI)
  return mongoose
}

export default dbConnect
