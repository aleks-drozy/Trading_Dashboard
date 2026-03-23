import Link from "next/link"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#0f0f0f] p-4">
      <div className="p-2">
        <Link
          href="/"
          className="text-sm text-[#6b7280] hover:text-[#00ff88] transition-colors"
        >
          ← Back to home
        </Link>
      </div>
      <div className="flex-1 flex items-center justify-center">
        {children}
      </div>
    </div>
  )
}
