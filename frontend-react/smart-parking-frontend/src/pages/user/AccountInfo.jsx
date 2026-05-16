import { useState, useEffect } from 'react'
import api from '../../services/api'

const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  border: '#e2e8f0',
  accent: '#2563eb',
  orange: '#d97706',
  textMain: '#1e293b',
  textSub: '#64748b',
}

function Field({ label, value, empty }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span style={{ fontSize: '11px', fontWeight: '700', color: C.textSub, textTransform: 'uppercase', letterSpacing: '1px' }}>
        {label}
      </span>
      <span style={{ fontSize: '15px', fontWeight: '600', color: empty ? C.textSub : C.textMain, fontStyle: empty ? 'italic' : 'normal' }}>
        {value || 'Chưa cập nhật'}
      </span>
    </div>
  )
}

function VehicleBadge({ sub }) {
  const plate = sub.vehicleId?.licensePlate || '—'
  const type = sub.vehicleType === 'motorbike' ? 'Xe máy' : 'Ô tô'
  const color = sub.vehicleType === 'motorbike' ? C.accent : C.orange

  const statusLabel = { active: 'Đang hoạt động', pending: 'Chờ duyệt', expired: 'Hết hạn', rejected: 'Bị từ chối' }
  const statusColor = { active: '#15803d', pending: '#b45309', expired: '#6b7280', rejected: '#b91c1c' }
  const statusBg = { active: '#dcfce7', pending: '#fef3c7', expired: '#f3f4f6', rejected: '#fee2e2' }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 16px',
      backgroundColor: C.bg,
      border: `1px solid ${C.border}`,
      borderLeft: `4px solid ${color}`,
      borderRadius: '10px',
    }}>
      <div>
        <div style={{ fontSize: '13px', color: C.textSub, marginBottom: '2px' }}>{type}</div>
        <div style={{ fontSize: '16px', fontWeight: '800', letterSpacing: '2px', color: C.textMain }}>{plate}</div>
      </div>
      <span style={{
        padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
        backgroundColor: statusBg[sub.status] || '#f3f4f6',
        color: statusColor[sub.status] || '#6b7280',
      }}>
        {statusLabel[sub.status] || sub.status}
      </span>
    </div>
  )
}

function AccountInfo() {
  const [currentUser] = useState(() => JSON.parse(localStorage.getItem('currentUser') || '{}'))
  const [profile, setProfile] = useState(null)
  const [subscriptions, setSubscriptions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUser.username) { setLoading(false); return }

    Promise.all([
      api.get('/api/users', { params: { q: currentUser.username, limit: 10 } }),
      api.get('/api/subscriptions/me', { params: { username: currentUser.username } }),
    ])
      .then(([usersRes, subRes]) => {
        const users = usersRes.data?.data || []
        const found = users.find((u) => u.username === currentUser.username)
        setProfile(found || null)
        setSubscriptions(subRes.data?.data || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [currentUser.username])

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: C.textSub, fontFamily: "'Inter', sans-serif" }}>
        Đang tải dữ liệu...
      </div>
    )
  }

  const displayName = profile?.fullName || currentUser.fullName || '—'
  const username = profile?.username || currentUser.username || '—'
  const phone = profile?.phone || null
  const email = profile?.email || null
  const status = profile?.status || 'active'

  const activeSubs = subscriptions.filter((s) => ['active', 'pending'].includes(s.status))

  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.bg, padding: '32px 24px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ marginBottom: '32px', borderLeft: `4px solid ${C.accent}`, paddingLeft: '16px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '800', margin: 0, color: C.textMain }}>
          Thông tin tài khoản
        </h1>
        <p style={{ margin: '4px 0 0', color: C.textSub, fontSize: '14px' }}>
          Smart Parking AI — Cổng thông tin người dùng
        </p>
      </div>

      <div style={{ maxWidth: '560px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Profile card */}
        <div style={{
          backgroundColor: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: '20px',
          padding: '28px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: C.textSub, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Hồ sơ cá nhân
            </div>
            <span style={{
              padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
              backgroundColor: status === 'active' ? '#dcfce7' : '#fee2e2',
              color: status === 'active' ? '#15803d' : '#b91c1c',
            }}>
              {status === 'active' ? 'Hoạt động' : 'Bị khóa'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <Field label="Họ và tên" value={displayName} />
            <Field label="Tên đăng nhập" value={username} />
            <Field label="Số điện thoại" value={phone} empty={!phone} />
            <Field label="Email" value={email} empty={!email} />
          </div>
        </div>

        {/* Vehicles card */}
        <div style={{
          backgroundColor: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: '20px',
          padding: '28px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
        }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: C.textSub, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>
            Xe đã đăng ký
          </div>

          {activeSubs.length === 0 ? (
            <div style={{ fontSize: '14px', color: C.textSub, fontStyle: 'italic' }}>
              Chưa có xe nào đăng ký gói tháng.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {activeSubs.map((sub) => (
                <VehicleBadge key={sub._id} sub={sub} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

export default AccountInfo
