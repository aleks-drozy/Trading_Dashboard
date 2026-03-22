"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CheckCircle, AlertTriangle } from "lucide-react"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { resetPasswordSchema } from "@/schemas/auth"

type FormState = "form" | "success" | "invalid"

interface FieldErrors {
  password?: string
  confirmPassword?: string
}

interface ResetPasswordFormProps {
  token: string
  initialState?: FormState
}

export function ResetPasswordForm({ token, initialState = "form" }: ResetPasswordFormProps) {
  const router = useRouter()
  const [formState, setFormState] = useState<FormState>(initialState)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)

  const validateField = (name: "password" | "confirmPassword", value: string) => {
    const data = { password, confirmPassword, [name]: value }
    const result = resetPasswordSchema.safeParse(data)
    if (!result.success) {
      const fieldError = result.error.issues.find((e) => e.path[0] === name)
      setFieldErrors((prev) => ({
        ...prev,
        [name]: fieldError ? fieldError.message : undefined,
      }))
    } else {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const result = resetPasswordSchema.safeParse({ password, confirmPassword })
    if (!result.success) {
      const errors: FieldErrors = {}
      result.error.issues.forEach((err) => {
        const field = err.path[0] as "password" | "confirmPassword"
        if (!errors[field]) errors[field] = err.message
      })
      setFieldErrors(errors)
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      })

      if (res.ok) {
        setFormState("success")
      } else {
        setFormState("invalid")
      }
    } catch {
      setFormState("invalid")
    } finally {
      setLoading(false)
    }
  }

  if (formState === "success") {
    return (
      <div className="flex flex-col gap-4 items-center text-center">
        <CheckCircle size={32} className="text-[#00ff88]" />
        <h1 className="text-2xl font-bold text-[#e5e7eb]">Password reset</h1>
        <p className="text-base text-[#6b7280]">
          Your password has been updated. You can now sign in.
        </p>
        <Button
          type="button"
          variant="primary"
          onClick={() => router.push("/login")}
          className="w-full"
        >
          Sign in
        </Button>
      </div>
    )
  }

  if (formState === "invalid") {
    return (
      <div className="flex flex-col gap-4 items-center text-center">
        <AlertTriangle size={32} className="text-[#ef4444]" />
        <h1 className="text-2xl font-bold text-[#e5e7eb]">Link expired</h1>
        <p className="text-base text-[#6b7280]">
          This reset link is invalid or has expired. Reset links are valid for 1 hour.
        </p>
        <Link href="/forgot-password" className="w-full">
          <Button type="button" variant="primary" className="w-full">
            Request a new link
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-[#e5e7eb]">Set new password</h1>
        <p className="text-base text-[#6b7280] mt-1">Choose a strong password for your account.</p>
      </div>

      <div className="flex flex-col gap-1">
        <Input
          id="reset-password"
          label="New password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => validateField("password", password)}
          error={fieldErrors.password}
          autoComplete="new-password"
        />
        <p className="text-sm text-[#6b7280]">
          Min 8 characters, 1 uppercase, 1 lowercase, 1 number
        </p>
      </div>

      <Input
        id="reset-confirm-password"
        label="Confirm password"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        onBlur={() => validateField("confirmPassword", confirmPassword)}
        error={fieldErrors.confirmPassword}
        autoComplete="new-password"
      />

      <Button type="submit" variant="primary" loading={loading}>
        Reset password
      </Button>
    </form>
  )
}
