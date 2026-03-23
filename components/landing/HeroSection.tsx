import Link from "next/link"

const stats = [
  { value: "Seconds", label: "to log a trade" },
  { value: "P&L", label: "calculated instantly" },
  { value: "Free", label: "no credit card needed" },
]

export function HeroSection() {
  return (
    <section className="relative bg-[#0f0f0f] pt-28 pb-24 px-6 overflow-hidden">
      {/* Subtle green glow behind headline */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#00ff88]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-[760px] mx-auto text-center">
        {/* Eyebrow pill */}
        <div className="inline-flex items-center gap-2 bg-[#00ff88]/10 border border-[#00ff88]/20 rounded-full px-4 py-1.5 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
          <span className="text-xs text-[#00ff88] font-medium tracking-wide">Built for traders who take their edge seriously</span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl font-bold text-[#e5e7eb] leading-[1.1] tracking-tight">
          Stop guessing.<br />
          <span className="text-[#00ff88]">Start knowing.</span>
        </h1>

        {/* Subheading */}
        <p className="text-lg text-[#6b7280] leading-relaxed mt-6 max-w-[560px] mx-auto">
          Log a trade in under a minute. See your win rate, P&amp;L, and R:R the moment you close it.
          No spreadsheets, no manual math. Just your data, clean and instant.
        </p>

        {/* CTA group */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/register"
            className="inline-flex items-center bg-[#00ff88] text-[#0f0f0f] text-base font-bold h-12 px-8 rounded-lg hover:bg-[#00e67a] transition-colors duration-150 w-full sm:w-auto justify-center"
          >
            Start for free
          </Link>
          <Link
            href="#features"
            className="inline-flex items-center text-sm text-[#6b7280] hover:text-[#e5e7eb] transition-colors h-12 px-4"
          >
            See what's inside →
          </Link>
        </div>

        {/* Mini stats */}
        <div className="mt-16 grid grid-cols-3 gap-4 max-w-[480px] mx-auto">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1">
              <span className="text-xl font-bold text-[#e5e7eb]">{s.value}</span>
              <span className="text-xs text-[#4b5563]">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
