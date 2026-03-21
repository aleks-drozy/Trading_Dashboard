// In local dev VITE_API_URL is not set so API_BASE = '' and Vite proxy handles routing.
// In production on Vercel set VITE_API_URL=https://<service>.onrender.com as a Vercel env var.
export const API_BASE = import.meta.env.VITE_API_URL ?? ''

export async function loginRequest(email: string, password: string): Promise<{ access_token: string }> {
  const body = new URLSearchParams({ username: email, password })
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || 'Login failed')
  }
  return res.json()
}

export function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function fetchWithAuth(url: string, init?: RequestInit): Promise<Response> {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`
  return fetch(fullUrl, {
    ...init,
    headers: { ...getAuthHeaders(), ...init?.headers },
  })
}

export interface PaperTrade {
  id: number
  symbol: string
  direction: string
  entry_price: number
  exit_price: number | null
  stop_price: number
  target_price: number
  pnl: number | null
  outcome: string | null
  closed_at: string | null
}

export interface Portfolio {
  starting_balance: number
  total_pnl: number
  current_balance: number
  pnl_percent: number
}

export async function fetchTrades(): Promise<PaperTrade[]> {
  const res = await fetchWithAuth('/paper/trades')
  if (!res.ok) throw new Error('Failed to fetch trades')
  return res.json()
}

export async function fetchPortfolio(): Promise<Portfolio> {
  const res = await fetchWithAuth('/paper/portfolio')
  if (!res.ok) throw new Error('Failed to fetch portfolio')
  return res.json()
}
