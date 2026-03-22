import mongoose, { Schema, Document } from "mongoose"

export interface IUser extends Document {
  email: string
  name: string
  image?: string
  passwordHash?: string
  provider: "credentials" | "google"
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    name: { type: String, required: true },
    image: { type: String },
    passwordHash: { type: String },
    provider: { type: String, enum: ["credentials", "google"], required: true },
  },
  { timestamps: true }
)

export default mongoose.models.User || mongoose.model<IUser>("User", UserSchema)
