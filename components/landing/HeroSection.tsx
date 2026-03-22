import Link from "next/link"

export function HeroSection() {
  return (
    <section className="bg-[#0f0f0f] py-24 px-8">
      <div className="max-w-[720px] mx-auto text-center">
        {/* Eyebrow */}
        <p
          className="text-sm text-[#00ff88] uppercase tracking-widest mb-4"
          style={{ letterSpacing: "0.08em" }}
        >
          BUILT FOR ACTIVE TRADERS
        </p>

        {/* Headline */}
        <h1 className="text-5xl font-bold text-[#e5e7eb] leading-tight">
          Track every trade. Improve every week.
        </h1>

        {/* Subheading */}
        <p className="text-base text-[#6b7280] leading-relaxed mt-6">
          Log trades in under a minute. See your win rate, P&amp;L, and R:R — instantly. No spreadsheets.
        </p>

        {/* CTA group */}
        <div className="mt-10 flex flex-row items-center justify-center gap-4">
          {/* Primary CTA */}
          <Link
            href="/register"
            className="inline-flex items-center bg-[#00ff88] text-[#0f0f0f] text-base font-bold h-12 px-7 rounded-lg hover:bg-[#00e67a] transition-colors duration-150"
          >
            Get Started — it&apos;s free
          </Link>

          {/* Secondary CTA */}
          <Link
            href="#features"
            className="inline-flex items-center text-base text-[#6b7280] hover:underline h-12 px-4"
          >
            See how it works
          </Link>
        </div>
      </div>
    </section>
  )
}
