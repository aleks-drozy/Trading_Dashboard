import { useEffect, useRef } from 'react'
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  LineStyle,
  createSeriesMarkers,
  type IChartApi,
  type UTCTimestamp,
} from 'lightweight-charts'

interface ChartBar {
  time: number // Unix seconds
  open: number
  high: number
  low: number
  close: number
}

interface EmaPoint {
  time: number
  value: number
}

interface IFVGZone {
  top: number
  bottom: number
  startTime: number
  endTime: number
  type: 'bullish' | 'bearish'
}

interface EntryMarker {
  time: number
  direction: 'Long' | 'Short'
}

interface CandlestickChartProps {
  bars: ChartBar[]
  ema: EmaPoint[]
  ifvgZones: IFVGZone[]
  cisdLevel: number | null
  markers: EntryMarker[]
  loading?: boolean
  error?: string | null
}

export function CandlestickChart({
  bars,
  ema,
  ifvgZones,
  cisdLevel,
  markers,
  loading = false,
  error = null,
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    if (bars.length === 0) return

    // Remove previous chart instance before recreating
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: '#0F1117' },
        textColor: '#F1F5F9',
      },
      grid: {
        vertLines: { color: '#2D3148' },
        horzLines: { color: '#2D3148' },
      },
      height: 400,
      width: containerRef.current.clientWidth,
    })

    chartRef.current = chart

    // Candlestick series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22C55E',
      downColor: '#EF4444',
      borderUpColor: '#22C55E',
      borderDownColor: '#EF4444',
      wickUpColor: '#22C55E',
      wickDownColor: '#EF4444',
    })
    candleSeries.setData(
      bars.map(b => ({ ...b, time: b.time as UTCTimestamp }))
    )

    // 20-EMA line overlay
    const emaSeries = chart.addSeries(LineSeries, {
      color: '#3B82F6',
      lineWidth: 1,
    })
    emaSeries.setData(
      ema.map(p => ({ time: p.time as UTCTimestamp, value: p.value }))
    )

    // CISD price line — yellow dashed horizontal
    if (cisdLevel !== null) {
      candleSeries.createPriceLine({
        price: cisdLevel,
        color: '#F1C40F',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        title: 'CISD',
      })
    }

    // IFVG zones — two price lines bracketing each zone (top and bottom)
    for (const zone of ifvgZones) {
      const zoneColor =
        zone.type === 'bullish'
          ? 'rgba(34, 197, 94, 0.5)'
          : 'rgba(239, 68, 68, 0.5)'
      candleSeries.createPriceLine({
        price: zone.top,
        color: zoneColor,
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        title: '',
      })
      candleSeries.createPriceLine({
        price: zone.bottom,
        color: zoneColor,
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        title: '',
      })
    }

    // Long/Short entry markers
    if (markers.length > 0) {
      const lwMarkers = markers.map(m => ({
        time: m.time as UTCTimestamp,
        position: m.direction === 'Long' ? ('belowBar' as const) : ('aboveBar' as const),
        color: m.direction === 'Long' ? '#22C55E' : '#EF4444',
        shape: m.direction === 'Long' ? ('arrowUp' as const) : ('arrowDown' as const),
        text: m.direction === 'Long' ? 'L' : 'S',
      }))
      createSeriesMarkers(candleSeries, lwMarkers)
    }

    chart.timeScale().fitContent()

    // Resize handler
    const handleResize = () => {
      if (chartRef.current && containerRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth })
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
    }
  }, [bars, ema, ifvgZones, cisdLevel, markers])

  if (loading) {
    return (
      <div
        style={{
          height: 400,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6B7280',
        }}
      >
        Loading chart...
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{
          height: 400,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#EF4444',
        }}
      >
        {error}
      </div>
    )
  }

  return <div ref={containerRef} style={{ width: '100%', height: 400 }} />
}
