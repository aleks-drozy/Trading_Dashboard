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
    body: "No ads. No bloat. No colour themes that make your eyes hurt. Just a clean interface that stays out of your way while you trade.",
  },
]

export function FeaturesSection() {
  return (
    <>
      {/* Features */}
      <section id="features" className="bg-[#020617] py-24 px-6 border-t border-[#1e293b]">
        <div className="max-w-[1100px] mx-auto">
          <div className="max-w-[520px] mb-14">
            <p className="text-xs text-[#00ff88] font-semibold uppercase tracking-widest mb-3">
              What you get
            </p>
            <h2 className="text-3xl font-bold text-[#f8fafc] leading-snug">
              Everything you need.
              <br />
              Nothing you don&apos;t.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {features.map((feature, i) => {
              const Icon = feature.icon
              return (
                <div
                  key={feature.title}
                  className="group bg-[#0e1223] border border-[#1e293b] rounded-2xl p-7 hover:border-[#00ff88]/25 hover:bg-[#0e1529] transition-all duration-200"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#00ff88]/8 border border-[#00ff88]/12 flex items-center justify-center mb-5 group-hover:bg-[#00ff88]/12 transition-colors">
                    <Icon size={20} className="text-[#00ff88]" />
                  </div>
                  <span className="text-xs text-[#64748b] font-mono mb-3 block">0{i + 1}</span>
                  <h3 className="text-base font-semibold text-[#f8fafc] mb-3 leading-snug">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-[#94a3b8] leading-relaxed">{feature.body}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-[#020617] py-20 px-6 border-t border-[#1e293b]">
        <div className="max-w-[560px] mx-auto text-center">
          <h2 className="text-3xl font-bold text-[#f8fafc] mb-4 leading-tight">
            Ready to actually learn from your trades?
          </h2>
          <p className="text-[#94a3b8] mb-8 text-base">
            It&apos;s free. Takes 30 seconds to sign up. No spreadsheet required.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center bg-[#00ff88] text-[#020617] text-base font-bold h-12 px-8 rounded-lg hover:bg-[#00e67a] transition-colors duration-150"
          >
            Create your account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#020617] border-t border-[#1e293b] py-6 px-6">
        <div className="max-w-[1100px] mx-auto flex items-center justify-between">
          <span className="text-sm font-bold text-[#f8fafc]">
            Trade<span className="text-[#00ff88]">Journal</span>
          </span>
          <span className="text-xs text-[#64748b]">Built for traders who want to get better.</span>
        </div>
      </footer>
    </>
  )
}
