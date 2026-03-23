import { ClipboardList, TrendingUp, Monitor } from "lucide-react"
import Link from "next/link"

const features = [
  {
    icon: ClipboardList,
    title: "Log it before you forget it",
    body: "Fill in symbol, direction, entry, exit, and notes. Done. Attach a chart screenshot if you want. The whole thing takes less time than opening a spreadsheet.",
  },
  {
    icon: TrendingUp,
    title: "Your numbers, no calculator needed",
    body: "Win rate, P&L, R:R, and drawdown update the second you save a trade. You'll know exactly how you're doing without doing any of the math yourself.",
  },
  {
    icon: Monitor,
    title: "Dark, distraction-free, and fast",
    body: "No ads. No bloat. No colour themes that make your eyes hurt. Just a clean terminal-style interface that stays out of your way while you trade.",
  },
]

export function FeaturesSection() {
  return (
    <>
      {/* Features */}
      <section id="features" className="bg-[#0f0f0f] py-24 px-6 border-t border-[#1e1e1e]">
        <div className="max-w-[1100px] mx-auto">
          {/* Header */}
          <div className="max-w-[520px] mb-14">
            <p className="text-xs text-[#00ff88] font-semibold uppercase tracking-widest mb-3">
              What you get
            </p>
            <h2 className="text-3xl font-bold text-[#e5e7eb] leading-snug">
              Everything you need.<br />Nothing you don't.
            </h2>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {features.map((feature, i) => {
              const Icon = feature.icon
              return (
                <div
                  key={feature.title}
                  className="group bg-[#141414] border border-[#232323] rounded-2xl p-7 hover:border-[#00ff88]/30 hover:bg-[#161616] transition-all duration-200"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#00ff88]/10 flex items-center justify-center mb-5 group-hover:bg-[#00ff88]/15 transition-colors">
                    <Icon size={20} className="text-[#00ff88]" />
                  </div>
                  <span className="text-xs text-[#4b5563] font-mono mb-3 block">0{i + 1}</span>
                  <h3 className="text-lg font-semibold text-[#e5e7eb] mb-3 leading-snug">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-[#6b7280] leading-relaxed">
                    {feature.body}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-[#0f0f0f] py-20 px-6 border-t border-[#1e1e1e]">
        <div className="max-w-[600px] mx-auto text-center">
          <h2 className="text-3xl font-bold text-[#e5e7eb] mb-4">
            Ready to actually learn from your trades?
          </h2>
          <p className="text-[#6b7280] mb-8">
            It's free. Takes 30 seconds to sign up. No spreadsheet required.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center bg-[#00ff88] text-[#0f0f0f] text-base font-bold h-12 px-8 rounded-lg hover:bg-[#00e67a] transition-colors duration-150"
          >
            Create your account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0f0f0f] border-t border-[#1e1e1e] py-6 px-6">
        <div className="max-w-[1100px] mx-auto flex items-center justify-between">
          <span className="text-sm font-bold text-[#e5e7eb]">
            Trade<span className="text-[#00ff88]">Journal</span>
          </span>
          <span className="text-xs text-[#4b5563]">Built for traders who want to get better.</span>
        </div>
      </footer>
    </>
  )
}
