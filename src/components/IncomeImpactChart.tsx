import type { Card } from '../domain/schemas'
import type { ImpactMonth } from '../domain/summary'
import { ImpactChart, type ImpactLabels } from './ImpactChart'

const LABELS: ImpactLabels = {
  legend: 'Cartões',
  total: 'faturas',
  detailTitle: name => `Quanto o ${name} usa da renda`,
  detailColumn: 'Fatura',
  hint: 'Selecione um cartão (no campo acima ou na legenda) para destacar e ver os valores dele mês a mês.',
}

/** Faturas de todos os cartões empilhadas mês a mês, com a renda como marca tracejada. */
export function IncomeImpactChart({ months, cards, selectedId, onSelect }: {
  months: ImpactMonth[]; cards: Card[]; selectedId?: string; onSelect: (cardId: string) => void
}) {
  return <ImpactChart labels={LABELS} selectedId={selectedId} onSelect={onSelect}
    series={cards.map(card => ({ id: card.id, name: card.name, color: card.color }))}
    months={months.map(item => ({ ...item, parts: item.cards.map(part => ({ id: part.cardId, cents: part.cents })) }))} />
}
