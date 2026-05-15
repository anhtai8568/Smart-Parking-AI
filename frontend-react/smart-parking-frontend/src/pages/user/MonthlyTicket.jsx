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

const MonthlyTicket = () => {
  const location = useLocation();
  const { prefill, rejectReason } = location.state || {};

  const [currentUser] = useState(() => JSON.parse(localStorage.getItem('currentUser') || '{}'));

  const [vehicleType, setVehicleType] = useState(prefill?.vehicleType || 'motorbike');
  const [months, setMonths] = useState(prefill?.months || 1);
  const [formData, setFormData] = useState({
    licensePlate: prefill?.licensePlate || '',
    phone: prefill?.phone || '',
    brand: prefill?.brand || '',
    color: prefill?.color || '',
    paymentMethod: prefill?.paymentMethod || 'bank_transfer',
  });
  const [pricing, setPricing] = useState(null);
  const [existingSubs, setExistingSubs] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        if (!prefill) applyAutoSelect(subs);
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
  const bothRegistered = !!motorbikeSub && !!carSub;

  const selectedSub = vehicleType === 'motorbike' ? motorbikeSub : carSub;
  const isAlreadyRegistered = !!selectedSub;

  const pricePerMonth = useMemo(() => {
    if (!pricing) return 0;
    return vehicleType === 'motorbike'
      ? Number(pricing.monthlyPriceMotorbike || 0)
      : Number(pricing.monthlyPriceCar || 0);
  }, [pricing, vehicleType]);

  const totalAmount = useMemo(() => pricePerMonth * months, [pricePerMonth, months]);

  const handleTypeSelect = (type) => {
    const sub = type === 'motorbike' ? motorbikeSub : carSub;
    if (sub) return;
    setVehicleType(type);
    setError('');
    setSuccess('');
  };

  const handleSubmit = async () => {
    setError('');
    setSuccess('');

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

    setIsSubmitting(true);
    try {
      await api.post('/api/subscriptions', {
        username: currentUser.username,
        licensePlate,
        vehicleType,
        brand: formData.brand.trim(),
        color: formData.color.trim(),
        phone,
        months,
        paymentMethod: formData.paymentMethod,
      });

      setSuccess('Đã gửi yêu cầu đăng ký vé tháng. Vui lòng chờ duyệt.');
      setFormData({ licensePlate: '', phone: '', brand: '', color: '', paymentMethod: formData.paymentMethod });

      const subsRes = await api.get('/api/subscriptions/me', { params: { username: currentUser.username } });
      const refreshed = subsRes.data?.data || [];
      setExistingSubs(refreshed);
      applyAutoSelect(refreshed);
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
    const price = isMotorbike ? pricing?.monthlyPriceMotorbike : pricing?.monthlyPriceCar;
    const isSelected = vehicleType === type && !sub;
    const isDisabled = !!sub;

    const cardStyle = {
      padding: '24px',
      borderRadius: '20px',
      border: isSelected
        ? `2px solid ${accentColor}`
        : isDisabled
        ? `1px solid ${colors.border}`
        : `1px solid ${colors.border}`,
      backgroundColor: isSelected
        ? `${accentColor}0d`
        : isDisabled
        ? '#fafafa'
        : '#ffffff',
      cursor: isDisabled ? 'default' : 'pointer',
      transform: isSelected ? 'translateY(-4px)' : 'none',
      transition: 'all 0.25s ease',
      boxShadow: isSelected ? `0 8px 20px rgba(0,0,0,0.07)` : 'none',
      position: 'relative',
      overflow: 'hidden',
      opacity: isDisabled ? 0.92 : 1,
    };

    if (sub) {
      return (
        <div key={type} style={cardStyle}>
          <div style={{ marginBottom: '10px' }}>
            <span style={{ fontSize: '15px', fontWeight: '700', color: accentColor }}>{label}</span>
            <span style={{
              marginLeft: '10px',
              padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
              backgroundColor: STATUS_BG[sub.status] || '#f3f4f6',
              color: STATUS_COLOR[sub.status] || '#6b7280',
            }}>
              {STATUS_LABEL[sub.status] || sub.status}
            </span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: '800', letterSpacing: '2px', color: colors.textMain, marginBottom: '8px' }}>
            {sub.vehicleId?.licensePlate || '—'}
          </div>
          {sub.vehicleId?.brand && (
            <div style={{ fontSize: '13px', color: colors.textSub, marginBottom: '8px' }}>{sub.vehicleId.brand}</div>
          )}
          {sub.status === 'active' && sub.endDate && (
            <div style={{ fontSize: '13px', color: colors.textSub }}>
              Hết hạn: <strong style={{ color: colors.textMain }}>{fmtDate(sub.endDate)}</strong>
            </div>
          )}
          {sub.status === 'pending' && (
            <div style={{ fontSize: '12px', color: colors.textSub, fontStyle: 'italic' }}>
              Đang chờ admin duyệt
            </div>
          )}
        </div>
      );
    }

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

        {bothRegistered ? (
          <div style={{ padding: '30px', borderRadius: '16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', textAlign: 'center', color: '#15803d', fontWeight: '600' }}>
            Bạn đã đăng ký đủ cả 2 gói tháng (xe máy và ô tô).
          </div>
        ) : (
          <div style={{ backgroundColor: '#f1f5f9', padding: '30px', borderRadius: '20px', border: `1px solid ${colors.border}` }}>
            {isAlreadyRegistered ? (
              <div style={{ textAlign: 'center', padding: '20px', color: colors.textSub }}>
                Bạn đã có gói tháng cho loại xe này. Vui lòng chọn loại xe khác chưa đăng ký.
              </div>
            ) : (
              <>
                {rejectReason && (
                  <div style={{
                    marginBottom: '24px',
                    padding: '16px 20px',
                    backgroundColor: '#fff1f2',
                    border: '1px solid #fecdd3',
                    borderRadius: '14px',
                  }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#b91c1c', marginBottom: '6px' }}>
                      Yêu cầu trước của bạn không được duyệt
                    </div>
                    <div style={{ fontSize: '13px', color: '#7f1d1d', lineHeight: '1.6' }}>
                      Lý do: {rejectReason}
                    </div>
                    <div style={{ fontSize: '12px', color: '#b45309', marginTop: '8px', fontStyle: 'italic' }}>
                      Vui lòng kiểm tra lại thông tin và gửi yêu cầu mới.
                    </div>
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
                    <select style={inputStyle} value={formData.paymentMethod} onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}>
                      <option value="bank_transfer">Chuyển khoản</option>
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
                {success && <div style={{ marginTop: '16px', color: '#15803d', fontWeight: '600' }}>{success}</div>}

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
