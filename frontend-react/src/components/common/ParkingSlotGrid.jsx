const MOCK_SLOTS = [
  { code: 'S1', status: 'available', lastOccupiedAt: null },
  { code: 'S2', status: 'occupied',  lastOccupiedAt: '2026-06-07T05:34:00Z' },
  { code: 'S3', status: 'available', lastOccupiedAt: null },
  { code: 'S4', status: 'occupied',  lastOccupiedAt: '2026-06-07T03:15:00Z' },
  { code: 'S5', status: 'available', lastOccupiedAt: null },
  { code: 'S6', status: 'maintenance', lastOccupiedAt: null },
]

const STATUS = {
  available:   { label: 'Trống',    bg: '#f0fdf4', border: '#86efac', color: '#15803d', dot: '#22c55e' },
  occupied:    { label: 'Có xe',    bg: '#fef2f2', border: '#fca5a5', color: '#b91c1c', dot: '#ef4444' },
  maintenance: { label: 'Bảo trì', bg: '#f8fafc', border: '#cbd5e1', color: '#64748b', dot: '#94a3b8' },
}

function fmtTime(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function CarIcon({ color }) {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-3h8l2 3h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2" />
      <circle cx="7.5" cy="17" r="1.5" /><circle cx="16.5" cy="17" r="1.5" />
    </svg>
  )
}

function ParkingSlotGrid() {
  const slots = MOCK_SLOTS
  const available = slots.filter(s => s.status === 'available').length
  const total = slots.filter(s => s.status !== 'maintenance').length

  return (
    <div style={{ marginTop: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 className="card-title" style={{ margin: 0 }}>Chỗ đỗ xe ô tô</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#15803d', fontWeight: '700', background: '#f0fdf4', border: '1px solid #86efac', padding: '4px 12px', borderRadius: '20px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
            {available}/{total} trống
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {slots.map(slot => {
          const st = STATUS[slot.status] || STATUS.available
          const time = fmtTime(slot.lastOccupiedAt)
          return (
            <div
              key={slot.code}
              style={{
                background: st.bg,
                border: `1.5px solid ${st.border}`,
                borderRadius: '14px',
                padding: '18px 16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                transition: 'box-shadow 0.2s',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: '800', color: st.color, letterSpacing: '1px', textTransform: 'uppercase' }}>
                {slot.code}
              </div>
              <CarIcon color={slot.status === 'occupied' ? st.color : '#cbd5e1'} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: st.dot, display: 'inline-block', flexShrink: 0 }} />
                <span style={{ fontSize: '12px', fontWeight: '700', color: st.color }}>{st.label}</span>
              </div>
              {time && (
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '-4px' }}>{time}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ParkingSlotGrid
