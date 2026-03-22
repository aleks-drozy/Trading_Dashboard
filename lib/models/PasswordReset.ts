import mongoose, { Schema, Document } from "mongoose"

export interface IPasswordReset extends Document {
  email: string
  token: string
  expiresAt: Date
  used: boolean
}

const PasswordResetSchema = new Schema<IPasswordReset>({
  email: { type: String, required: true, index: true },
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false },
})

// TTL index: MongoDB auto-deletes expired documents after expiresAt
PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export default mongoose.models.PasswordReset ||
  mongoose.model<IPasswordReset>("PasswordReset", PasswordResetSchema)
