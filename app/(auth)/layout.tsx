export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] p-4">
      {children}
    </div>
  )
}
