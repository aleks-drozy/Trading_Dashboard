import { useState, type FormEvent } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { loginRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await loginRequest(email, password)
      login(data.access_token)
      navigate('/dashboard')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid email or password.'
      setError(message || 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0F1117' }}>
      <Card className="w-full max-w-[400px]" style={{ backgroundColor: '#1A1D27', borderColor: '#2D3148' }}>
        <CardHeader className="text-center">
          <CardTitle className="text-[28px] font-bold" style={{ color: '#F1F5F9' }}>
            Trading Dashboard
          </CardTitle>
          <CardDescription style={{ color: '#6B7280' }}>
            Sign in to view live signals
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" style={{ color: '#F1F5F9' }}>Email</Label>
              <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" style={{ color: '#F1F5F9' }}>Password</Label>
              <Input id="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            {error && <p className="text-sm" style={{ color: '#EF4444' }}>{error}</p>}
            <Button type="submit" disabled={loading} className="w-full" style={{ backgroundColor: '#3B82F6' }}>
              {loading ? 'Signing in...' : 'Log In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
