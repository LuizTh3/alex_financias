import { useEffect, useRef, useState } from 'react'
import type { ImpactSeriesMonth } from '../domain/summary'
import { formatMoney, formatMonth, formatShortMonth } from '../domain/format'

const HEIGHT = 240
const PAD = { top: 12, right: 8, bottom: 26, left: 56 }
const compact = (cents: number) => new Intl.NumberFormat('pt-BR', { notation: 'compact', style: 'currency', currency: 'BRL', maximumFractionDigits: 1 }).format(cents / 100)
const percent = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 }).format(value)

export type ImpactSeries = { id: string; name: string; color: string }

/** Cores das categorias de despesa, pela ordem alfabética das categorias (`expenseCategories`). */
const CATEGORY_PALETTE = ['#6fcf97', '#f2b45a', '#5aa9e6', '#e57f9e', '#b392f0', '#4fc4c4', '#d6cf5f', '#f08c5a', '#9aa6b2', '#7c8ce0']
export const categoryColor = (categories: string[], category: string) =>
  CATEGORY_PALETTE[Math.max(0, categories.indexOf(category)) % CATEGORY_PALETTE.length]
export type ImpactLabels = {
  /** Nome do grupo de séries, ex.: "Cartões". */
  legend: string
  /** O que a barra soma, ex.: "faturas". */
  total: string
  /** Título da tabela da série selecionada. */
  detailTitle: (name: string) => string
  /** Cabeçalho da coluna de valor da série selecionada. */
  detailColumn: string
  hint: string
}

/**
 * Séries empilhadas mês a mês, com a renda como marca tracejada. Com uma série selecionada,
 * ela fica na cor dela e as demais esmaecem; abaixo, os valores dela mês a mês.
 */
