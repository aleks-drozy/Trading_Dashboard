"use client"

import { useState } from "react"
import Link from "next/link"
import { CheckCircle } from "lucide-react"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { forgotPasswordSchema } from "@/schemas/auth"

type FormState = "form" | "success"

interface FieldErrors {
  email?: string
}

export function ForgotPasswordForm() {
  const [formState, setFormState] = useState<FormState>("form")
  const [email, setEmail] = useState("")
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)

  const validateField = (value: string) => {
    const result = forgotPasswordSchema.safeParse({ email: value })
    if (!result.success) {
      const fieldError = result.error.issues.find((e) => e.path[0] === "email")
      setFieldErrors({ email: fieldError ? fieldError.message : undefined })
    } else {
      setFieldErrors({ email: undefined })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const result = forgotPasswordSchema.safeParse({ email })
    if (!result.success) {
      const errors: FieldErrors = {}
      result.error.issues.forEach((err) => {
        if (err.path[0] === "email" && !errors.email) {
          errors.email = err.message
        }
      })
      setFieldErrors(errors)
      return
    }

    setLoading(true)
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      setFormState("success")
    } finally {
      setLoading(false)
    }
  }

  if (formState === "success") {
    return (
      <div className="flex flex-col gap-4 items-center text-center">
        <CheckCircle size={32} className="text-[#00ff88]" />
        <h1 className="text-2xl font-bold text-[#e5e7eb]">Check your email</h1>
        <p className="text-base text-[#6b7280]">
          If that email exists, you&apos;ll receive a reset link shortly. Check your spam folder if
          you don&apos;t see it.
        </p>
        <Link href="/login" className="w-full">
          <Button variant="secondary" type="button" className="w-full">
            Back to sign in
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-[#e5e7eb]">Reset your password</h1>
        <p className="text-base text-[#6b7280] mt-1">
          Enter your email and we&apos;ll send a reset link.
        </p>
      </div>

      <Input
        id="forgot-email"
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onBlur={() => validateField(email)}
        error={fieldErrors.email}
        autoComplete="email"
      />

      <Button type="submit" variant="primary" loading={loading}>
        Send reset link
      </Button>

      <p className="text-sm text-[#6b7280] text-center">
        <Link href="/login" className="text-[#6b7280] hover:text-[#00ff88]">
          Back to sign in
        </Link>
      </p>
    </form>
  )
}
