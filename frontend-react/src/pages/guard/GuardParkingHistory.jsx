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

function toLocalInput(date) {
  const d = new Date(date)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function todayStart() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return toLocalInput(d)
}

const STATUS_LABEL = { in_progress: 'Đang gửi', completed: 'Đã ra', cancelled: 'Hủy' }
const STATUS_COLOR = { in_progress: '#b45309', completed: '#15803d', cancelled: '#6b7280' }
const STATUS_BG = { in_progress: '#fef3c7', completed: '#dcfce7', cancelled: '#f3f4f6' }

function GuardParkingHistory() {
  const [sessions, setSessions] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [plateFilter, setPlateFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const [shiftFrom, setShiftFrom] = useState(todayStart)
  const [shiftTo, setShiftTo] = useState(() => toLocalInput(new Date()))
  const [shiftLive, setShiftLive] = useState(true)

  const fetchSessions = async () => {
    try {
      setIsLoading(true)
      setError('')
      const params = { limit: 500 }
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

  useEffect(() => {
    if (!shiftLive) return
    setShiftTo(toLocalInput(new Date()))
    const id = setInterval(() => setShiftTo(toLocalInput(new Date())), 60_000)
    return () => clearInterval(id)
  }, [shiftLive])

  const displayed = sessions.filter((s) => {
    if (plateFilter.trim() && !s.licensePlate.includes(plateFilter.trim().toUpperCase())) return false
    if (dateFrom && new Date(s.entryAt) < new Date(dateFrom)) return false
    if (dateTo && new Date(s.entryAt) > new Date(dateTo)) return false
    return true
  })

  const shiftSessions = sessions.filter((s) => {
    if (s.status !== 'completed') return false
    const t = new Date(s.entryAt)
    return t >= new Date(shiftFrom) && t <= new Date(shiftTo)
  })
  const shiftVisitors = shiftSessions.filter((s) => s.isVisitor)
  const shiftMembers = shiftSessions.filter((s) => !s.isVisitor)
  const shiftCash = shiftVisitors.reduce((sum, s) => sum + (s.feeAmount || 0), 0)

  const inputStyle = {
    padding: '9px 14px', border: `1px solid ${C.border}`, borderRadius: '8px',
    fontSize: '14px', outline: 'none', color: C.textMain, backgroundColor: C.card,
  }

  const labelStyle = { fontSize: '12px', fontWeight: '600', color: C.textSub, marginBottom: '4px', display: 'block' }

  const hasDateFilter = dateFrom || dateTo

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

      {/* Shift summary */}
      <div style={{
        backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: '14px',
        padding: '20px', marginBottom: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}>
        <div style={{ fontWeight: '700', fontSize: '14px', color: C.textMain, marginBottom: '14px' }}>
          Tổng kết ca làm việc
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '16px' }}>
          <div>
            <label style={labelStyle}>Bắt đầu ca</label>
            <input
              style={{ ...inputStyle, width: '186px' }}
              type="datetime-local"
              value={shiftFrom}
              onChange={(e) => setShiftFrom(e.target.value)}
            />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Kết thúc ca</label>
              <button
                onClick={() => setShiftLive((v) => !v)}
                style={{
                  padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
                  border: 'none', cursor: 'pointer',
                  backgroundColor: shiftLive ? '#dcfce7' : '#f1f5f9',
                  color: shiftLive ? '#15803d' : C.textSub,
                }}
              >
                {shiftLive ? '● Trực tiếp' : '○ Thủ công'}
              </button>
            </div>
            <input
              style={{ ...inputStyle, width: '186px', opacity: shiftLive ? 0.6 : 1 }}
              type="datetime-local"
              value={shiftTo}
              disabled={shiftLive}
              onChange={(e) => setShiftTo(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '14px 16px' }}>
            <div style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: '600', marginBottom: '4px' }}>Xe thành viên</div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: C.textMain }}>{shiftMembers.length}</div>
            <div style={{ fontSize: '11px', color: C.textSub, marginTop: '2px' }}>lượt xe</div>
          </div>
          <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '12px', padding: '14px 16px' }}>
            <div style={{ fontSize: '12px', color: '#b45309', fontWeight: '600', marginBottom: '4px' }}>Xe vãng lai</div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: C.textMain }}>{shiftVisitors.length}</div>
            <div style={{ fontSize: '11px', color: C.textSub, marginTop: '2px' }}>lượt xe</div>
          </div>
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '12px', padding: '14px 16px' }}>
            <div style={{ fontSize: '12px', color: '#15803d', fontWeight: '600', marginBottom: '4px' }}>Tiền mặt thu được</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: C.textMain }}>{fmtCurrency(shiftCash)}</div>
            <div style={{ fontSize: '11px', color: C.textSub, marginTop: '2px' }}>từ xe vãng lai</div>
          </div>
          <div style={{ background: '#f8fafc', border: `1px solid ${C.border}`, borderRadius: '12px', padding: '14px 16px' }}>
            <div style={{ fontSize: '12px', color: C.textSub, fontWeight: '600', marginBottom: '4px' }}>Tổng lượt xe</div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: C.textMain }}>{shiftSessions.length}</div>
            <div style={{ fontSize: '11px', color: C.textSub, marginTop: '2px' }}>đã hoàn thành</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: '14px',
        padding: '16px', marginBottom: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={labelStyle}>Biển số</label>
            <input
              style={{ ...inputStyle, width: '180px' }}
              type="text"
              placeholder="Lọc biển số..."
              value={plateFilter}
              onChange={(e) => setPlateFilter(e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>Trạng thái</label>
            <select
              style={{ ...inputStyle, width: '150px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Tất cả</option>
              <option value="in_progress">Đang gửi</option>
              <option value="completed">Đã ra</option>
              <option value="cancelled">Hủy</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Từ</label>
            <input
              style={{ ...inputStyle, width: '180px' }}
              type="datetime-local"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>Đến</label>
            <input
              style={{ ...inputStyle, width: '180px' }}
              type="datetime-local"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          {hasDateFilter && (
            <button
              onClick={() => { setDateFrom(''); setDateTo('') }}
              style={{
                ...inputStyle, cursor: 'pointer', color: C.textSub,
                backgroundColor: '#f1f5f9', border: `1px solid ${C.border}`,
              }}
            >
              Xóa ngày
            </button>
          )}
        </div>
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
          {displayed.length} bản ghi{plateFilter || statusFilter || hasDateFilter ? ' (đang lọc)' : ''}
        </div>
      )}
    </div>
  )
}

export default GuardParkingHistory
