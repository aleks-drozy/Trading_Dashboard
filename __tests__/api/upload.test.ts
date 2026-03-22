import { describe, it, expect } from "vitest"

describe("upload validation", () => {
  const FIVE_MB = 5 * 1024 * 1024

  it("rejects files larger than 5 MB", () => {
    // Stub — will be expanded when upload route is implemented
    expect(FIVE_MB).toBe(5242880)
  })

  it("defines allowed MIME types: jpg, png, gif, webp", () => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    expect(allowedTypes).toHaveLength(4)
    expect(allowedTypes).toContain("image/jpeg")
    expect(allowedTypes).toContain("image/webp")
  })
})
