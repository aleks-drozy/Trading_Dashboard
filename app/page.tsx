import { Navbar } from "@/components/landing/Navbar"
import { HeroSection } from "@/components/landing/HeroSection"
import { FeaturesSection } from "@/components/landing/FeaturesSection"

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#020617]">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
    </main>
  )
}
