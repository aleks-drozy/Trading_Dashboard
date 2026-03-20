import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { SessionIndicator } from './SessionIndicator'
import { WSStatusDot } from './WSStatusDot'

interface DashboardHeaderProps {
  nySessionActive: boolean
  wsStatus: 'connecting' | 'connected' | 'disconnected'
}

export function DashboardHeader({ nySessionActive, wsStatus }: DashboardHeaderProps) {
  const { logout } = useAuth()

  return (
    <header
      className="sticky top-0 z-50 h-14 flex items-center border-b"
      style={{ backgroundColor: '#1A1D27', borderColor: '#2D3148' }}
    >
      <div className="w-full max-w-[1280px] mx-auto px-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: '#F1F5F9' }}>
          Trading Dashboard
        </h1>
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
