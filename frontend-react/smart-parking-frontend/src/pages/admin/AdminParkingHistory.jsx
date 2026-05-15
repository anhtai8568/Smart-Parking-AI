import { useEffect, useState } from 'react'
import api from '../../services/api'

const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  border: '#e2e8f0',
  accent: '#2563eb',
  textMain: '#1e293b',
  textSub: '#64748b',
}

function fmtDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

function fmtDuration(minutes) {
  if (!minutes && minutes !== 0) return '—'
  if (minutes < 60) return `${minutes} phút`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}g ${m}p` : `${h} giờ`
}

function fmtCurrency(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`
}

const STATUS_LABEL = { in_progress: 'Đang gửi', completed: 'Đã ra', cancelled: 'Hủy' }
const STATUS_COLOR = { in_progress: '#b45309', completed: '#15803d', cancelled: '#6b7280' }
const STATUS_BG = { in_progress: '#fef3c7', completed: '#dcfce7', cancelled: '#f3f4f6' }

function AdminParkingHistory() {
  const [sessions, setSessions] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [plateFilter, setPlateFilter] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchSessions = async () => {
    try {
      setIsLoading(true)
      setError('')
      const params = { limit: 200 }
      if (statusFilter) params.status = statusFilter
      const res = await api.get('/api/parking-history', { params })
      setSessions(res.data?.data || [])
    } catch (err) {
      setError(err?.response?.data?.message || 'Không tải được lịch sử xe vào/ra')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchSessions() }, [statusFilter])

  const displayed = plateFilter.trim()
    ? sessions.filter((s) => s.licensePlate.includes(plateFilter.trim().toUpperCase()))
    : sessions

  const inputStyle = {
    padding: '9px 14px', border: `1px solid ${C.border}`, borderRadius: '8px',
    fontSize: '14px', outline: 'none', color: C.textMain, backgroundColor: C.card,
  }

  return (
    <div style={{ padding: '28px 24px', fontFamily: "'Inter', sans-serif", backgroundColor: C.bg, minHeight: '100vh' }}>
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: C.textMain }}>Lịch sử xe vào/ra</h2>
        <button
          onClick={fetchSessions}
          disabled={isLoading}
          style={{
            padding: '9px 18px', border: `1px solid ${C.border}`, borderRadius: '8px',
            backgroundColor: C.card, fontSize: '14px', fontWeight: '600', color: C.textMain,
            cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.7 : 1,
          }}
        >
          {isLoading ? 'Đang tải...' : 'Làm mới'}
        </button>
      </div>

      <div style={{
        backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: '14px',
        padding: '16px', display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}>
        <input
          style={{ ...inputStyle, width: '200px' }}
          type="text"
          placeholder="Lọc biển số..."
          value={plateFilter}
          onChange={(e) => setPlateFilter(e.target.value)}
        />
        <select
          style={{ ...inputStyle, width: '160px' }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="in_progress">Đang gửi</option>
          <option value="completed">Đã ra</option>
          <option value="cancelled">Hủy</option>
        </select>
      </div>

      {error && (
        <div style={{
          marginBottom: '16px', padding: '12px 16px', backgroundColor: '#fee2e2',
          border: '1px solid #fecdd3', borderRadius: '10px', color: '#b91c1c', fontSize: '14px',
        }}>
          {error}
        </div>
      )}

      <div style={{
        backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: '14px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'auto',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ backgroundColor: C.bg }}>
              {['Biển số', 'Loại xe', 'Loại khách', 'Giờ vào', 'Giờ ra', 'Thời gian', 'Phí', 'Trạng thái'].map((h) => (
                <th key={h} style={{
                  padding: '12px 16px', textAlign: 'left', fontWeight: '700',
                  color: C.textSub, fontSize: '12px', textTransform: 'uppercase',
                  letterSpacing: '0.5px', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayed.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: C.textSub, fontStyle: 'italic' }}>
                  {isLoading ? 'Đang tải...' : 'Không có dữ liệu'}
                </td>
              </tr>
            ) : (
              displayed.map((s, i) => (
                <tr key={s._id || i} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px 16px', fontWeight: '700', color: C.textMain, letterSpacing: '1px', whiteSpace: 'nowrap' }}>
                    {s.licensePlate}
                  </td>
                  <td style={{ padding: '12px 16px', color: C.textSub }}>
                    {s.vehicleType === 'motorbike' ? 'Xe máy' : 'Ô tô'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
                      backgroundColor: s.isVisitor ? '#fef3c7' : '#eff6ff',
                      color: s.isVisitor ? '#b45309' : '#1d4ed8',
                    }}>
                      {s.isVisitor ? 'Vãng lai' : 'Thành viên'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: C.textSub, whiteSpace: 'nowrap' }}>{fmtDateTime(s.entryAt)}</td>
                  <td style={{ padding: '12px 16px', color: C.textSub, whiteSpace: 'nowrap' }}>{fmtDateTime(s.exitAt)}</td>
                  <td style={{ padding: '12px 16px', color: C.textSub }}>{fmtDuration(s.durationMinutes)}</td>
                  <td style={{ padding: '12px 16px', fontWeight: '600', color: C.textMain }}>{fmtCurrency(s.feeAmount)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
                      backgroundColor: STATUS_BG[s.status] || '#f3f4f6',
                      color: STATUS_COLOR[s.status] || '#6b7280',
                    }}>
                      {STATUS_LABEL[s.status] || s.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {displayed.length > 0 && (
        <div style={{ marginTop: '12px', fontSize: '13px', color: C.textSub }}>
          {displayed.length} bản ghi{plateFilter || statusFilter ? ' (đang lọc)' : ''}
        </div>
      )}
    </div>
  )
}

export default AdminParkingHistory
