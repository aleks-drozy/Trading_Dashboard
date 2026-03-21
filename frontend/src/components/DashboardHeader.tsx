import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { SessionIndicator } from './SessionIndicator'
import { WSStatusDot } from './WSStatusDot'

interface DashboardHeaderProps {
  nySessionActive: boolean
  wsStatus: 'connecting' | 'connected' | 'disconnected'
}

const navLinks = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/chart', label: 'Chart' },
  { to: '/backtest', label: 'Backtest' },
]

export function DashboardHeader({ nySessionActive, wsStatus }: DashboardHeaderProps) {
  const { logout } = useAuth()
  const location = useLocation()

  return (
    <header
      className="sticky top-0 z-50 h-14 flex items-center border-b"
      style={{ backgroundColor: '#1A1D27', borderColor: '#2D3148' }}
    >
      <div className="w-full max-w-[1280px] mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center">
          <h1 className="text-xl font-semibold" style={{ color: '#F1F5F9' }}>
            Trading Dashboard
          </h1>
          <nav className="flex items-center gap-4 ml-8">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className="text-sm font-medium transition-colors"
                style={{ color: location.pathname === link.to ? '#3B82F6' : '#6B7280' }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <SessionIndicator active={nySessionActive} />
          <WSStatusDot status={wsStatus} />
          <Button variant="ghost" size="sm" onClick={logout} className="text-[#6B7280] hover:text-[#F1F5F9]">
            <LogOut className="w-4 h-4 mr-1" />
            Out
          </Button>
        </div>
      </div>
    </header>
  )
}
