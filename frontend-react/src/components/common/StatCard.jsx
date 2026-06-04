function StatCard({ title, value, note }) {
  return (
    <div className="card stat-card">
      <div className="stat-label">{title}</div>
      <div className="stat-value">{value}</div>
      {note && <div className="stat-note">{note}</div>}
    </div>
  )
}

export default StatCard