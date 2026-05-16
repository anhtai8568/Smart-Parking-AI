import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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

const STATUS_LABEL = {
  active: 'Đang hoạt động',
  pending: 'Chờ duyệt',
  expired: 'Hết hạn',
  rejected: 'Bị từ chối',
  cancelled: 'Đã hủy',
}

const STATUS_COLOR = {
  active: '#15803d',
  pending: '#b45309',
  expired: '#6b7280',
  rejected: '#b91c1c',
  cancelled: '#9ca3af',
}

const STATUS_BG = {
  active: '#dcfce7',
  pending: '#fef3c7',
  expired: '#f3f4f6',
  rejected: '#fee2e2',
  cancelled: '#f3f4f6',
}

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('vi-VN') : '—'
}

function fmtCurrency(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`
}

function daysUntil(date) {
  return Math.ceil((new Date(date) - Date.now()) / 86400000)
}

function canRenew(sub) {
  if (!sub) return false
  if (sub.status === 'expired') return true
  if (sub.status === 'active' && sub.endDate) return daysUntil(sub.endDate) <= 30
  return false
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
      <span style={{ color: C.textSub }}>{label}</span>
      <span style={{ color: C.textMain, fontWeight: '600' }}>{value}</span>
    </div>
  )
}

function VehicleCard({ type, sub, rejectedSub, isParked, onViewRejected, onViewInfo, onRenew }) {
  const isMotorbike = type === 'motorbike'
  const label = isMotorbike ? 'Xe Máy' : 'Ô Tô'
  const color = isMotorbike ? C.accent : C.orange

  const cardBase = {
    backgroundColor: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: '20px',
    padding: '28px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  }

  const typeTag = (
    <div style={{ fontSize: '11px', fontWeight: '700', color, textTransform: 'uppercase', letterSpacing: '1.5px' }}>
      {label}
    </div>
  )

  // Bị từ chối — không có active/pending nhưng có rejected gần nhất
  if (!sub && rejectedSub) {
    const plate = rejectedSub.vehicleId?.licensePlate || '—'
    return (
      <div style={{ ...cardBase, borderTop: '4px solid #b91c1c' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {typeTag}
          <span style={{
            padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
            backgroundColor: '#fee2e2', color: '#b91c1c',
          }}>
            Không được duyệt
          </span>
        </div>

        <div style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '3px', color: C.textMain }}>
          {plate}
        </div>

        <div style={{ fontSize: '13px', color: C.textSub }}>
          Ấn nút bên dưới để xem lý do và đăng ký lại.
        </div>

        <button
          onClick={() => onViewRejected(rejectedSub)}
          style={{
            padding: '11px 0', width: '100%', marginTop: 'auto',
            backgroundColor: '#b91c1c', color: 'white',
            border: 'none', borderRadius: '10px',
            fontSize: '13px', fontWeight: '600', cursor: 'pointer',
          }}
        >
          Xem lý do &amp; Đăng ký lại →
        </button>
      </div>
    )
  }

  // Chưa đăng ký
  if (!sub) {
    return (
      <div style={{ ...cardBase, borderTop: `4px solid ${color}` }}>
        {typeTag}
        <div style={{ fontSize: '14px', color: C.textSub }}>Chưa đăng ký gói tháng</div>
        <div style={{ marginTop: 'auto' }}>
          <Link to="/user/monthly-ticket" style={{ textDecoration: 'none' }}>
            <button style={{
              padding: '11px 0', width: '100%',
              backgroundColor: color, color: 'white',
              border: 'none', borderRadius: '10px',
              fontSize: '13px', fontWeight: '600', cursor: 'pointer',
            }}>
              + Đăng ký ngay
            </button>
          </Link>
        </div>
      </div>
    )
  }

  const plate = sub.vehicleId?.licensePlate || '—'
  const brand = sub.vehicleId?.brand || ''
  const vehicleColor = sub.vehicleId?.color || ''
  const st = sub.status
  const isSepayUnpaid = st === 'pending' && sub.paymentMethod === 'sepay' && sub.paymentStatus !== 'paid'

  return (
    <div style={{ ...cardBase, borderTop: `4px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        {typeTag}
        <span style={{
          padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
          backgroundColor: isSepayUnpaid ? '#fef3c7' : (STATUS_BG[st] || '#f3f4f6'),
          color: isSepayUnpaid ? '#b45309' : (STATUS_COLOR[st] || '#6b7280'),
        }}>
          {isSepayUnpaid ? 'Chờ thanh toán' : (STATUS_LABEL[st] || st)}
        </span>
      </div>

      <div style={{ fontSize: '26px', fontWeight: '800', letterSpacing: '3px', color: C.textMain }}>
        {plate}
      </div>
      {(brand || vehicleColor) && (
        <div style={{ fontSize: '13px', color: C.textSub }}>
          {[brand, vehicleColor].filter(Boolean).join(' · ')}
        </div>
      )}

      {isParked && (
        <div>
          <span style={{
            padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
            backgroundColor: '#dcfce7', color: '#15803d',
          }}>
            Đang trong bãi
          </span>
        </div>
      )}

      {st === 'active' && sub.endDate && (() => {
        const days = daysUntil(sub.endDate)
        return (
          <div style={{ fontSize: '13px', color: days <= 7 ? '#b91c1c' : C.textSub }}>
            Hết hạn: <strong style={{ color: days <= 7 ? '#b91c1c' : C.textMain }}>{fmtDate(sub.endDate)}</strong>
            {days <= 30 && (
              <span style={{ marginLeft: '6px', color: days <= 7 ? '#b91c1c' : '#b45309' }}>
                ({days <= 0 ? 'Hôm nay' : `còn ${days} ngày`})
              </span>
            )}
          </div>
        )
      })()}

      {st === 'pending' && (
        <button
          onClick={() => onViewInfo(type)}
          style={{
            padding: '11px 0', width: '100%',
            backgroundColor: isSepayUnpaid ? color : 'transparent',
            color: isSepayUnpaid ? 'white' : color,
            border: isSepayUnpaid ? 'none' : `1px solid ${color}`,
            borderRadius: '10px',
            fontSize: '13px', fontWeight: '600', cursor: 'pointer',
          }}
        >
          {isSepayUnpaid ? 'Tiếp tục thanh toán QR →' : 'Xem thông tin đơn đăng ký →'}
        </button>
      )}

      {canRenew(sub) && (
        <button
          onClick={() => onRenew(sub)}
          style={{
            padding: '11px 0', width: '100%',
            backgroundColor: color, color: 'white',
            border: 'none', borderRadius: '10px',
            fontSize: '13px', fontWeight: '600', cursor: 'pointer',
          }}
        >
          {sub.renewal?.code && !sub.renewal?.paidAt ? 'Xem QR gia hạn →' : 'Gia hạn gói tháng →'}
        </button>
      )}
    </div>
  )
}

