import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../../services/api';

const colors = {
  bg: '#f8fafc',
  card: '#ffffff',
  border: '#e2e8f0',
  accent: '#2563eb',
  orange: '#d97706',
  textMain: '#1e293b',
  textSub: '#64748b',
  inputBg: '#ffffff',
};

const STATUS_LABEL = {
  active: 'Đang hoạt động',
  pending: 'Chờ duyệt',
  expired: 'Hết hạn',
  rejected: 'Bị từ chối',
  cancelled: 'Đã hủy',
};

const STATUS_COLOR = { active: '#15803d', pending: '#b45309', expired: '#6b7280', rejected: '#b91c1c', cancelled: '#9ca3af' };
const STATUS_BG = { active: '#dcfce7', pending: '#fef3c7', expired: '#f3f4f6', rejected: '#fee2e2', cancelled: '#f3f4f6' };

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('vi-VN') : '—';
}

function fmtCurrency(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

function daysUntil(date) {
  return Math.ceil((new Date(date) - Date.now()) / 86400000);
}

function canRenew(sub) {
  if (!sub) return false;
  if (sub.status === 'expired') return true;
  if (sub.status === 'active' && sub.endDate) return daysUntil(sub.endDate) <= 30;
  return false;
}

const MonthlyTicket = () => {
  const location = useLocation();
  const { prefill, rejectReason, renewalTarget, viewPendingType } = location.state || {};

  const [currentUser] = useState(() => JSON.parse(localStorage.getItem('currentUser') || '{}'));

  const [vehicleType, setVehicleType] = useState(prefill?.vehicleType || renewalTarget?.vehicleType || viewPendingType || 'motorbike');
  const [months, setMonths] = useState(prefill?.months || 1);
  const [formData, setFormData] = useState({
    licensePlate: prefill?.licensePlate || '',
    phone: prefill?.phone || '',
    brand: prefill?.brand || '',
    color: prefill?.color || '',
    paymentMethod: renewalTarget ? 'sepay' : prefill?.paymentMethod || 'sepay',
  });
  const [pricing, setPricing] = useState(null);
  const [existingSubs, setExistingSubs] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [info, setInfo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [pendingSubId, setPendingSubId] = useState(null);
  const [renewalSub, setRenewalSub] = useState(null);
  const [renewalMonths, setRenewalMonths] = useState(1);
  const [isRenewalPoll, setIsRenewalPoll] = useState(false);

  const applyAutoSelect = (subs) => {
    const hasMotorbike = subs.some((s) => s.vehicleType === 'motorbike' && ['active', 'pending'].includes(s.status));
    const hasCar = subs.some((s) => s.vehicleType === 'car' && ['active', 'pending'].includes(s.status));
    if (hasMotorbike && !hasCar) setVehicleType('car');
    else if (hasCar && !hasMotorbike) setVehicleType('motorbike');
  };

  useEffect(() => {
    const init = async () => {
      try {
        setIsLoading(true);
        const [pricingRes, subsRes] = await Promise.all([
          api.get('/api/pricing/active'),
          currentUser.username
            ? api.get('/api/subscriptions/me', { params: { username: currentUser.username } })
            : Promise.resolve({ data: { data: [] } }),
        ]);
        setPricing(pricingRes.data?.data || null);
        const subs = subsRes.data?.data || [];
        setExistingSubs(subs);

        if (renewalTarget) {
          const targetSub = subs.find((s) => s._id === renewalTarget._id);
          if (targetSub) {
            setRenewalSub(targetSub);
            setVehicleType(targetSub.vehicleType || 'motorbike');
            if (targetSub.renewal?.code && !targetSub.renewal?.paidAt && targetSub.renewal?.qrUrl) {
              setPaymentInfo({
                qrUrl: targetSub.renewal.qrUrl,
                code: targetSub.renewal.code,
                amount: targetSub.renewal.amount,
                bank: null,
                account: null,
              });
              setPendingSubId(targetSub._id);
              setIsRenewalPoll(true);
              setInfo('Quét mã QR bên dưới để thanh toán gia hạn — hệ thống tự xác nhận sau khi nhận tiền.');
            }
          }
        } else {
          const sepayUnpaid = subs.find(
            (s) => s.status === 'pending' && s.paymentMethod === 'sepay' && s.paymentStatus !== 'paid' && s.paymentQrUrl
          );
          if (sepayUnpaid) {
            setPaymentInfo({ qrUrl: sepayUnpaid.paymentQrUrl, code: sepayUnpaid.paymentCode, amount: sepayUnpaid.totalAmount, bank: null, account: null });
            setPendingSubId(sepayUnpaid._id);
            setInfo('Quét mã QR bên dưới để thanh toán — hệ thống tự xác nhận sau khi nhận tiền.');
            setVehicleType(sepayUnpaid.vehicleType || 'motorbike');
          } else if (!prefill && !viewPendingType) {
            applyAutoSelect(subs);
          }
        }
      } catch (err) {
        setError(err?.response?.data?.message || 'Không tải được dữ liệu');
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const motorbikeSub = existingSubs.find(
    (s) => s.vehicleType === 'motorbike' && ['active', 'pending'].includes(s.status)
  );
  const carSub = existingSubs.find(
    (s) => s.vehicleType === 'car' && ['active', 'pending'].includes(s.status)
  );
  const motorbikeExpiredSub = !motorbikeSub
    ? existingSubs.find((s) => s.vehicleType === 'motorbike' && s.status === 'expired')
    : null;
  const carExpiredSub = !carSub
    ? existingSubs.find((s) => s.vehicleType === 'car' && s.status === 'expired')
    : null;

  const selectedSub = vehicleType === 'motorbike' ? motorbikeSub : carSub;
  const isAlreadyRegistered = !!selectedSub;

  const pricePerMonth = useMemo(() => {
    if (!pricing) return 0;
    return vehicleType === 'motorbike'
      ? Number(pricing.monthlyPriceMotorbike || 0)
      : Number(pricing.monthlyPriceCar || 0);
  }, [pricing, vehicleType]);

  const totalAmount = useMemo(() => pricePerMonth * months, [pricePerMonth, months]);

  const renewalPricePerMonth = useMemo(() => {
    if (!pricing || !renewalSub) return 0;
    return renewalSub.vehicleType === 'motorbike'
      ? Number(pricing.monthlyPriceMotorbike || 0)
      : Number(pricing.monthlyPriceCar || 0);
  }, [pricing, renewalSub]);

  const renewalTotalAmount = useMemo(() => renewalPricePerMonth * renewalMonths, [renewalPricePerMonth, renewalMonths]);

  const handleTypeSelect = (type) => {
    const sub = type === 'motorbike' ? motorbikeSub : carSub;
    setVehicleType(type);
    setError('');
    setSuccess('');
    setRenewalSub(null);
    setIsRenewalPoll(false);
    if (!sub) {
      setInfo('');
      setPaymentInfo(null);
      setPendingSubId(null);
    }
  };

  const handleStartRenewal = (sub) => {
    setRenewalSub(sub);
    setRenewalMonths(1);
    setError('');
    setSuccess('');
    if (sub.renewal?.code && !sub.renewal?.paidAt && sub.renewal?.qrUrl) {
      setPaymentInfo({
        qrUrl: sub.renewal.qrUrl,
        code: sub.renewal.code,
        amount: sub.renewal.amount,
        bank: null,
        account: null,
      });
      setPendingSubId(sub._id);
      setIsRenewalPoll(true);
      setInfo('Quét mã QR bên dưới để thanh toán gia hạn — hệ thống tự xác nhận sau khi nhận tiền.');
    } else {
      setPaymentInfo(null);
      setPendingSubId(null);
      setIsRenewalPoll(false);
      setInfo('');
    }
  };

  const handleSubmitRenewal = async () => {
    if (!renewalSub) return;
    setError('');
    setIsSubmitting(true);
    try {
      const res = await api.post(`/api/subscriptions/${renewalSub._id}/renew`, {
        username: currentUser.username,
        months: renewalMonths,
        paymentMethod: 'sepay',
      });
      const payment = res.data?.payment;
      if (payment) {
        setPaymentInfo({
          qrUrl: payment.qrUrl,
          code: payment.code,
          amount: payment.amount,
          bank: payment.bank,
          account: payment.account,
        });
        setPendingSubId(renewalSub._id);
        setIsRenewalPoll(true);
        setInfo('Quét mã QR bên dưới để thanh toán gia hạn — hệ thống tự xác nhận sau khi nhận tiền.');
        const subsRes = await api.get('/api/subscriptions/me', { params: { username: currentUser.username } });
        const refreshed = subsRes.data?.data || [];
        setExistingSubs(refreshed);
        const freshSub = refreshed.find((s) => s._id === renewalSub._id);
        if (freshSub) setRenewalSub(freshSub);
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể tạo yêu cầu gia hạn');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!pendingSubId || !currentUser.username) return;
    const interval = setInterval(async () => {
      try {
        const res = await api.get('/api/subscriptions/me', { params: { username: currentUser.username } });
        const subs = res.data?.data || [];
        const sub = subs.find((s) => s._id === pendingSubId);
        if (isRenewalPoll) {
          if (sub?.renewal?.paidAt) {
            clearInterval(interval);
            setPaymentInfo(null);
            setPendingSubId(null);
            setIsRenewalPoll(false);
            setRenewalSub(null);
            setInfo('');
            setSuccess('Gia hạn thành công! Gói tháng của bạn đã được gia hạn tự động.');
            setExistingSubs(subs);
          }
        } else {
          if (sub?.paymentStatus === 'paid') {
            clearInterval(interval);
            setPaymentInfo(null);
            setPendingSubId(null);
            setInfo('');
            setSuccess('Thanh toán thành công! Đơn đăng ký đang chờ admin phê duyệt.');
            setExistingSubs(subs);
            applyAutoSelect(subs);
          }
        }
      } catch { /* ignore polling errors */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [pendingSubId, currentUser.username, isRenewalPoll]);

  const handleSubmit = async () => {
    setError('');
    setSuccess('');
    setInfo('');
    setPaymentInfo(null);
    setPendingSubId(null);

    if (isAlreadyRegistered) {
      setError('Bạn đã có gói tháng cho loại xe này.');
      return;
    }

    const licensePlate = formData.licensePlate.trim();
    if (!licensePlate) { setError('Vui lòng nhập biển số xe'); return; }

    const phone = formData.phone.trim();
    if (!phone) { setError('Vui lòng nhập số điện thoại'); return; }

    if (!pricePerMonth) { setError('Bảng giá chưa sẵn sàng, vui lòng thử lại'); return; }

    if (!currentUser?.username) { setError('Vui lòng đăng nhập lại để tiếp tục'); return; }

    const selectedMethod = formData.paymentMethod;
    setIsSubmitting(true);
    try {
      const res = await api.post('/api/subscriptions', {
        username: currentUser.username,
        licensePlate,
        vehicleType,
        brand: formData.brand.trim(),
        color: formData.color.trim(),
        phone,
        months,
        paymentMethod: selectedMethod,
      });

      const subId = res.data?.data?._id;
      const hasSepayQr = Boolean(res.data?.payment && subId);

      if (hasSepayQr) {
        setPaymentInfo(res.data.payment);
        setPendingSubId(subId);
        setInfo('Quét mã QR bên dưới để thanh toán — hệ thống tự xác nhận sau khi nhận tiền.');
      } else {
        setSuccess('Đã gửi yêu cầu đăng ký vé tháng. Vui lòng chờ duyệt.');
      }
      setFormData({ licensePlate: '', phone: '', brand: '', color: '', paymentMethod: selectedMethod });

      const subsRes = await api.get('/api/subscriptions/me', { params: { username: currentUser.username } });
      const refreshed = subsRes.data?.data || [];
      setExistingSubs(refreshed);
      if (!hasSepayQr) applyAutoSelect(refreshed);
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể gửi yêu cầu đăng ký');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    backgroundColor: colors.inputBg,
    border: `1px solid ${colors.border}`,
    borderRadius: '12px',
    color: colors.textMain,
    marginTop: '8px',
    outline: 'none',
    boxSizing: 'border-box',
    fontSize: '15px',
  };

  const renderPlanCard = (type) => {
    const isMotorbike = type === 'motorbike';
    const label = isMotorbike ? 'Gói Xe Máy' : 'Gói Ô Tô';
    const accentColor = isMotorbike ? colors.accent : colors.orange;
    const sub = isMotorbike ? motorbikeSub : carSub;
    const expiredSub = isMotorbike ? motorbikeExpiredSub : carExpiredSub;
    const price = isMotorbike ? pricing?.monthlyPriceMotorbike : pricing?.monthlyPriceCar;
    const isFocused = vehicleType === type;

    const cardStyle = {
      padding: '24px',
      borderRadius: '20px',
      border: isFocused ? `2px solid ${accentColor}` : `1px solid ${colors.border}`,
      backgroundColor: isFocused ? `${accentColor}0d` : (sub || expiredSub) ? '#fafafa' : '#ffffff',
      cursor: 'pointer',
      transform: isFocused ? 'translateY(-4px)' : 'none',
      transition: 'all 0.25s ease',
      boxShadow: isFocused ? `0 8px 20px rgba(0,0,0,0.07)` : 'none',
      position: 'relative',
      overflow: 'hidden',
    };

    // Active or pending sub
    if (sub) {
      const isSepayUnpaid = sub.paymentMethod === 'sepay' && sub.paymentStatus !== 'paid';
      const renewalPending = sub.renewal?.code && !sub.renewal?.paidAt;
      const showRenewButton = sub.status === 'active' && canRenew(sub) && !renewalPending;
      const daysLeft = sub.status === 'active' && sub.endDate ? daysUntil(sub.endDate) : null;

      const handleShowQr = () => {
        if (!sub.paymentQrUrl) return;
        setPaymentInfo({
          qrUrl: sub.paymentQrUrl,
          code: sub.paymentCode,
          amount: sub.totalAmount,
          bank: null,
          account: null,
        });
        setPendingSubId(sub._id);
        setInfo('Quét mã QR bên dưới để thanh toán — hệ thống tự xác nhận sau khi nhận tiền.');
        setVehicleType(type);
      };

      const handleCancelUnpaid = async () => {
        if (!window.confirm('Hủy đơn đăng ký này và tạo đơn mới?')) return;
        try {
          await api.delete(`/api/subscriptions/${sub._id}/cancel-unpaid`, {
            data: { username: currentUser.username },
          });
          setPaymentInfo(null);
          setPendingSubId(null);
          setInfo('');
          setSuccess('');
          const subsRes = await api.get('/api/subscriptions/me', { params: { username: currentUser.username } });
          const refreshed = subsRes.data?.data || [];
          setExistingSubs(refreshed);
          setVehicleType(type);
        } catch (err) {
          setError(err?.response?.data?.message || 'Không thể hủy đơn');
        }
      };

      return (
        <div key={type} style={cardStyle} onClick={() => handleTypeSelect(type)}>
          <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '15px', fontWeight: '700', color: accentColor }}>{label}</span>
            <span style={{
              padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
              backgroundColor: isSepayUnpaid ? '#fef3c7' : (STATUS_BG[sub.status] || '#f3f4f6'),
              color: isSepayUnpaid ? '#b45309' : (STATUS_COLOR[sub.status] || '#6b7280'),
            }}>
              {isSepayUnpaid ? 'Chờ thanh toán' : (STATUS_LABEL[sub.status] || sub.status)}
            </span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: '800', letterSpacing: '2px', color: colors.textMain, marginBottom: '8px' }}>
            {sub.vehicleId?.licensePlate || '—'}
          </div>
          {sub.vehicleId?.brand && (
            <div style={{ fontSize: '13px', color: colors.textSub, marginBottom: '8px' }}>{sub.vehicleId.brand}</div>
          )}
          {sub.status === 'active' && sub.endDate && (
            <div style={{ fontSize: '13px', color: daysLeft !== null && daysLeft <= 7 ? '#b91c1c' : colors.textSub }}>
              Hết hạn: <strong style={{ color: daysLeft !== null && daysLeft <= 7 ? '#b91c1c' : colors.textMain }}>{fmtDate(sub.endDate)}</strong>
              {daysLeft !== null && daysLeft <= 30 && (
                <span style={{ marginLeft: '6px', fontSize: '12px', color: daysLeft <= 7 ? '#b91c1c' : '#b45309' }}>
                  ({daysLeft <= 0 ? 'Hôm nay' : `còn ${daysLeft} ngày`})
                </span>
              )}
            </div>
          )}
          {isSepayUnpaid && (
            <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {sub.paymentQrUrl && (
                <button onClick={(e) => { e.stopPropagation(); handleShowQr(); }} style={{
                  padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600',
                  backgroundColor: accentColor, color: '#fff', border: 'none', cursor: 'pointer',
                }}>
                  Xem QR thanh toán
                </button>
              )}
              <button onClick={(e) => { e.stopPropagation(); handleCancelUnpaid(); }} style={{
                padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600',
                backgroundColor: '#fff', color: '#b91c1c', border: '1px solid #fca5a5', cursor: 'pointer',
              }}>
                Hủy & đăng ký lại
              </button>
            </div>
          )}
          {sub.status === 'pending' && !isSepayUnpaid && (
            <div style={{ fontSize: '12px', color: colors.textSub, fontStyle: 'italic', marginTop: '6px' }}>
              Đang chờ admin duyệt
            </div>
          )}
          {showRenewButton && (
            <div style={{ marginTop: '10px' }}>
              <button onClick={(e) => { e.stopPropagation(); handleStartRenewal(sub); }} style={{
                padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600',
                backgroundColor: accentColor, color: '#fff', border: 'none', cursor: 'pointer',
              }}>
                Gia hạn →
              </button>
            </div>
          )}
          {sub.status === 'active' && renewalPending && (
            <div style={{ marginTop: '10px' }}>
              <button onClick={(e) => { e.stopPropagation(); handleStartRenewal(sub); }} style={{
                padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600',
                backgroundColor: accentColor, color: '#fff', border: 'none', cursor: 'pointer',
              }}>
                Xem QR gia hạn
              </button>
            </div>
          )}
        </div>
      );
    }

    // Expired sub — eligible for renewal
    if (expiredSub) {
      const renewalPending = expiredSub.renewal?.code && !expiredSub.renewal?.paidAt;
      return (
        <div key={type} style={cardStyle} onClick={() => handleTypeSelect(type)}>
          <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '15px', fontWeight: '700', color: accentColor }}>{label}</span>
            <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', backgroundColor: '#f3f4f6', color: '#6b7280' }}>
              Hết hạn
            </span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: '800', letterSpacing: '2px', color: colors.textMain, marginBottom: '8px' }}>
            {expiredSub.vehicleId?.licensePlate || '—'}
          </div>
          {expiredSub.endDate && (
            <div style={{ fontSize: '13px', color: '#b91c1c', marginBottom: '4px' }}>
              Đã hết hạn: {fmtDate(expiredSub.endDate)}
            </div>
          )}
          <div style={{ marginTop: '10px' }}>
            {renewalPending ? (
              <button onClick={(e) => { e.stopPropagation(); handleStartRenewal(expiredSub); }} style={{
                padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600',
                backgroundColor: accentColor, color: '#fff', border: 'none', cursor: 'pointer',
              }}>
                Xem QR gia hạn
              </button>
            ) : (
              <button onClick={(e) => { e.stopPropagation(); handleStartRenewal(expiredSub); }} style={{
                padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600',
                backgroundColor: accentColor, color: '#fff', border: 'none', cursor: 'pointer',
              }}>
                Gia hạn ngay →
              </button>
            )}
          </div>
        </div>
      );
    }

    // No sub — show pricing card
    const isSelected = vehicleType === type;
    return (
      <div key={type} style={cardStyle} onClick={() => handleTypeSelect(type)}>
        {isSelected && (
          <div style={{
            position: 'absolute', top: '12px', right: '12px',
            backgroundColor: accentColor, color: 'white',
            padding: '4px 12px', borderRadius: '20px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase',
          }}>
            Đang chọn
          </div>
        )}
        <h3 style={{ margin: '0 0 10px', color: accentColor, fontSize: '18px' }}>{label}</h3>
        <div style={{ fontSize: '30px', fontWeight: 'bold', marginBottom: '14px', color: colors.textMain }}>
          {fmtCurrency(price)}<span style={{ fontSize: '14px', color: colors.textSub, fontWeight: 'normal' }}>/tháng</span>
        </div>
        <div style={{ fontSize: '13px', color: colors.textSub, lineHeight: '1.7' }}>
          {isMotorbike
            ? <>• Gửi xe không giới hạn lượt ra vào<br />• Bảo quản tại khu vực có mái che<br />• Quản lý qua biển số AI</>
            : <>• Vị trí đỗ xe ưu tiên gần lối ra<br />• Hỗ trợ cứu hộ ắc quy miễn phí<br />• Camera giám sát 24/7 riêng biệt</>}
        </div>
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.bg, color: colors.textMain, padding: '40px 20px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', backgroundColor: colors.card, borderRadius: '24px', border: `1px solid ${colors.border}`, padding: '40px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>

        <div style={{ marginBottom: '40px', borderLeft: `4px solid ${colors.accent}`, paddingLeft: '20px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '800', margin: '0 0 8px', color: colors.textMain }}>ĐĂNG KÝ VÉ THÁNG</h1>
          <p style={{ color: colors.textSub, margin: 0 }}>Hệ thống quản lý gửi xe thông minh AI</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '40px' }}>
          {renderPlanCard('motorbike')}
          {renderPlanCard('car')}
        </div>

        {/* Thông báo + QR */}
        {(success || info || paymentInfo) && (
          <div style={{ backgroundColor: '#f1f5f9', padding: '24px 30px', borderRadius: '20px', border: `1px solid ${colors.border}`, marginBottom: '16px' }}>
            {success && <div style={{ marginBottom: info || paymentInfo ? '16px' : 0, color: '#15803d', fontWeight: '600' }}>{success}</div>}
            {info && <div style={{ marginBottom: paymentInfo ? '16px' : 0, padding: '12px 16px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', color: '#1d4ed8', fontWeight: '500', fontSize: '14px' }}>{info}</div>}
            {paymentInfo && !isRenewalPoll && pendingSubId && (() => {
              const pendingSub = existingSubs.find((s) => s._id === pendingSubId);
              if (!pendingSub) return null;
              const payMethodLabel = pendingSub.paymentMethod === 'sepay' ? 'SePay QR' : pendingSub.paymentMethod === 'bank_transfer' ? 'Chuyển khoản' : 'Tiền mặt';
              const vehicleTypeLabel = pendingSub.vehicleType === 'motorbike' ? 'Xe máy' : 'Ô tô';
              return (
                <div style={{ backgroundColor: '#fff', border: `1px solid ${colors.border}`, borderRadius: '14px', padding: '18px 20px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: colors.textMain, marginBottom: '2px' }}>Thông tin đăng ký</div>
                  {[
                    ['Biển số xe', pendingSub.vehicleId?.licensePlate || '—'],
                    ['Loại xe', vehicleTypeLabel],
                    ['Số tháng', `${pendingSub.months} tháng`],
                    ['Tổng tiền', fmtCurrency(pendingSub.totalAmount)],
                    ['Thanh toán', payMethodLabel],
                    ['SĐT liên hệ', pendingSub.contactPhone || '—'],
                    ['Ngày đăng ký', fmtDate(pendingSub.createdAt)],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: `1px solid ${colors.border}`, paddingBottom: '8px' }}>
                      <span style={{ color: colors.textSub }}>{label}</span>
                      <span style={{ fontWeight: '600', color: colors.textMain }}>{value}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
            {paymentInfo && (
              <div style={{ padding: '28px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, color: '#0369a1', fontSize: '16px', fontWeight: '700' }}>
                    {isRenewalPoll ? 'Quét mã QR để thanh toán gia hạn' : 'Quét mã QR để thanh toán'}
                  </h3>
                  <button onClick={() => {
                    setPaymentInfo(null);
                    setPendingSubId(null);
                    if (isRenewalPoll) setIsRenewalPoll(false);
                    setInfo('');
                  }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '20px', lineHeight: 1 }}>×</button>
                </div>
                <img src={paymentInfo.qrUrl} alt="QR thanh toán SePay" style={{ width: '220px', height: '220px', borderRadius: '12px', border: '2px solid #7dd3fc', display: 'block', margin: '0 auto 20px' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px', textAlign: 'left', backgroundColor: '#fff', padding: '16px', borderRadius: '12px' }}>
                  {paymentInfo.bank && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b' }}>Ngân hàng</span><strong>{paymentInfo.bank}</strong></div>}
                  {paymentInfo.account && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b' }}>Số tài khoản</span><strong>{paymentInfo.account}</strong></div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#64748b' }}>Nội dung chuyển khoản</span>
                    <strong style={{ color: '#2563eb', backgroundColor: '#dbeafe', padding: '3px 12px', borderRadius: '6px', letterSpacing: '1px', fontSize: '15px' }}>{paymentInfo.code}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                    <span style={{ color: '#64748b' }}>Số tiền</span>
                    <strong style={{ color: '#16a34a', fontSize: '18px' }}>{fmtCurrency(paymentInfo.amount)}</strong>
                  </div>
                </div>
                <p style={{ marginTop: '14px', fontSize: '12px', color: '#64748b', fontStyle: 'italic', lineHeight: '1.6' }}>
                  Nhập đúng nội dung chuyển khoản để hệ thống tự động xác nhận.<br />
                  {isRenewalPoll
                    ? 'Sau khi thanh toán, gói tháng của bạn sẽ được gia hạn tự động.'
                    : 'Sau khi thanh toán, admin sẽ phê duyệt đơn đăng ký của bạn.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Form section */}
        {!paymentInfo && (
          <div style={{ backgroundColor: '#f1f5f9', padding: '30px', borderRadius: '20px', border: `1px solid ${colors.border}` }}>
            {renewalSub ? (
              // Renewal form
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '15px', fontWeight: '700', color: colors.textMain }}>Gia hạn gói tháng</span>
                  <button onClick={() => setRenewalSub(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSub, fontSize: '20px', lineHeight: 1 }}>×</button>
                </div>
                <div style={{ backgroundColor: '#fff', border: `1px solid ${colors.border}`, borderRadius: '14px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    ['Biển số xe', renewalSub.vehicleId?.licensePlate || '—'],
                    ['Loại xe', renewalSub.vehicleType === 'motorbike' ? 'Xe máy' : 'Ô tô'],
                    ['Trạng thái', STATUS_LABEL[renewalSub.status] || renewalSub.status],
                    renewalSub.endDate ? ['Hết hạn', fmtDate(renewalSub.endDate)] : null,
                  ].filter(Boolean).map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderBottom: `1px solid ${colors.border}`, paddingBottom: '8px' }}>
                      <span style={{ color: colors.textSub }}>{label}</span>
                      <span style={{ fontWeight: '600', color: colors.textMain }}>{value}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <label style={{ color: colors.textMain, fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>Số Tháng Gia Hạn</label>
                  <select style={inputStyle} value={renewalMonths} onChange={(e) => setRenewalMonths(Number(e.target.value))}>
                    <option value={1}>01 Tháng</option>
                    <option value={3}>03 Tháng</option>
                    <option value={6}>06 Tháng</option>
                    <option value={12}>12 Tháng</option>
                  </select>
                </div>
                <div style={{ padding: '16px', backgroundColor: '#fff', borderRadius: '12px', border: `1px solid ${colors.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
                    <span style={{ color: colors.textSub }}>Đơn giá / tháng</span>
                    <strong>{fmtCurrency(renewalPricePerMonth)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px' }}>
                    <span style={{ color: colors.textSub }}>Tổng thanh toán ({renewalMonths} tháng)</span>
                    <strong style={{ color: colors.accent, fontSize: '18px' }}>{fmtCurrency(renewalTotalAmount)}</strong>
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: colors.textSub, padding: '10px 14px', backgroundColor: '#eff6ff', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
                  Gia hạn qua SePay QR — hệ thống tự động xác nhận sau khi nhận tiền.
                </div>
                {error && <div style={{ color: '#b91c1c', fontWeight: '600' }}>{error}</div>}
                <button
                  style={{
                    width: '100%', padding: '18px',
                    backgroundColor: colors.accent, color: 'white',
                    border: 'none', borderRadius: '12px',
                    fontWeight: 'bold', fontSize: '16px',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    opacity: isSubmitting ? 0.7 : 1,
                    boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
                  }}
                  disabled={isSubmitting}
                  onClick={handleSubmitRenewal}
                >
                  {isSubmitting ? 'ĐANG TẠO QR...' : 'XÁC NHẬN GIA HẠN — THANH TOÁN QR'}
                </button>
              </div>
            ) : isAlreadyRegistered && selectedSub?.status === 'pending' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '15px', fontWeight: '700', color: colors.textMain }}>Thông tin đơn đăng ký</span>
                  <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', backgroundColor: '#fef3c7', color: '#b45309' }}>Đang chờ admin duyệt</span>
                </div>
                <div style={{ backgroundColor: '#fff', border: `1px solid ${colors.border}`, borderRadius: '14px', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    ['Biển số xe', selectedSub.vehicleId?.licensePlate || '—'],
                    ['Loại xe', selectedSub.vehicleType === 'motorbike' ? 'Xe máy' : 'Ô tô'],
                    ['Số tháng', `${selectedSub.months} tháng`],
                    ['Tổng tiền', fmtCurrency(selectedSub.totalAmount)],
                    ['Thanh toán', selectedSub.paymentMethod === 'sepay' ? 'SePay QR' : selectedSub.paymentMethod === 'bank_transfer' ? 'Chuyển khoản' : 'Tiền mặt'],
                    ['SĐT liên hệ', selectedSub.contactPhone || '—'],
                    ['Ngày đăng ký', fmtDate(selectedSub.createdAt)],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderBottom: `1px solid ${colors.border}`, paddingBottom: '10px' }}>
                      <span style={{ color: colors.textSub }}>{label}</span>
                      <span style={{ fontWeight: '600', color: colors.textMain }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : motorbikeSub && carSub ? (
              <div style={{ padding: '30px', borderRadius: '16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', textAlign: 'center', color: '#15803d', fontWeight: '600' }}>
                Bạn đã đăng ký đủ cả 2 gói tháng (xe máy và ô tô).
              </div>
            ) : isAlreadyRegistered ? (
              <div style={{ textAlign: 'center', padding: '20px', color: colors.textSub }}>
                Bạn đã có gói tháng đang hoạt động cho loại xe này.
              </div>
            ) : (
              <>
                {rejectReason && (
                  <div style={{ marginBottom: '24px', padding: '16px 20px', backgroundColor: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '14px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#b91c1c', marginBottom: '6px' }}>Yêu cầu trước của bạn không được duyệt</div>
                    <div style={{ fontSize: '13px', color: '#7f1d1d', lineHeight: '1.6' }}>Lý do: {rejectReason}</div>
                    <div style={{ fontSize: '12px', color: '#b45309', marginTop: '8px', fontStyle: 'italic' }}>Vui lòng kiểm tra lại thông tin và gửi yêu cầu mới.</div>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px' }}>
                  <div>
                    <label style={{ color: colors.textMain, fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>Biển Số Xe</label>
                    <input style={inputStyle} placeholder="30A-XXXXX" value={formData.licensePlate} onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ color: colors.textMain, fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>Số Điện Thoại</label>
                    <input style={inputStyle} placeholder="0901234567" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ color: colors.textMain, fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>Loại Xe / Hiệu Xe</label>
                    <input style={inputStyle} placeholder="Ví dụ: Honda SH, Mazda 3..." value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ color: colors.textMain, fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>Số Tháng Đăng Ký</label>
                    <select style={inputStyle} value={months} onChange={(e) => setMonths(Number(e.target.value))}>
                      <option value={1}>01 Tháng</option>
                      <option value={3}>03 Tháng</option>
                      <option value={6}>06 Tháng</option>
                      <option value={12}>12 Tháng</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ color: colors.textMain, fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>Màu Xe</label>
                    <input style={inputStyle} placeholder="Ví dụ: Đen, Trắng..." value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ color: colors.textMain, fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>Phương Thức Thanh Toán</label>
                    <select style={inputStyle} value={formData.paymentMethod} onChange={(e) => { setFormData({ ...formData, paymentMethod: e.target.value }); setPaymentInfo(null); }}>
                      <option value="sepay">SePay QR (tự động xác nhận)</option>
                      <option value="bank_transfer">Chuyển khoản thủ công</option>
                      <option value="cash">Tiền mặt</option>
                    </select>
                  </div>
                </div>
                <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#fff', borderRadius: '12px', border: `1px solid ${colors.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
                    <span style={{ color: colors.textSub }}>Đơn giá / tháng</span>
                    <strong>{fmtCurrency(pricePerMonth)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px' }}>
                    <span style={{ color: colors.textSub }}>Tổng thanh toán ({months} tháng)</span>
                    <strong style={{ color: colors.accent, fontSize: '18px' }}>{fmtCurrency(totalAmount)}</strong>
                  </div>
                </div>
                {error && <div style={{ marginTop: '16px', color: '#b91c1c', fontWeight: '600' }}>{error}</div>}
                <button
                  style={{
                    width: '100%', padding: '18px',
                    backgroundColor: colors.accent, color: 'white',
                    border: 'none', borderRadius: '12px',
                    fontWeight: 'bold', fontSize: '16px', marginTop: '28px',
                    cursor: isLoading || isSubmitting ? 'not-allowed' : 'pointer',
                    opacity: isLoading || isSubmitting ? 0.7 : 1,
                    boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
                  }}
                  disabled={isLoading || isSubmitting}
                  onClick={handleSubmit}
                >
                  {isSubmitting ? 'ĐANG GỬI YÊU CẦU...' : 'TIẾN HÀNH ĐĂNG KÝ'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MonthlyTicket;
