"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton"
import { Divider } from "@/components/ui/Divider"
import { loginSchema } from "@/schemas/auth"

interface FieldErrors {
  email?: string
  password?: string
}

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState("")
  const [loading, setLoading] = useState(false)

  const validateField = (name: "email" | "password", value: string) => {
    const result = loginSchema.safeParse({ email, password, [name]: value })
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
    setServerError("")

    // Validate all fields before submit
    const result = loginSchema.safeParse({ email, password })
    if (!result.success) {
      const errors: FieldErrors = {}
      result.error.issues.forEach((err) => {
        const field = err.path[0] as "email" | "password"
        if (!errors[field]) errors[field] = err.message
      })
      setFieldErrors(errors)
      return
    }

    setLoading(true)
    const res = await signIn("credentials", { email, password, redirect: false })
    setLoading(false)

    if (res?.error) {
      setServerError("Incorrect email or password.")
      return
    }

    router.push("/dashboard")
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-[#e5e7eb]">Sign in</h1>
        <p className="text-base text-[#6b7280] mt-1">
          Welcome back. Enter your credentials below.
        </p>
      </div>

      {serverError && (
        <div className="border border-[#ef4444] bg-[#ef4444]/10 rounded-lg p-3 text-sm text-[#ef4444]">
          {serverError}
        </div>
      )}

      <GoogleSignInButton />
      <Divider />

      <Input
        id="login-email"
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
          id="login-password"
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => validateField("password", password)}
          error={fieldErrors.password}
          autoComplete="current-password"
        />
        <Link
          href="/forgot-password"
          className="text-sm text-[#6b7280] hover:text-[#00ff88] text-right block mt-1"
        >
          Forgot password?
        </Link>
      </div>

      <Button type="submit" variant="primary" loading={loading}>
        Sign in
      </Button>

      <p className="text-sm text-[#6b7280] text-center">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-[#00ff88] hover:underline">
          Sign up
        </Link>
      </p>
    </form>
  )
}