function Stat({ title, value, note }) {
  return (
    <div style={{
      backgroundColor: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: '16px',
      padding: '24px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
    }}>
      <div style={{ fontSize: '12px', color: C.textSub, marginBottom: '10px' }}>{title}</div>
      <div style={{ fontSize: '34px', fontWeight: '800', color: C.textMain, lineHeight: 1 }}>{value}</div>
      {note && <div style={{ fontSize: '12px', color: C.textSub, marginTop: '8px' }}>{note}</div>}
    </div>
  )
}

function DashboardUser() {
  const navigate = useNavigate()
  const [subscriptions, setSubscriptions] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}')

  useEffect(() => {
    if (!currentUser.username) { setLoading(false); return }

    Promise.all([
      api.get('/api/subscriptions/me', { params: { username: currentUser.username } }),
      api.get('/api/parking-history', { params: { username: currentUser.username, limit: 100 } }),
    ])
      .then(([subRes, histRes]) => {
        setSubscriptions(subRes.data?.data || [])
        setSessions(histRes.data?.data || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Active/pending subs
  const motorbikeSub = subscriptions.find(
    (s) => s.vehicleType === 'motorbike' && ['active', 'pending'].includes(s.status)
  )
  const carSub = subscriptions.find(
    (s) => s.vehicleType === 'car' && ['active', 'pending'].includes(s.status)
  )

  // Most recent rejected sub (only when no active/pending exists for that type)
  const motorbikeRejected = !motorbikeSub
    ? subscriptions.find((s) => s.vehicleType === 'motorbike' && s.status === 'rejected')
    : null
  const carRejected = !carSub
    ? subscriptions.find((s) => s.vehicleType === 'car' && s.status === 'rejected')
    : null

  const inProgressPlates = new Set(
    sessions.filter((s) => s.status === 'in_progress').map((s) => s.licensePlate)
  )

  const now = new Date()
  const thisMonthCount = sessions.filter((s) => {
    const d = new Date(s.entryAt)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  const activePackages = [motorbikeSub, carSub].filter((s) => s?.status === 'active').length

  const handleViewRejected = (sub) => {
    navigate('/user/monthly-ticket', {
      state: {
        prefill: {
          vehicleType: sub.vehicleType,
          licensePlate: sub.vehicleId?.licensePlate || '',
          phone: sub.contactPhone || '',
          brand: sub.vehicleId?.brand || '',
          color: sub.vehicleId?.color || '',
          months: sub.months,
          paymentMethod: sub.paymentMethod,
        },
        rejectReason: sub.notes || '',
      },
    })
  }

  const handleViewInfo = (vehicleType) => {
    navigate('/user/monthly-ticket', { state: { viewPendingType: vehicleType } })
  }

  const handleRenew = (sub) => {
    navigate('/user/monthly-ticket', { state: { renewalTarget: { _id: sub._id, vehicleType: sub.vehicleType } } })
  }

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: C.textSub, fontFamily: "'Inter', sans-serif" }}>
        Đang tải dữ liệu...
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.bg, padding: '32px 24px', fontFamily: "'Inter', sans-serif" }}>
<div style={{ fontSize: '11px', fontWeight: '700', color: C.textSub, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '14px' }}>
        Xe của bạn
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        <VehicleCard
          type="motorbike"
          sub={motorbikeSub}
          rejectedSub={motorbikeRejected}
          isParked={!!motorbikeSub && inProgressPlates.has(motorbikeSub.vehicleId?.licensePlate)}
          onViewRejected={handleViewRejected}
          onViewInfo={handleViewInfo}
          onRenew={handleRenew}
        />
        <VehicleCard
          type="car"
          sub={carSub}
          rejectedSub={carRejected}
          isParked={!!carSub && inProgressPlates.has(carSub.vehicleId?.licensePlate)}
          onViewRejected={handleViewRejected}
          onViewInfo={handleViewInfo}
          onRenew={handleRenew}
        />
      </div>

      <div style={{ marginTop: '36px' }}>
        <div style={{ fontSize: '11px', fontWeight: '700', color: C.textSub, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '14px' }}>
          Thống kê tháng {now.getMonth() + 1}/{now.getFullYear()}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          <Stat title="Số lần gửi xe" value={thisMonthCount} note="lượt trong tháng này" />
          <Stat title="Xe đang trong bãi" value={inProgressPlates.size} note="phương tiện" />
          <Stat title="Gói tháng hoạt động" value={activePackages} note="/ 2 gói tối đa" />
        </div>
      </div>
    </div>
  )
}

export default DashboardUser
