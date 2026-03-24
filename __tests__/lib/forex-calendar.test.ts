import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  filterForexEvents,
  splitByDay,
  type RawFFEvent,
  type ForexEvent,
} from "@/lib/forex-calendar"

describe("filterForexEvents", () => {
  const events: RawFFEvent[] = [
    { title: "NFP", country: "USD", date: "2026-03-28", time: "08:30am", impact: "High" },
    { title: "Holiday", country: "USD", date: "2026-03-28", time: "All Day", impact: "Holiday" },
    {
      title: "Consumer Sentiment",
      country: "USD",
      date: "2026-03-28",
      time: "10:00am",
      impact: "Medium",
    },
    { title: "Some Low Event", country: "EUR", date: "2026-03-28", time: "09:00am", impact: "Low" },
    { title: "Non-Economic", country: "USD", date: "2026-03-28", time: "All Day", impact: "" },
  ]

  it("keeps High, Medium, Low impact events", () => {
    const result = filterForexEvents(events)
    expect(result).toHaveLength(3)
    expect(result.map((e) => e.title)).toContain("NFP")
    expect(result.map((e) => e.title)).toContain("Consumer Sentiment")
    expect(result.map((e) => e.title)).toContain("Some Low Event")
  })

  it("excludes Holiday and empty impact", () => {
    const result = filterForexEvents(events)
    expect(result.map((e) => e.title)).not.toContain("Holiday")
    expect(result.map((e) => e.title)).not.toContain("Non-Economic")
  })

  it("maps impact strings to ForexEvent shape", () => {
    const result = filterForexEvents(events)
    const nfp = result.find((e) => e.title === "NFP")!
    expect(nfp.impact).toBe("High")
    expect(nfp.country).toBe("USD")
    expect(nfp.date).toBe("2026-03-28")
    expect(nfp.time).toBe("08:30am")
  })
})

describe("splitByDay", () => {
  const events: ForexEvent[] = [
    { title: "GDP", country: "USD", date: "2026-03-24", time: "08:30am", impact: "High" },
    { title: "FOMC", country: "USD", date: "2026-03-25", time: "02:00pm", impact: "High" },
    { title: "Claims", country: "USD", date: "2026-03-26", time: "08:30am", impact: "Medium" },
  ]

  it("puts events matching today into today array", () => {
    const { today, upcoming } = splitByDay(events, "2026-03-24")
    expect(today).toHaveLength(1)
    expect(today[0].title).toBe("GDP")
  })

  it("puts future events into upcoming array", () => {
    const { today, upcoming } = splitByDay(events, "2026-03-24")
    expect(upcoming).toHaveLength(2)
    expect(upcoming.map((e) => e.title)).toContain("FOMC")
    expect(upcoming.map((e) => e.title)).toContain("Claims")
  })

  it("returns empty today when no events match today's date", () => {
    const { today } = splitByDay(events, "2026-03-30")
    expect(today).toHaveLength(0)
  })
})
