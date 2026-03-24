"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"
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
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState("")
  const [loading, setLoading] = useState(false)

  const validateField = (name: "email" | "password", value: string) => {
    const result = loginSchema.safeParse({ email, password, [name]: value })
    if (!result.success) {
      const fieldError = result.error.issues.find((e) => e.path[0] === name)
      setFieldErrors((prev) => ({ ...prev, [name]: fieldError ? fieldError.message : undefined }))
    } else {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError("")
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
      <div className="mb-1">
        <h1 className="text-2xl font-bold text-[#f8fafc] tracking-tight">Sign in</h1>
        <p className="text-sm text-[#64748b] mt-1">Welcome back. Enter your credentials below.</p>
      </div>

      {serverError && (
        <div
          role="alert"
          className="border border-[#ef4444]/40 bg-[#ef4444]/8 rounded-lg p-3 text-sm text-[#ef4444]"
        >
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
        <div className="relative">
          <Input
            id="login-password"
            label="Password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => validateField("password", password)}
            error={fieldErrors.password}
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-[34px] text-[#64748b] hover:text-[#94a3b8] transition-colors cursor-pointer"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <Link
          href="/forgot-password"
          className="text-sm text-[#64748b] hover:text-[#00ff88] text-right block mt-1 transition-colors duration-150"
        >
          Forgot password?
        </Link>
      </div>

      <Button type="submit" variant="primary" loading={loading}>
        Sign in
      </Button>

      <p className="text-sm text-[#64748b] text-center">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-[#00ff88] hover:underline">
          Sign up
        </Link>
      </p>
    </form>
  )
}
