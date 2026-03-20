export function WSStatusDot({ status }: { status: 'connecting' | 'connected' | 'disconnected' }) {
  const colors = {
    connecting: '#F59E0B',
    connected: '#3B82F6',
    disconnected: '#EF4444',
  }
  const labels = {
    connecting: 'Connecting...',
    connected: 'Live',
    disconnected: 'Disconnected',
  }

  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${status === 'connected' ? 'animate-pulse' : ''}`}
      style={{ backgroundColor: colors[status] }}
      title={labels[status]}
    />
  )
}
