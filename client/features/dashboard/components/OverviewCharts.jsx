import { useTranslation } from 'react-i18next'

const copyStates = ['available', 'on_loan', 'damaged', 'lost', 'retired']

// Borrowing trend (line) and copy availability (bars). Colours come from theme tokens,
// so both charts follow light and dark mode.
export default function OverviewCharts({ data }) {
  const { t, i18n } = useTranslation()
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date()
    date.setUTCDate(1)
    date.setUTCMonth(date.getUTCMonth() - 11 + index)
    const key = date.toISOString().slice(0, 7)
    return { month: key, count: data.monthly.find((item) => item._id === key)?.issued ?? 0 }
  })
  const max = Math.max(1, ...months.map((item) => item.count))
  const points = months
    .map((item, index) => `${35 + index * 44},${170 - (item.count / max) * 130}`)
    .join(' ')
  const states = copyStates.map((status) => ({
    status,
    count: data.inventory.find((item) => item._id === status)?.count ?? 0,
  }))
  const maxCopies = Math.max(1, ...states.map((item) => item.count))
  const monthLabel = (key) =>
    new Intl.DateTimeFormat(i18n.language, { month: 'short', timeZone: 'UTC' }).format(
      new Date(`${key}-01T00:00:00Z`),
    )
  return (
    <div className="overview-charts">
      <section className="panel">
        <h2>{t('ui.charts.borrowing')}</h2>
        <p className="muted">{t('ui.charts.last12')}</p>
        <svg
          className="circulation-chart"
          viewBox="0 0 560 215"
          role="img"
          aria-label={`${t('ui.charts.borrowing')}: ${months.map((item) => `${item.month}: ${item.count}`).join(', ')}`}
        >
          {[0, 0.5, 1].map((ratio) => (
            <g key={ratio}>
              <line
                x1="35"
                x2="525"
                y1={170 - ratio * 130}
                y2={170 - ratio * 130}
                className="chart-grid"
              />
              <text x="3" y={174 - ratio * 130}>
                {Math.round(max * ratio)}
              </text>
            </g>
          ))}
          <polyline points={points} className="chart-line" />
          {months.map((item, index) => (
            <g key={item.month}>
              <circle
                cx={35 + index * 44}
                cy={170 - (item.count / max) * 130}
                r="4"
                className="chart-point"
              >
                <title>{t('ui.charts.loansIn', { month: item.month, count: item.count })}</title>
              </circle>
              <text x={35 + index * 44} y="198" textAnchor="middle">
                {monthLabel(item.month)}
              </text>
            </g>
          ))}
        </svg>
        <details>
          <summary>{t('ui.charts.viewData')}</summary>
          <table>
            <thead>
              <tr>
                <th>{t('ui.charts.month')}</th>
                <th>{t('ui.charts.issued')}</th>
              </tr>
            </thead>
            <tbody>
              {months.map((item) => (
                <tr key={item.month}>
                  <td>{item.month}</td>
                  <td>{item.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>
      <section className="panel">
        <h2>{t('ui.charts.availability')}</h2>
        <div className="inventory-bars">
          {states.map((item) => (
            <div key={item.status}>
              <div className="chart-bar-label">
                <span>{t(`status.${item.status}`)}</span>
                <strong>{item.count}</strong>
              </div>
              <div className="chart-bar-track">
                <div
                  className="chart-bar"
                  style={{ width: `${(item.count / maxCopies) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="muted">
          {t('ui.charts.copiesTotal', {
            count: states.reduce((total, item) => total + item.count, 0),
          })}
        </p>
      </section>
    </div>
  )
}
