export const API_BASE = ''  // Vite proxy handles /auth -> backend

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
  return fetch(url, {
    ...init,
    headers: { ...getAuthHeaders(), ...init?.headers },
  })
}
