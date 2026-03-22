---
status: complete
phase: 01-project-foundation-auth
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md, 01-04-SUMMARY.md, 01-05-SUMMARY.md]
started: 2026-03-22T00:00:00Z
updated: 2026-03-22T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running dev server. Start fresh with `npm run dev`. Server boots without errors, and http://localhost:3000 loads the landing page (dark background, Trade/Journal navbar, hero text visible).
result: pass

### 2. Landing Page Content
expected: At `/`, you see a sticky dark navbar with logo "Trade/Journal" (slash in green), a "Login" link, and a green "Get Started" button. Below: hero with eyebrow "BUILT FOR ACTIVE TRADERS", headline "Track every trade. Improve every week.", and two CTA buttons. Below that: a 3-column feature card grid (or 1-column on mobile).
result: pass

### 3. Navbar Links
expected: Clicking "Login" in the navbar navigates to `/login`. Clicking "Get Started" navigates to `/register`. Both pages load without errors.
result: pass

### 4. Login Page Renders
expected: At `/login`, a centered card contains an email field, a password field, a green "Sign in" button, a "Sign in with Google" button, a "Forgot password?" link, and a "Create account" link. No JavaScript errors in the console.
result: pass

### 5. Register Page Renders
expected: At `/register`, a centered card contains name, email, and password fields, a "Create account" button, a "Sign in with Google" button, and a password hint about complexity requirements. A "Sign in" link is also present.
result: pass

### 6. Register a New User
expected: Fill in name, valid email, and a password meeting complexity (8+ chars, uppercase, lowercase, digit) on `/register`. Submit — you should be automatically redirected to `/dashboard` (no separate login step needed).
result: pass

### 7. Login with Credentials
expected: On `/login`, enter the email and password from the previous test and submit. You're redirected to `/dashboard`. Then try wrong credentials — an error banner appears on the form (no page navigation).
result: issue
reported: "there is no log out button when your on /dashboard"
severity: minor

### 8. Route Protection
expected: While logged out (or in a fresh browser/incognito tab), navigate directly to `/dashboard`. You should be redirected to `/login`, not shown the dashboard.
result: pass

### 9. Forgot Password Page
expected: Navigate to `/forgot-password` (or click "Forgot password?" on the login page). A card with an email field and submit button renders. A "Back to sign in" link is visible.
result: pass

### 10. Forgot Password Anti-Enumeration
expected: On `/forgot-password`, submit a completely made-up email address (e.g., notreal@example.com). A success message appears — the same message as if the email existed. No error or "email not found" message is shown.
result: pass

### 11. Reset Password Invalid Token
expected: Navigate to `/reset-password?token=invalidtoken123`. Instead of a password form, you see an error/invalid state with a message about the link being invalid or expired, and a button/link to "Request a new link" pointing back to `/forgot-password`.
result: issue
reported: "shows the Set new password form instead of an invalid token error state"
severity: major

## Summary

total: 11
passed: 9
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Dashboard has a logout button so users can end their session"
  status: failed
  reason: "User reported: there is no log out button when your on /dashboard"
  severity: minor
  test: 7
  artifacts: []
  missing: []
- truth: "Navigating to /reset-password?token=invalidtoken123 shows an invalid token error state immediately, not the password form"
  status: failed
  reason: "User reported: shows the Set new password form instead of an invalid token error state"
  severity: major
  test: 11
  artifacts: []
  missing: []
