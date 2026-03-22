"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton"
import { Divider } from "@/components/ui/Divider"
import { registerSchema } from "@/schemas/auth"

interface FieldErrors {
  name?: string
  email?: string
  password?: string
}

export function RegisterForm() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState("")
  const [loading, setLoading] = useState(false)

  const validateField = (
    field: "name" | "email" | "password",
    value: string
  ) => {
    const current = { name, email, password, [field]: value }
    const result = registerSchema.safeParse(current)
    if (!result.success) {
      const fieldError = result.error.issues.find((e) => e.path[0] === field)
      setFieldErrors((prev) => ({
        ...prev,
        [field]: fieldError ? fieldError.message : undefined,
      }))
    } else {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError("")

    const result = registerSchema.safeParse({ name, email, password })
    if (!result.success) {
      const errors: FieldErrors = {}
      result.error.issues.forEach((err) => {
        const field = err.path[0] as "name" | "email" | "password"
        if (!errors[field]) errors[field] = err.message
      })
      setFieldErrors(errors)
      return
    }

    setLoading(true)

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    })

    if (!res.ok) {
      const data = await res.json()
      setServerError(
        res.status === 409
          ? "An account with this email already exists. Sign in instead?"
          : (data.error ?? "Something went wrong. Please try again.")
      )
      setLoading(false)
      return
    }

    // Auto-login after successful registration (D-02)
    const signInRes = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (signInRes?.error) {
      setServerError("Account created but sign-in failed. Please sign in manually.")
      return
    }

    router.push("/dashboard")
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-[#e5e7eb]">Create account</h1>
        <p className="text-base text-[#6b7280] mt-1">
          Start tracking your trades today.
        </p>
      </div>

      {serverError && (
        <div className="border border-[#ef4444] bg-[#ef4444]/10 rounded-lg p-3 text-sm text-[#ef4444]">
          {serverError.includes("Sign in instead") ? (
            <>
              An account with this email already exists.{" "}
              <Link href="/login" className="text-[#00ff88] hover:underline">
                Sign in instead?
              </Link>
            </>
          ) : (
            serverError
          )}
        </div>
      )}

      <GoogleSignInButton />
      <Divider />

      <Input
        id="register-name"
        label="Name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => validateField("name", name)}
        error={fieldErrors.name}
        autoComplete="name"
      />

      <Input
        id="register-email"
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onBlur={() => validateField("email", email)}
        error={fieldErrors.email}
        autoComplete="email"
      />

      <div className="flex flex-col gap-1">
        <Input
          id="register-password"
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => validateField("password", password)}
          error={fieldErrors.password}
          autoComplete="new-password"
        />
        <p className="text-sm text-[#6b7280] mt-1">
          Min 8 characters, 1 uppercase, 1 lowercase, 1 number
        </p>
      </div>

      <Button type="submit" variant="primary" loading={loading}>
        Create account
      </Button>

      <p className="text-sm text-[#6b7280] text-center">
        Already have an account?{" "}
        <Link href="/login" className="text-[#00ff88] hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  )
}
