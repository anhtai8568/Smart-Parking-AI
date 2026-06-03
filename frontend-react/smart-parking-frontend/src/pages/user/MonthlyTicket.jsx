import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../../services/api';

const colors = {
  bg: '#f8fafc', card: '#ffffff', border: '#e2e8f0', accent: '#2563eb',
  orange: '#d97706', textMain: '#1e293b', textSub: '#64748b', inputBg: '#ffffff',
};

const STATUS_LABEL = {
  active: 'Đang hoạt động', pending: 'Chờ duyệt', approved: 'Đã duyệt',
  expired: 'Hết hạn', rejected: 'Bị từ chối', cancelled: 'Đã hủy',
};
const STATUS_COLOR = { active: '#15803d', pending: '#b45309', approved: '#1d4ed8', expired: '#6b7280', rejected: '#b91c1c', cancelled: '#9ca3af' };
const STATUS_BG    = { active: '#dcfce7', pending: '#fef3c7', approved: '#dbeafe', expired: '#f3f4f6', rejected: '#fee2e2', cancelled: '#f3f4f6' };

function fmtDate(d) { return d ? new Date(d).toLocaleDateString('vi-VN') : '—'; }
function fmtCurrency(v) { return `${Number(v || 0).toLocaleString('vi-VN')}đ`; }