export function ImpactChart({ months, series, labels, selectedId, onSelect }: {
  months: ImpactSeriesMonth[]; series: ImpactSeries[]; labels: ImpactLabels; selectedId?: string; onSelect: (id: string) => void
}) {
  const [hover, setHover] = useState<number | null>(null)
  // A largura do desenho acompanha a do contêiner, para os rótulos manterem o tamanho real.
  const plot = useRef<HTMLDivElement>(null)
  const [WIDTH, setWidth] = useState(720)
  useEffect(() => {
    const element = plot.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const byId = new Map(series.map(item => [item.id, item]))
  const max = Math.max(1, ...months.map(item => Math.max(item.incomeCents, item.totalCents))) * 1.1
  const innerW = WIDTH - PAD.left - PAD.right
  const innerH = HEIGHT - PAD.top - PAD.bottom
  const slot = innerW / months.length
  const barW = Math.min(44, slot * 0.6)
  const y = (cents: number) => PAD.top + innerH - (cents / max) * innerH
  const ticks = [0, 0.33, 0.66, 1].map(fraction => Math.round((max / 1.1) * fraction))
  const selected = selectedId ? byId.get(selectedId) : undefined
  const hovered = hover !== null ? months[hover] : null

  return <div className="impact-chart">
    <div className="impact-legend" role="group" aria-label={`${labels.legend} no gráfico`}>
      {series.map(item => <button key={item.id} type="button" className="impact-legend-item" aria-pressed={item.id === selectedId}
        data-muted={selected && item.id !== selectedId ? 'true' : undefined} onClick={() => onSelect(item.id)}>
        <span className="impact-swatch" style={{ background: item.color }} />{item.name}
      </button>)}
      <span className="impact-legend-item is-static"><span className="impact-swatch is-income" />Renda</span>
    </div>

    <div className="impact-plot" ref={plot}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`${labels.legend}: ${labels.total} comparadas à renda de cada mês`}>
        {ticks.map(tick => <g key={tick}>
          <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(tick)} y2={y(tick)} className="impact-grid" />
          <text x={PAD.left - 8} y={y(tick)} className="impact-axis" textAnchor="end" dominantBaseline="middle">{compact(tick)}</text>
        </g>)}
        {months.map((item, index) => {
          const cx = PAD.left + slot * index + slot / 2
          let base = item.totalCents
          const segments = [...item.parts].reverse().filter(part => part.cents > 0).map(part => {
            const top = y(base)
            const height = Math.max(0, y(base - part.cents) - top)
            base -= part.cents
            return { part, top, height }
          })
          return <g key={item.month} className={hover === index ? 'is-hover' : undefined}>
            {segments.map(({ part, top, height }, segmentIndex) => {
              const muted = !!selected && part.id !== selectedId
              const isTop = segmentIndex === 0
              return <rect key={part.id} x={cx - barW / 2} y={top + (isTop ? 0 : 1)} width={barW} height={Math.max(0, height - (isTop ? 1 : 2))}
                rx={isTop ? 4 : 0} className={muted ? 'impact-bar is-muted' : 'impact-bar'} style={muted ? undefined : { fill: byId.get(part.id)?.color }} />
            })}
            {item.incomeCents > 0 && <line x1={cx - slot * 0.42} x2={cx + slot * 0.42} y1={y(item.incomeCents)} y2={y(item.incomeCents)} className="impact-income" />}
            <text x={cx} y={HEIGHT - 8} className="impact-axis" textAnchor="middle">{months.length > 8 && slot < 46 ? formatShortMonth(item.month).slice(0, 3) : formatShortMonth(item.month)}</text>
            <rect x={PAD.left + slot * index} y={PAD.top} width={slot} height={innerH} className="impact-hit"
              onMouseEnter={() => setHover(index)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(index)} onBlur={() => setHover(null)}
              tabIndex={0} aria-label={`${formatMonth(item.month)}: ${labels.total} ${formatMoney(item.totalCents)}, renda ${formatMoney(item.incomeCents)}`} />
          </g>
        })}
      </svg>
      {hovered && hover !== null && <div className="impact-tooltip" style={{ left: `${((PAD.left + slot * hover + slot / 2) / WIDTH) * 100}%` }} role="status">
        <strong>{formatMonth(hovered.month)}</strong>
        <dl>
          <div><dt>Renda</dt><dd>{formatMoney(hovered.incomeCents)}</dd></div>
          {hovered.parts.filter(part => part.cents > 0).map(part => <div key={part.id} className={part.id === selectedId ? 'is-selected' : undefined}>
            <dt><span className="impact-swatch" style={{ background: byId.get(part.id)?.color }} />{byId.get(part.id)?.name}</dt><dd>{formatMoney(part.cents)}</dd>
          </div>)}
          <div className="is-total"><dt>Sobra da renda</dt><dd className={hovered.balanceCents < 0 ? 'is-negative' : undefined}>{formatMoney(hovered.balanceCents)}</dd></div>
        </dl>
      </div>}
    </div>

    {selected
      ? <div className="impact-detail">
        <h3><span className="impact-swatch" style={{ background: selected.color }} />{labels.detailTitle(selected.name)}</h3>
        <div className="impact-table-wrap"><table className="impact-table">
          <thead><tr><th scope="col">Mês</th><th scope="col">{labels.detailColumn}</th><th scope="col">% renda</th><th scope="col">Renda</th><th scope="col" title={`Soma de ${labels.legend.toLowerCase()}`}>Todos</th></tr></thead>
          <tbody>{months.map(item => {
            const cents = item.parts.find(part => part.id === selected.id)?.cents ?? 0
            return <tr key={item.month}>
              <th scope="row">{formatShortMonth(item.month)}</th>
              <td className="font-semibold">{formatMoney(cents)}</td>
              <td>{item.incomeCents > 0 ? percent(cents / item.incomeCents) : '—'}</td>
              <td>{formatMoney(item.incomeCents)}</td>
              <td>{formatMoney(item.totalCents)}</td>
            </tr>
          })}</tbody>
        </table></div>
      </div>
      : <p className="field-hint">{labels.hint}</p>}
  </div>
}
