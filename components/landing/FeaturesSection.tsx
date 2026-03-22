import { ClipboardList, TrendingUp, Monitor } from "lucide-react"

const features = [
  {
    icon: ClipboardList,
    title: "Log trades in seconds",
    body: "Capture every trade with symbol, entry, exit, P&L, notes, and chart screenshots — without breaking your focus.",
  },
  {
    icon: TrendingUp,
    title: "Know your numbers",
    body: "Win rate, profit factor, R:R, drawdown — calculated automatically from your closed trades.",
  },
  {
    icon: Monitor,
    title: "A terminal built for traders",
    body: "Dark interface optimized for long sessions. No distractions. No clutter. Just your trade data.",
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="bg-[#0f0f0f] py-20 px-8">
      <div className="max-w-[1000px] mx-auto">
        {/* Section label */}
        <p
          className="text-sm text-[#00ff88] uppercase tracking-widest mb-4"
          style={{ letterSpacing: "0.08em" }}
        >
          WHAT YOU GET
        </p>

        {/* Section heading */}
        <h2 className="text-2xl font-bold text-[#e5e7eb] mb-12">
          Everything a serious trader needs
        </h2>

        {/* Feature card grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <div
                key={feature.title}
                className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-7 hover:border-[#3a3a3a] transition-colors duration-150"
              >
                <Icon size={24} className="text-[#00ff88] mb-4" />
                <h3 className="text-2xl font-bold text-[#e5e7eb] mb-3">
                  {feature.title}
                </h3>
                <p className="text-base text-[#6b7280] leading-relaxed">
                  {feature.body}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
