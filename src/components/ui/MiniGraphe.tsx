'use client'

import { useEffect, useRef } from 'react'
import styles from './miniGraphe.module.css'

interface DataPoint { date: string; value: number }

interface MiniGrapheProps {
  data:          DataPoint[]
  color:         string
  formatY?:      (v: number) => string
  invertY?:      boolean
  onPointClick?: (date: string) => void
  height?:       number
}

export default function MiniGraphe({
  data, color, formatY, invertY = false, onPointClick, height = 120,
}: MiniGrapheProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef  = useRef<any>(null)

  useEffect(() => {
    if (!canvasRef.current || !data.length) return
    const el = canvasRef.current
    let destroyed = false

    ;(async () => {
      const { Chart } = await import('chart.js/auto')
      if (destroyed || !el) return
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }

      const cs     = getComputedStyle(el)
      const muted  = cs.getPropertyValue('--muted').trim()  || '#6b7a93'
      const border = cs.getPropertyValue('--border').trim() || '#e3e8f0'

      chartRef.current = new Chart(el, {
        type: 'line',
        data: {
          labels:   data.map(e => e.date.slice(5)),
          datasets: [{
            data:                 data.map(e => e.value),
            borderColor:          color,
            backgroundColor:      color + '18',
            borderWidth:          2,
            pointRadius:          3.5,
            pointBackgroundColor: color,
            pointBorderColor:     '#fff',
            pointBorderWidth:     1.5,
            fill:                 true,
            tension:              0.3,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              grid:  { display: false },
              ticks: { color: muted, font: { size: 10 }, maxTicksLimit: 7 },
            },
            y: {
              reverse: invertY,
              grid:    { color: border },
              ticks:   {
                color: muted,
                font:  { size: 10 },
                ...(formatY ? { callback: (v: string | number) => formatY(Number(v)) } : {}),
              },
            },
          },
          onClick: onPointClick ? (_: any, elements: any[]) => {
            if (elements.length > 0) {
              onPointClick(data[elements[0].index].date.slice(0, 10))
            }
          } : undefined,
        },
      })
    })()

    return () => {
      destroyed = true
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [data, color, invertY, onPointClick])  // formatY omitted — stable callers pass a module-level fn

  if (!data.length) return null
  return (
    <div className={styles.wrap} style={{ height }}>
      <canvas ref={canvasRef} />
    </div>
  )
}