const MonthlyTicket = () => {
  const location = useLocation();
  const { prefill, rejectReason, viewPendingType } = location.state || {};

  const [currentUser] = useState(() => JSON.parse(localStorage.getItem('currentUser') || '{}'));
  const [vehicleType, setVehicleType] = useState(prefill?.vehicleType || viewPendingType || 'motorbike');
  const [months, setMonths] = useState(prefill?.months || 1);
  const [formData, setFormData] = useState({
    licensePlate: prefill?.licensePlate || '',
    phone: prefill?.phone || '',
    brand: prefill?.brand || '',
    color: prefill?.color || '',
  });
  const [pricing, setPricing] = useState(null);
  const [existingSubs, setExistingSubs] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const refreshSubs = async () => {
    if (!currentUser.username) return [];
    const res = await api.get('/api/subscriptions/me', { params: { username: currentUser.username } });
    const subs = res.data?.data || [];
    setExistingSubs(subs);
    return subs;
  };

  const applyAutoSelect = (subs) => {
    const hasMotorbike = subs.some((s) => s.vehicleType === 'motorbike' && ['active', 'pending', 'approved'].includes(s.status));
    const hasCar = subs.some((s) => s.vehicleType === 'car' && ['active', 'pending', 'approved'].includes(s.status));
    if (hasMotorbike && !hasCar) setVehicleType('motorbike');
    else if (hasCar && !hasMotorbike) setVehicleType('car');
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
        if (!prefill && !viewPendingType) applyAutoSelect(subs);
      } catch (err) {
        setError(err?.response?.data?.message || 'Không tải được dữ liệu');
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Polling khi đang ở trạng thái approved + chưa thanh toán
  useEffect(() => {
    const approvedUnpaid = existingSubs.find(
      (s) => s.vehicleType === vehicleType && s.status === 'approved' && s.paymentStatus !== 'paid'
    );
    if (!approvedUnpaid || !currentUser.username) return;

    const interval = setInterval(async () => {
      try {
        const subs = await refreshSubs();
        const updated = subs.find((s) => s._id === approvedUnpaid._id);
        if (updated?.paymentStatus === 'paid') {
          clearInterval(interval);
          setSuccess('Thanh toán thành công! Vui lòng đến gặp admin để nhận thẻ.');
        }
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [existingSubs, vehicleType]); // eslint-disable-line react-hooks/exhaustive-deps

  const motorbikeSub = existingSubs.find((s) => s.vehicleType === 'motorbike' && ['active', 'pending', 'approved'].includes(s.status));
  const carSub       = existingSubs.find((s) => s.vehicleType === 'car'       && ['active', 'pending', 'approved'].includes(s.status));
  const selectedSub  = vehicleType === 'motorbike' ? motorbikeSub : carSub;
  const isAlreadyRegistered = !!selectedSub;

  const pricePerMonth = useMemo(() => {
    if (!pricing) return 0;
    return vehicleType === 'motorbike' ? Number(pricing.monthlyPriceMotorbike || 0) : Number(pricing.monthlyPriceCar || 0);
  }, [pricing, vehicleType]);
  const totalAmount = useMemo(() => pricePerMonth * months, [pricePerMonth, months]);

  const handleTypeSelect = (type) => { setVehicleType(type); setError(''); setSuccess(''); setIsEditing(false); };

  const handleStartEdit = (sub) => {
    setEditData({ phone: sub.contactPhone || '', licensePlate: sub.vehicleId?.licensePlate || '', brand: sub.vehicleId?.brand || '', color: sub.vehicleId?.color || '', months: sub.months || 1 });
    setIsEditing(true); setError('');
  };
  const handleCancelEdit = () => { setIsEditing(false); setEditData({}); setError(''); };
  const handleSaveEdit = async (sub) => {
    setIsSavingEdit(true); setError('');
    try {
      await api.patch(`/api/subscriptions/${sub._id}`, { username: currentUser.username, ...editData });
      setIsEditing(false); setEditData({});
      await refreshSubs();
      setSuccess('Đã cập nhật thông tin.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể cập nhật');
    } finally { setIsSavingEdit(false); }
  };

  const handleSubmit = async () => {
    setError(''); setSuccess('');
    if (isAlreadyRegistered) { setError('Bạn đã có gói tháng cho loại xe này.'); return; }
    const licensePlate = formData.licensePlate.trim();
    if (!licensePlate) { setError('Vui lòng nhập biển số xe'); return; }
    const phone = formData.phone.trim();
    if (!phone) { setError('Vui lòng nhập số điện thoại'); return; }
    if (!pricePerMonth) { setError('Bảng giá chưa sẵn sàng'); return; }
    if (!currentUser?.username) { setError('Vui lòng đăng nhập lại'); return; }

    setIsSubmitting(true);
    try {
      await api.post('/api/subscriptions', {
        username: currentUser.username,
        licensePlate, vehicleType,
        brand: formData.brand.trim(),
        color: formData.color.trim(),
        phone, months,
      });
      setSuccess('Đã gửi yêu cầu đăng ký. Admin sẽ xem xét và phê duyệt sớm nhất có thể.');
      setFormData({ licensePlate: '', phone: '', brand: '', color: '' });
      await refreshSubs();
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể gửi yêu cầu đăng ký');
    } finally { setIsSubmitting(false); }
  };

  const inputStyle = {
    width: '100%', padding: '14px 16px', backgroundColor: colors.inputBg,
    border: `1px solid ${colors.border}`, borderRadius: '12px', color: colors.textMain,
    marginTop: '8px', outline: 'none', boxSizing: 'border-box', fontSize: '15px',
  };

  // ── Tab bar ──────────────────────────────────────────────────────────────
  const renderTabBar = () => {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '32px' }}>
        {['motorbike', 'car'].map((type) => {
          const isMotorbike = type === 'motorbike';
          const accentColor = isMotorbike ? colors.accent : colors.orange;
          const sub = isMotorbike ? motorbikeSub : carSub;
          const isActive = vehicleType === type;

          let badgeLabel = null, badgeColor = '#6b7280', badgeBg = '#f3f4f6';
          if (sub) {
            const isApprovedUnpaid = sub.status === 'approved' && sub.paymentStatus !== 'paid';
            const isApprovedPaid   = sub.status === 'approved' && sub.paymentStatus === 'paid';
            badgeLabel = isApprovedUnpaid ? 'Chờ thanh toán' : isApprovedPaid ? 'Chờ cấp thẻ' : (STATUS_LABEL[sub.status] || sub.status);
            badgeColor = isApprovedUnpaid ? '#b45309' : isApprovedPaid ? '#15803d' : (STATUS_COLOR[sub.status] || '#6b7280');
            badgeBg    = isApprovedUnpaid ? '#fef3c7'  : isApprovedPaid ? '#dcfce7'  : (STATUS_BG[sub.status]    || '#f3f4f6');
          }

          return (
            <button
              key={type}
              onClick={() => handleTypeSelect(type)}
              style={{
                padding: '18px 16px',
                borderRadius: '16px',
                border: isActive ? `2px solid ${accentColor}` : `1.5px solid ${colors.border}`,
                backgroundColor: isActive ? `${accentColor}10` : '#fff',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s',
                boxShadow: isActive ? `0 4px 14px ${accentColor}22` : 'none',
                userSelect: 'none',
              }}
            >
              <span style={{ fontSize: '28px', lineHeight: 1 }}>{isMotorbike ? '🏍' : '🚗'}</span>
              <span style={{ fontSize: '15px', fontWeight: '700', color: isActive ? accentColor : colors.textMain }}>
                {isMotorbike ? 'Xe Máy' : 'Ô Tô'}
              </span>
              {sub && badgeLabel && (
                <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 10px', borderRadius: '12px', color: badgeColor, backgroundColor: badgeBg }}>
                  {badgeLabel}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  // ── Price banner shown above the registration form ────────────────────────
  const renderPriceBanner = () => {
    const isMotorbike = vehicleType === 'motorbike';
    const accentColor = isMotorbike ? colors.accent : colors.orange;
    const price = isMotorbike ? pricing?.monthlyPriceMotorbike : pricing?.monthlyPriceCar;
    return (
      <div style={{ marginBottom: '24px', padding: '20px 24px', backgroundColor: `${accentColor}08`, border: `1px solid ${accentColor}30`, borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: accentColor, textTransform: 'uppercase', marginBottom: '4px' }}>
            {isMotorbike ? 'Gói Xe Máy' : 'Gói Ô Tô'}
          </div>
          <div style={{ fontSize: '13px', color: colors.textSub, lineHeight: '1.6' }}>
            {isMotorbike
              ? <>• Gửi xe không giới hạn lượt<br />• Khu vực có mái che · Quản lý AI</>
              : <>• Vị trí ưu tiên gần lối ra<br />• Camera 24/7 · Hỗ trợ cứu hộ ắc quy</>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '32px', fontWeight: '800', color: accentColor, lineHeight: 1 }}>
            {fmtCurrency(price)}
          </div>
          <div style={{ fontSize: '12px', color: colors.textSub }}>/ tháng</div>
        </div>
      </div>
    );
  };

  // ── Main content for the selected vehicle type ────────────────────────────
  const renderContent = () => {
    if (!selectedSub) {
      return (
        <div style={{ backgroundColor: '#f1f5f9', padding: '30px', borderRadius: '20px', border: `1px solid ${colors.border}` }}>
          {renderPriceBanner()}
          {rejectReason && (
            <div style={{ marginBottom: '24px', padding: '16px 20px', backgroundColor: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '14px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#b91c1c', marginBottom: '6px' }}>Yêu cầu trước của bạn không được duyệt</div>
              <div style={{ fontSize: '13px', color: '#7f1d1d' }}>Lý do: {rejectReason}</div>
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
              <label style={{ color: colors.textMain, fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>Hiệu Xe</label>
              <input style={inputStyle} placeholder="Honda SH, Mazda 3..." value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} />
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
              <input style={inputStyle} placeholder="Đen, Trắng..." value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} />
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
            style={{ width: '100%', padding: '18px', backgroundColor: colors.accent, color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '16px', marginTop: '28px', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1, boxShadow: '0 4px 14px rgba(37,99,235,0.35)' }}
            disabled={isLoading || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? 'ĐANG GỬI YÊU CẦU...' : 'TIẾN HÀNH ĐĂNG KÝ'}
          </button>
        </div>
      );
    }

    if (selectedSub.status === 'pending') {
      return (
        <div style={{ backgroundColor: '#f1f5f9', padding: '30px', borderRadius: '20px', border: `1px solid ${colors.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '15px', fontWeight: '700', color: colors.textMain }}>Thông tin đơn đăng ký</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', backgroundColor: '#fef3c7', color: '#b45309' }}>Đang chờ admin duyệt</span>
              {!isEditing && (
                <button onClick={() => handleStartEdit(selectedSub)} style={{ padding: '5px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', backgroundColor: colors.accent, color: '#fff', border: 'none', cursor: 'pointer' }}>
                  Sửa thông tin
                </button>
              )}
            </div>
          </div>

          {isEditing ? (
            <div style={{ backgroundColor: '#fff', border: `1px solid ${colors.accent}`, borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {[['phone', 'SĐT liên hệ'], ['licensePlate', 'Biển số xe'], ['brand', 'Hiệu xe'], ['color', 'Màu xe']].map(([key, label]) => (
                  <div key={key}>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: colors.textMain, textTransform: 'uppercase' }}>{label}</label>
                    <input style={inputStyle} value={editData[key] || ''} onChange={(e) => setEditData({ ...editData, [key]: e.target.value })} />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: colors.textMain, textTransform: 'uppercase' }}>Số tháng</label>
                  <select style={inputStyle} value={editData.months} onChange={(e) => setEditData({ ...editData, months: Number(e.target.value) })}>
                    <option value={1}>01 Tháng</option><option value={3}>03 Tháng</option>
                    <option value={6}>06 Tháng</option><option value={12}>12 Tháng</option>
                  </select>
                </div>
              </div>
              {error && <div style={{ color: '#b91c1c', fontWeight: '600', fontSize: '13px' }}>{error}</div>}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={handleCancelEdit} style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', backgroundColor: '#fff', color: colors.textSub, border: `1px solid ${colors.border}`, cursor: 'pointer' }}>Hủy</button>
                <button onClick={() => handleSaveEdit(selectedSub)} disabled={isSavingEdit} style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', backgroundColor: colors.accent, color: '#fff', border: 'none', cursor: isSavingEdit ? 'not-allowed' : 'pointer', opacity: isSavingEdit ? 0.7 : 1 }}>
                  {isSavingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ backgroundColor: '#fff', border: `1px solid ${colors.border}`, borderRadius: '14px', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                ['Biển số xe', selectedSub.vehicleId?.licensePlate || '—'],
                ['Loại xe', selectedSub.vehicleType === 'motorbike' ? 'Xe máy' : 'Ô tô'],
                ['Số tháng', `${selectedSub.months} tháng`],
                ['Tổng tiền', fmtCurrency(selectedSub.totalAmount)],
                ['SĐT liên hệ', selectedSub.contactPhone || '—'],
                ['Ngày đăng ký', fmtDate(selectedSub.createdAt)],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderBottom: `1px solid ${colors.border}`, paddingBottom: '10px' }}>
                  <span style={{ color: colors.textSub }}>{label}</span>
                  <span style={{ fontWeight: '600', color: colors.textMain }}>{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (selectedSub.status === 'approved') {
      const isPaid = selectedSub.paymentStatus === 'paid';
      return (
        <div style={{ backgroundColor: '#f1f5f9', padding: '30px', borderRadius: '20px', border: `1px solid ${colors.border}` }}>
          <div style={{ marginBottom: '20px', padding: '16px 20px', backgroundColor: isPaid ? '#f0fdf4' : '#eff6ff', border: `1px solid ${isPaid ? '#bbf7d0' : '#bfdbfe'}`, borderRadius: '14px' }}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: isPaid ? '#15803d' : '#1d4ed8', marginBottom: '4px' }}>
              {isPaid ? '✓ Đã thanh toán — chờ admin cấp thẻ' : 'Đơn đã được duyệt!'}
            </div>
            <div style={{ fontSize: '13px', color: isPaid ? '#166534' : '#1e40af' }}>
              {isPaid
                ? 'Vui lòng đến gặp admin để nhận thẻ gửi xe.'
                : 'Quét mã QR bên dưới để thanh toán online, hoặc đến gặp admin trả tiền mặt khi nhận thẻ.'}
            </div>
          </div>

          <div style={{ backgroundColor: '#fff', border: `1px solid ${colors.border}`, borderRadius: '14px', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: isPaid || !selectedSub.paymentQrUrl ? 0 : '20px' }}>
            {[
              ['Biển số xe', selectedSub.vehicleId?.licensePlate || '—'],
              ['Loại xe', selectedSub.vehicleType === 'motorbike' ? 'Xe máy' : 'Ô tô'],
              ['Số tháng', `${selectedSub.months} tháng`],
              ['Tổng tiền', fmtCurrency(selectedSub.totalAmount)],
              ['SĐT liên hệ', selectedSub.contactPhone || '—'],
              ['Ngày duyệt', fmtDate(selectedSub.approvedAt)],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderBottom: `1px solid ${colors.border}`, paddingBottom: '8px' }}>
                <span style={{ color: colors.textSub }}>{label}</span>
                <span style={{ fontWeight: '600', color: colors.textMain }}>{value}</span>
              </div>
            ))}
          </div>

          {!isPaid && selectedSub.paymentQrUrl && (
            <div style={{ padding: '28px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '16px', textAlign: 'center' }}>
              <h3 style={{ margin: '0 0 16px', color: '#0369a1', fontSize: '16px', fontWeight: '700' }}>Quét mã QR để thanh toán</h3>
              <img src={selectedSub.paymentQrUrl} alt="QR thanh toán" style={{ width: '220px', height: '220px', borderRadius: '12px', border: '2px solid #7dd3fc', display: 'block', margin: '0 auto 20px' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px', textAlign: 'left', backgroundColor: '#fff', padding: '16px', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b' }}>Nội dung chuyển khoản</span>
                  <strong style={{ color: '#2563eb', backgroundColor: '#dbeafe', padding: '3px 12px', borderRadius: '6px', letterSpacing: '1px' }}>{selectedSub.paymentCode}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                  <span style={{ color: '#64748b' }}>Số tiền</span>
                  <strong style={{ color: '#16a34a', fontSize: '18px' }}>{fmtCurrency(selectedSub.totalAmount)}</strong>
                </div>
              </div>
              <p style={{ marginTop: '14px', fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                Nhập đúng nội dung chuyển khoản để hệ thống tự xác nhận.<br />Sau đó đến gặp admin để nhận thẻ.
              </p>
            </div>
          )}
        </div>
      );
    }

    if (selectedSub.status === 'active') {
      const isCar = selectedSub.vehicleType === 'car';
      const licensePlate = selectedSub.vehicleId?.licensePlate || '';
      
      const handleDownloadArUco = () => {
        const downloadUrl = `http://localhost:8000/api/aruco/generate/${encodeURIComponent(licensePlate)}?size=500&label=true`;
        window.open(downloadUrl, '_blank');
      };

      return (
        <div style={{ backgroundColor: '#f1f5f9', padding: '30px', borderRadius: '20px', border: `1px solid ${colors.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '15px', fontWeight: '700', color: colors.textMain }}>Thông tin gói tháng đang sử dụng</span>
            <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', backgroundColor: '#dcfce7', color: '#15803d' }}>
              Đang hoạt động
            </span>
          </div>

          <div style={{ backgroundColor: '#fff', border: `1px solid ${colors.border}`, borderRadius: '14px', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            {[
              ['Biển số xe', licensePlate || '—'],
              ['Hiệu xe / Màu xe', `${selectedSub.vehicleId?.brand || '—'} / ${selectedSub.vehicleId?.color || '—'}`],
              ['Loại xe', selectedSub.vehicleType === 'motorbike' ? 'Xe máy' : 'Ô tô'],
              ['Ngày bắt đầu', fmtDate(selectedSub.startDate)],
              ['Ngày hết hạn', fmtDate(selectedSub.endDate)],
              ['SĐT liên hệ', selectedSub.contactPhone || '—'],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderBottom: `1px solid ${colors.border}`, paddingBottom: '8px' }}>
                <span style={{ color: colors.textSub }}>{label}</span>
                <span style={{ fontWeight: '600', color: colors.textMain }}>{value}</span>
              </div>
            ))}
          </div>

          {isCar && (
            <div style={{ padding: '24px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '16px', textAlign: 'center' }}>
              <h3 style={{ margin: '0 0 8px', color: '#166534', fontSize: '16px', fontWeight: '700' }}>Mã nhận diện ArUco thông minh</h3>
              <p style={{ fontSize: '13px', color: '#166534', margin: '0 0 16px', lineHeight: '1.5' }}>
                Gói tháng ô tô đi kèm một mã ArUco riêng biệt giúp hệ thống camera tự động quét và mở cổng từ xa. Vui lòng tải về và in dán ở mặt trước kính lái xe của bạn.
              </p>
              
              <button
                onClick={handleDownloadArUco}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#16a34a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 10px rgba(22,163,74,0.3)'
                }}
              >
                📥 Tải xuống mã ArUco của xe
              </button>
            </div>
          )}
        </div>
      );
    }

    // fallback for other statuses like expired, cancelled
    return (
      <div style={{ textAlign: 'center', padding: '20px', color: colors.textSub }}>
        Gói tháng cho loại xe này ở trạng thái: {STATUS_LABEL[selectedSub.status] || selectedSub.status}
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.bg, color: colors.textMain, padding: '40px 20px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '700px', margin: '0 auto', backgroundColor: colors.card, borderRadius: '24px', border: `1px solid ${colors.border}`, padding: '40px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>

        <div style={{ marginBottom: '32px', borderLeft: `4px solid ${colors.accent}`, paddingLeft: '20px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '800', margin: '0 0 8px', color: colors.textMain }}>ĐĂNG KÝ VÉ THÁNG</h1>
          <p style={{ color: colors.textSub, margin: 0 }}>Hệ thống quản lý gửi xe thông minh AI</p>
        </div>

        {renderTabBar()}

        {success && (
          <div style={{ marginBottom: '16px', padding: '14px 20px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', color: '#15803d', fontWeight: '600' }}>
            {success}
          </div>
        )}

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: colors.textSub }}>Đang tải...</div>
        ) : (
          renderContent()
        )}
      </div>
    </div>
  );
};

export default MonthlyTicket;
