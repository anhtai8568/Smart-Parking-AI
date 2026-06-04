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

const STATUS_LABEL = { active: 'Hoạt động', blocked: 'Bị khóa' }
const STATUS_COLOR = { active: '#15803d', blocked: '#b91c1c' }
const STATUS_BG = { active: '#dcfce7', blocked: '#fee2e2' }

function ManageUsers() {
  const [users, setUsers] = useState([])
  const [keyword, setKeyword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchUsers = async (q = keyword) => {
    try {
      setIsLoading(true)
      setError('')
      const params = {}
      if (q.trim()) params.q = q.trim()
      const res = await api.get('/api/users', { params })
      setUsers(res.data?.data || [])
    } catch (err) {
      setError(err?.response?.data?.message || 'Không tải được danh sách người dùng')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchUsers('') }, [])

  const handleKeyDown = (e) => { if (e.key === 'Enter') fetchUsers() }

  return (
    <div style={{ padding: '28px 24px', fontFamily: "'Inter', sans-serif", backgroundColor: C.bg, minHeight: '100vh' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: C.textMain }}>Quản lý người dùng</h2>
      </div>

      <div style={{
        backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: '14px',
        padding: '16px', display: 'flex', gap: '10px', marginBottom: '20px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}>
        <input
          style={{
            flex: 1, padding: '9px 14px', border: `1px solid ${C.border}`, borderRadius: '8px',
            fontSize: '14px', outline: 'none', color: C.textMain,
          }}
          type="text"
          placeholder="Tìm theo tên, tài khoản hoặc số điện thoại..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          onClick={() => fetchUsers()}
          disabled={isLoading}
          style={{
            padding: '9px 20px', backgroundColor: C.accent, color: 'white',
            border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600',
            cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.7 : 1,
          }}
        >
          {isLoading ? 'Đang tải...' : 'Tìm kiếm'}
        </button>
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
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ backgroundColor: C.bg }}>
              {['Họ tên', 'Tên đăng nhập', 'Số điện thoại', 'Email', 'Biển số mặc định', 'Trạng thái'].map((h) => (
                <th key={h} style={{
                  padding: '12px 16px', textAlign: 'left', fontWeight: '700',
                  color: C.textSub, fontSize: '12px', textTransform: 'uppercase',
                  letterSpacing: '0.5px', borderBottom: `1px solid ${C.border}`,
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: C.textSub, fontStyle: 'italic' }}>
                  {isLoading ? 'Đang tải...' : 'Không có dữ liệu'}
                </td>
              </tr>
            ) : (
              users.map((u, i) => (
                <tr key={u._id || i} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px 16px', fontWeight: '600', color: C.textMain }}>{u.fullName}</td>
                  <td style={{ padding: '12px 16px', color: C.textSub }}>{u.username}</td>
                  <td style={{ padding: '12px 16px', color: C.textSub }}>{u.phone || '—'}</td>
                  <td style={{ padding: '12px 16px', color: C.textSub }}>{u.email || '—'}</td>
                  <td style={{ padding: '12px 16px', fontWeight: '600', color: C.textMain, letterSpacing: '1px' }}>
                    {u.defaultVehicleId?.licensePlate || '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                      backgroundColor: STATUS_BG[u.status] || '#f3f4f6',
                      color: STATUS_COLOR[u.status] || '#6b7280',
                    }}>
                      {STATUS_LABEL[u.status] || u.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {users.length > 0 && (
        <div style={{ marginTop: '12px', fontSize: '13px', color: C.textSub }}>
          {users.length} người dùng
        </div>
      )}
    </div>
  )
}

export default ManageUsers
