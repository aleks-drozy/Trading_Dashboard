import Link from "next/link"
import { TrendingUp, BarChart2, Zap } from "lucide-react"

const stats = [
  { icon: Zap, value: "Seconds", label: "to log a trade" },
  { icon: TrendingUp, value: "P&L", label: "calculated instantly" },
  { icon: BarChart2, value: "Free", label: "no credit card needed" },
]

export function HeroSection() {
  return (
    <section className="relative bg-[#020617] pt-28 pb-24 px-6 overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-[#00ff88]/4 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-32 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-[#00ff88]/3 rounded-full blur-2xl pointer-events-none" />

      <div className="relative max-w-[760px] mx-auto text-center">
        {/* Eyebrow pill */}
        <div className="inline-flex items-center gap-2 bg-[#00ff88]/8 border border-[#00ff88]/20 rounded-full px-4 py-1.5 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
          <span className="text-xs text-[#00ff88] font-medium tracking-wide">
            Built for traders who take their edge seriously
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl font-bold text-[#f8fafc] leading-[1.08] tracking-tight">
          Stop guessing.
          <br />
          <span className="text-[#00ff88]">Start knowing.</span>
        </h1>

        {/* Subheading */}
        <p className="text-lg text-[#94a3b8] leading-relaxed mt-6 max-w-[540px] mx-auto">
          Log a trade in under a minute. See your win rate, P&amp;L, and R:R the moment you close
          it. No spreadsheets, no manual math.
        </p>

        {/* CTA group */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/register"
            className="inline-flex items-center bg-[#00ff88] text-[#020617] text-base font-bold h-12 px-8 rounded-lg hover:bg-[#00e67a] transition-colors duration-150 w-full sm:w-auto justify-center"
          >
            Start for free
          </Link>
          <Link
            href="#features"
            className="inline-flex items-center text-sm text-[#64748b] hover:text-[#f8fafc] transition-colors duration-150 h-12 px-4"
          >
            See what&apos;s inside →
          </Link>
        </div>

        {/* Stats bar */}
        <div className="mt-16 inline-flex items-center gap-0 bg-[#0e1223] border border-[#1e293b] rounded-2xl overflow-hidden mx-auto">
          {stats.map((s, i) => {
            const Icon = s.icon
            return (
              <div
                key={s.label}
                className={`flex items-center gap-3 px-6 py-4 ${i < stats.length - 1 ? "border-r border-[#1e293b]" : ""}`}
              >
                <div className="w-8 h-8 rounded-lg bg-[#00ff88]/8 flex items-center justify-center flex-shrink-0">
                  <Icon size={15} className="text-[#00ff88]" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-[#f8fafc]">{s.value}</p>
                  <p className="text-xs text-[#64748b]">{s.label}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
