import { useState, useEffect, useCallback } from 'react'
import api from '../../services/api'

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
  const [slots, setSlots]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [resetting, setResetting]   = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [error, setError]           = useState(null)

  const fetchSlots = useCallback(async () => {
    try {
      const res = await api.get('/api/slots')
      setSlots(res.data.data || [])
      setLastUpdated(new Date())
      setError(null)
    } catch (err) {
      setError('Không thể lấy dữ liệu chỗ đỗ xe')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Lần đầu load + polling mỗi 3 giây (realtime từ cảm biến Mega → MQTT → DB)
  useEffect(() => {
    fetchSlots()
    const interval = setInterval(fetchSlots, 3000)
    return () => clearInterval(interval)
  }, [fetchSlots])

  const handleReset = async () => {
    if (!confirm('Reset tất cả chỗ đỗ về trạng thái trống?')) return
    setResetting(true)
    try {
      await api.post('/api/slots/reset')
      await fetchSlots()
    } catch (err) {
      alert('Lỗi reset: ' + err.message)
    } finally {
      setResetting(false)
    }
  }

  const available = slots.filter(s => s.status === 'available').length
  const occupied  = slots.filter(s => s.status === 'occupied').length
  const total     = slots.filter(s => s.status !== 'maintenance').length

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
        <div style={{ display: 'inline-block', width: '20px', height: '20px', border: '2px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.7s linear infinite', marginRight: '8px' }} />
        Đang tải dữ liệu chỗ đỗ xe...
      </div>
    )
  }

  return (
    <div style={{ marginTop: '12px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h3 className="card-title" style={{ margin: 0 }}>Chỗ đỗ xe ô tô</h3>
          {/* Chấm xanh nhấp nháy – realtime indicator */}
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#16a34a', fontWeight: 700 }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            Live
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Badge trống */}
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#15803d', fontWeight: 700, background: '#f0fdf4', border: '1px solid #86efac', padding: '4px 12px', borderRadius: '20px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
            {available}/{total} trống
          </span>

          {/* Badge có xe */}
          {occupied > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#b91c1c', fontWeight: 700, background: '#fef2f2', border: '1px solid #fca5a5', padding: '4px 12px', borderRadius: '20px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
              {occupied} đang đỗ
            </span>
          )}

          {/* Nút reset */}
          <button
            id="btn-reset-slots"
            onClick={handleReset}
            disabled={resetting}
            title="Reset toàn bộ chỗ đỗ về trạng thái trống (dùng khi cảm biến bị lỗi)"
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '4px 10px', borderRadius: '8px', border: '1px solid #fde68a',
              background: '#fffbeb', color: '#92400e', fontWeight: 700, fontSize: '12px',
              cursor: resetting ? 'not-allowed' : 'pointer', opacity: resetting ? 0.6 : 1,
              transition: '0.15s ease',
            }}
          >
            {resetting ? '⏳' : '🔄'} Reset
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ padding: '8px 14px', borderRadius: '10px', background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Grid slots */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {slots.map(slot => {
          const st   = STATUS[slot.status] || STATUS.available
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
              <div style={{ fontSize: '13px', fontWeight: 800, color: st.color, letterSpacing: '1px', textTransform: 'uppercase' }}>
                {slot.code}
              </div>
              <CarIcon color={slot.status === 'occupied' ? st.color : '#cbd5e1'} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: st.dot, display: 'inline-block', flexShrink: 0 }} />
                <span style={{ fontSize: '12px', fontWeight: 700, color: st.color }}>{st.label}</span>
              </div>
              {time && (
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '-4px' }}>{time}</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Thời gian cập nhật lần cuối */}
      {lastUpdated && (
        <div style={{ marginTop: '10px', fontSize: '11px', color: '#94a3b8', textAlign: 'right' }}>
          Cập nhật lúc {lastUpdated.toLocaleTimeString('vi-VN')} · Tự động làm mới mỗi 3s
        </div>
      )}
    </div>
  )
}

export default ParkingSlotGrid
