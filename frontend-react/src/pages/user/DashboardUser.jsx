import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Download } from 'lucide-react'
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

function VehicleCard({ type, sub, expiredSub, rejectedSub, isParked, onViewRejected, onViewInfo, onRenew }) {
  const isMotorbike = type === 'motorbike'
  const label = isMotorbike ? 'Xe Máy' : 'Ô Tô'
  const color = C.accent

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

  // Bị từ chối
  if (!sub && rejectedSub) {
    const plate = rejectedSub.vehicleId?.licensePlate || '—'
    return (
      <div style={{ ...cardBase, borderTop: '4px solid #b91c1c' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {typeTag}
          <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', backgroundColor: '#fee2e2', color: '#b91c1c' }}>
            Không được duyệt
          </span>
        </div>
        <div style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '3px', color: C.textMain }}>{plate}</div>
        <div style={{ fontSize: '13px', color: C.textSub }}>Ấn nút bên dưới để xem lý do và đăng ký lại.</div>
        <button
          onClick={() => onViewRejected(rejectedSub)}
          style={{ padding: '11px 0', width: '100%', marginTop: 'auto', backgroundColor: '#b91c1c', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
        >
          Xem lý do &amp; Đăng ký lại →
        </button>
      </div>
    )
  }

  // Hết hạn — chưa có active/pending
  if (!sub && expiredSub) {
    const plate = expiredSub.vehicleId?.licensePlate || '—'
    const renewalPending = expiredSub.renewal?.code && !expiredSub.renewal?.paidAt
    return (
      <div style={{ ...cardBase, borderTop: `4px solid ${color}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {typeTag}
          <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', backgroundColor: '#f3f4f6', color: '#6b7280' }}>
            Hết hạn
          </span>
        </div>
        <div style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '3px', color: C.textMain }}>{plate}</div>
        {expiredSub.endDate && (
          <div style={{ fontSize: '13px', color: '#b91c1c' }}>Đã hết hạn: {fmtDate(expiredSub.endDate)}</div>
        )}
        <button
          onClick={() => onRenew(expiredSub)}
          style={{ padding: '11px 0', width: '100%', marginTop: 'auto', backgroundColor: color, color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
        >
          {renewalPending ? 'Xem QR gia hạn →' : 'Gia hạn ngay →'}
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
          <Link to="/user/monthly-ticket" state={{ viewPendingType: type }} style={{ textDecoration: 'none' }}>
            <button style={{ padding: '11px 0', width: '100%', backgroundColor: color, color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
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
  const renewalPending = sub.renewal?.code && !sub.renewal?.paidAt

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
        {st === 'active' && !isMotorbike && (
          <a
            href={`http://localhost:8000/api/aruco/generate/${encodeURIComponent(plate)}?size=500&label=true`}
            target="_blank"
            rel="noreferrer"
            title="Tải mã AprilTag"
            style={{ marginLeft: 'auto', color: '#16a34a', display: 'flex', alignItems: 'center' }}
          >
            <Download size={16} strokeWidth={2} />
          </a>
        )}
      </div>

      <div style={{ fontSize: '26px', fontWeight: '800', letterSpacing: '3px', color: C.textMain }}>{plate}</div>
      {(brand || vehicleColor) && (
        <div style={{ fontSize: '13px', color: C.textSub }}>{[brand, vehicleColor].filter(Boolean).join(' · ')}</div>
      )}

      {isParked && (
        <div>
          <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', backgroundColor: '#dcfce7', color: '#15803d' }}>
            Đang trong bãi
          </span>
        </div>
      )}

      {st === 'active' && sub.endDate && (() => {
        const days = daysUntil(sub.endDate)
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', color: days <= 7 ? '#b91c1c' : C.textSub }}>
            <div>
              Hết hạn: <strong style={{ color: days <= 7 ? '#b91c1c' : C.textMain }}>{fmtDate(sub.endDate)}</strong>
              {days <= 30 && (
                <span style={{ marginLeft: '6px', color: days <= 7 ? '#b91c1c' : '#b45309' }}>
                  ({days <= 0 ? 'Hôm nay' : `còn ${days} ngày`})
                </span>
              )}
            </div>
            {canRenew(sub) && (
              <button
                onClick={() => onRenew(sub)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color, fontSize: '13px', fontWeight: '700', padding: 0, whiteSpace: 'nowrap' }}
              >
                {renewalPending ? 'Xem QR →' : 'Gia hạn →'}
              </button>
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
            borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
          }}
        >
          {isSepayUnpaid ? 'Tiếp tục thanh toán QR →' : 'Xem thông tin đơn đăng ký →'}
        </button>
      )}

    </div>
  )
}

function Stat({ title, value, note }) {
  return (
    <div style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '24px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
      <div style={{ fontSize: '12px', color: C.textSub, marginBottom: '10px' }}>{title}</div>
      <div style={{ fontSize: '34px', fontWeight: '800', color: C.textMain, lineHeight: 1 }}>{value}</div>
      {note && <div style={{ fontSize: '12px', color: C.textSub, marginTop: '8px' }}>{note}</div>}
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '12px 14px',
  backgroundColor: '#fff', border: `1px solid ${C.border}`,
  borderRadius: '10px', color: C.textMain,
  marginTop: '6px', outline: 'none',
  boxSizing: 'border-box', fontSize: '14px',
}

function DashboardUser() {
  const navigate = useNavigate()
  const [subscriptions, setSubscriptions] = useState([])
  const [sessions, setSessions] = useState([])
  const [pricing, setPricing] = useState(null)
  const [loading, setLoading] = useState(true)

  // Renewal modal state
  const [renewModal, setRenewModal] = useState(null)
  const [renewMonths, setRenewMonths] = useState(1)
  const [renewPaymentInfo, setRenewPaymentInfo] = useState(null)
  const [renewPollId, setRenewPollId] = useState(null)
  const [renewSubmitting, setRenewSubmitting] = useState(false)
  const [renewError, setRenewError] = useState('')
  const [renewSuccess, setRenewSuccess] = useState('')

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}')

  useEffect(() => {
    if (!currentUser.username) { setLoading(false); return }

    Promise.all([
      api.get('/api/subscriptions/me', { params: { username: currentUser.username } }),
      api.get('/api/parking-history', { params: { username: currentUser.username, limit: 100 } }),
      api.get('/api/pricing/active'),
    ])
      .then(([subRes, histRes, pricingRes]) => {
        setSubscriptions(subRes.data?.data || [])
        setSessions(histRes.data?.data || [])
        setPricing(pricingRes.data?.data || null)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Poll for renewal payment confirmation
  useEffect(() => {
    if (!renewPollId || !currentUser.username) return
    const interval = setInterval(async () => {
      try {
        const res = await api.get('/api/subscriptions/me', { params: { username: currentUser.username } })
        const subs = res.data?.data || []
        const sub = subs.find((s) => s._id === renewPollId)
        if (sub?.renewal?.paidAt) {
          clearInterval(interval)
          setRenewPollId(null)
          setRenewPaymentInfo(null)
          setRenewSuccess('Gia hạn thành công! Gói tháng của bạn đã được gia hạn tự động.')
          setSubscriptions(subs)
          setTimeout(() => { setRenewModal(null); setRenewSuccess('') }, 2500)
        }
      } catch { /* ignore */ }
    }, 3000)
    return () => clearInterval(interval)
  }, [renewPollId, currentUser.username]) // eslint-disable-line react-hooks/exhaustive-deps

  // Active/pending subs
  const motorbikeSub = subscriptions.find(
    (s) => s.vehicleType === 'motorbike' && ['active', 'pending'].includes(s.status)
  )
  const carSub = subscriptions.find(
    (s) => s.vehicleType === 'car' && ['active', 'pending'].includes(s.status)
  )

  // Expired subs (only when no active/pending for that type)
  const motorbikeExpiredSub = !motorbikeSub
    ? subscriptions.find((s) => s.vehicleType === 'motorbike' && s.status === 'expired')
    : null
  const carExpiredSub = !carSub
    ? subscriptions.find((s) => s.vehicleType === 'car' && s.status === 'expired')
    : null

  // Most recent rejected sub
  const motorbikeRejected = !motorbikeSub && !motorbikeExpiredSub
    ? subscriptions.find((s) => s.vehicleType === 'motorbike' && s.status === 'rejected')
    : null
  const carRejected = !carSub && !carExpiredSub
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

  // Renewal price
  const renewPricePerMonth = renewModal && pricing
    ? (renewModal.vehicleType === 'motorbike'
      ? Number(pricing.monthlyPriceMotorbike || 0)
      : Number(pricing.monthlyPriceCar || 0))
    : 0
  const renewTotalAmount = renewPricePerMonth * renewMonths

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
    setRenewModal(sub)
    setRenewMonths(1)
    setRenewError('')
    setRenewSuccess('')
    if (sub.renewal?.code && !sub.renewal?.paidAt && sub.renewal?.qrUrl) {
      setRenewPaymentInfo({
        qrUrl: sub.renewal.qrUrl,
        code: sub.renewal.code,
        amount: sub.renewal.amount,
      })
      setRenewPollId(sub._id)
    } else {
      setRenewPaymentInfo(null)
      setRenewPollId(null)
    }
  }

  const closeRenewModal = () => {
    setRenewModal(null)
    setRenewPaymentInfo(null)
    setRenewPollId(null)
    setRenewError('')
    setRenewSuccess('')
  }

  const handleSubmitRenewal = async () => {
    if (!renewModal) return
    setRenewError('')
    setRenewSubmitting(true)
    try {
      const res = await api.post(`/api/subscriptions/${renewModal._id}/renew`, {
        username: currentUser.username,
        months: renewMonths,
        paymentMethod: 'sepay',
      })
      const payment = res.data?.payment
      if (payment) {
        setRenewPaymentInfo({
          qrUrl: payment.qrUrl,
          code: payment.code,
          amount: payment.amount,
          bank: payment.bank,
          account: payment.account,
        })
        setRenewPollId(renewModal._id)
        const subsRes = await api.get('/api/subscriptions/me', { params: { username: currentUser.username } })
        setSubscriptions(subsRes.data?.data || [])
      }
    } catch (err) {
      setRenewError(err?.response?.data?.message || 'Không thể tạo yêu cầu gia hạn')
    } finally {
      setRenewSubmitting(false)
    }
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
          expiredSub={motorbikeExpiredSub}
          rejectedSub={motorbikeRejected}
          isParked={!!motorbikeSub && inProgressPlates.has(motorbikeSub.vehicleId?.licensePlate)}
          onViewRejected={handleViewRejected}
          onViewInfo={handleViewInfo}
          onRenew={handleRenew}
        />
        <VehicleCard
          type="car"
          sub={carSub}
          expiredSub={carExpiredSub}
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

      {/* Modal gia hạn */}
      {renewModal && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}
          onClick={(e) => { if (e.target === e.currentTarget) closeRenewModal() }}
        >
          <div style={{ backgroundColor: '#fff', borderRadius: '24px', padding: '32px', maxWidth: '460px', width: '100%', boxShadow: '0 25px 50px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: C.textMain }}>Gia hạn gói tháng</div>
                <div style={{ fontSize: '13px', color: C.textSub, marginTop: '2px' }}>
                  {renewModal.vehicleType === 'motorbike' ? 'Xe Máy' : 'Ô Tô'} — {renewModal.vehicleId?.licensePlate || '—'}
                </div>
              </div>
              <button onClick={closeRenewModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textSub, fontSize: '24px', lineHeight: 1, padding: '4px' }}>×</button>
            </div>

            {renewSuccess ? (
              <div style={{ textAlign: 'center', padding: '30px 0' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>✓</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#15803d' }}>{renewSuccess}</div>
              </div>
            ) : renewPaymentInfo ? (
              // QR hiển thị
              <div>
                <div style={{ padding: '20px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#0369a1', marginBottom: '14px' }}>Quét mã QR để thanh toán gia hạn</div>
                  <img src={renewPaymentInfo.qrUrl} alt="QR gia hạn" style={{ width: '200px', height: '200px', borderRadius: '12px', border: '2px solid #7dd3fc', display: 'block', margin: '0 auto 16px' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', textAlign: 'left', backgroundColor: '#fff', padding: '14px', borderRadius: '10px' }}>
                    {renewPaymentInfo.bank && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: C.textSub }}>Ngân hàng</span>
                        <strong>{renewPaymentInfo.bank}</strong>
                      </div>
                    )}
                    {renewPaymentInfo.account && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: C.textSub }}>Số tài khoản</span>
                        <strong>{renewPaymentInfo.account}</strong>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: C.textSub }}>Nội dung CK</span>
                      <strong style={{ color: C.accent, backgroundColor: '#dbeafe', padding: '2px 10px', borderRadius: '6px', letterSpacing: '1px' }}>{renewPaymentInfo.code}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${C.border}`, paddingTop: '8px' }}>
                      <span style={{ color: C.textSub }}>Số tiền</span>
                      <strong style={{ color: '#16a34a', fontSize: '16px' }}>{fmtCurrency(renewPaymentInfo.amount)}</strong>
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: C.textSub, marginTop: '12px', fontStyle: 'italic', lineHeight: '1.6' }}>
                    Nhập đúng nội dung chuyển khoản.<br />Hệ thống tự xác nhận và gia hạn sau khi nhận tiền.
                  </div>
                </div>
                <div style={{ marginTop: '12px', fontSize: '12px', color: '#b45309', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#b45309', animation: 'pulse 1.5s infinite' }} />
                  Đang chờ xác nhận thanh toán...
                </div>
              </div>
            ) : (
              // Form chọn tháng
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {renewModal.endDate && (
                  <div style={{ padding: '12px 14px', backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '10px', fontSize: '13px', color: '#c2410c' }}>
                    {renewModal.status === 'expired'
                      ? `Gói đã hết hạn từ ${fmtDate(renewModal.endDate)}`
                      : `Hết hạn: ${fmtDate(renewModal.endDate)} — còn ${Math.max(0, daysUntil(renewModal.endDate))} ngày`}
                  </div>
                )}

                <div>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: C.textMain, textTransform: 'uppercase' }}>Số tháng gia hạn</label>
                  <select style={inputStyle} value={renewMonths} onChange={(e) => setRenewMonths(Number(e.target.value))}>
                    <option value={1}>01 Tháng</option>
                    <option value={3}>03 Tháng</option>
                    <option value={6}>06 Tháng</option>
                    <option value={12}>12 Tháng</option>
                  </select>
                </div>

                <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '12px', border: `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
                    <span style={{ color: C.textSub }}>Đơn giá / tháng</span>
                    <strong>{fmtCurrency(renewPricePerMonth)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px' }}>
                    <span style={{ color: C.textSub }}>Tổng ({renewMonths} tháng)</span>
                    <strong style={{ color: C.accent, fontSize: '17px' }}>{fmtCurrency(renewTotalAmount)}</strong>
                  </div>
                </div>

                <div style={{ fontSize: '12px', color: C.textSub, padding: '10px 12px', backgroundColor: '#eff6ff', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
                  Thanh toán qua SePay QR — hệ thống tự động xác nhận và gia hạn.
                </div>

                {renewError && <div style={{ color: '#b91c1c', fontSize: '13px', fontWeight: '600' }}>{renewError}</div>}

                <button
                  onClick={handleSubmitRenewal}
                  disabled={renewSubmitting || !pricing}
                  style={{
                    padding: '16px', width: '100%', backgroundColor: C.accent, color: '#fff',
                    border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '15px',
                    cursor: renewSubmitting || !pricing ? 'not-allowed' : 'pointer',
                    opacity: renewSubmitting || !pricing ? 0.7 : 1,
                    boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
                  }}
                >
                  {renewSubmitting ? 'Đang tạo QR...' : 'Xác nhận gia hạn — Thanh toán QR'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default DashboardUser
