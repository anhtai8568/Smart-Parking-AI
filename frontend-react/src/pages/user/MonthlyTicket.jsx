import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../../services/api';
import { 
  Car, Bike, Calendar, CreditCard, CheckCircle, AlertTriangle, 
  Download, Edit2, Phone, ShieldCheck, Info, Lock, ChevronRight,
  AlertCircle, RefreshCw, XCircle, Copy, Check, User, Info as InfoIcon
} from 'lucide-react';

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
  
  // Trạng thái edit thông tin đơn pending
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Xử lý trùng lặp biển số (Tranh chấp chính chủ)
  const [conflictData, setConflictData] = useState(null); // { licensePlate, conflictingUser }
  
  // Copy nội dung chuyển khoản
  const [copied, setCopied] = useState(false);

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

  // Polling khi đang ở trạng thái pending hoặc approved (chờ thanh toán & kích hoạt)
  useEffect(() => {
    const needsPolling = existingSubs.find(
      (s) => s.vehicleType === vehicleType && (s.status === 'pending' || s.status === 'approved')
    );
    if (!needsPolling || !currentUser.username) return;

    const interval = setInterval(async () => {
      try {
        const subs = await refreshSubs();
        const updated = subs.find((s) => s._id === needsPolling._id);
        
        if (!updated) {
          clearInterval(interval);
          return;
        }

        // Trường hợp 1: Từ pending -> approved
        if (needsPolling.status === 'pending' && updated.status === 'approved') {
          setSuccess('Yêu cầu đăng ký đã được duyệt! Vui lòng tiến hành thanh toán.');
        }
        
        // Trường hợp 2: Từ pending -> rejected
        if (needsPolling.status === 'pending' && updated.status === 'rejected') {
          clearInterval(interval);
          setError(`Yêu cầu đăng ký bị từ chối. Lý do: ${updated.notes || 'Không có'}`);
        }

        // Trường hợp 3: Nhận tiền thanh toán (chuyển sang paid)
        if (needsPolling.paymentStatus !== 'paid' && updated.paymentStatus === 'paid') {
          setSuccess('Thanh toán thành công! Đang chờ kích hoạt gói tháng...');
        }

        // Trường hợp 4: Được kích hoạt thành công (status chuyển thành active)
        if (updated.status === 'active') {
          clearInterval(interval);
          setSuccess('Chúc mừng! Vé tháng của bạn đã được kích hoạt thành công.');
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
    setEditData({ 
      phone: sub.contactPhone || '', 
      licensePlate: sub.vehicleId?.licensePlate || '', 
      brand: sub.vehicleId?.brand || '', 
      color: sub.vehicleId?.color || '', 
      months: sub.months || 1 
    });
    setIsEditing(true); setError('');
  };
  
  const handleCancelEdit = () => { setIsEditing(false); setEditData({}); setError(''); };
  
  const handleSaveEdit = async (sub) => {
    setIsSavingEdit(true); setError('');
    try {
      await api.patch(`/api/subscriptions/${sub._id}`, { username: currentUser.username, ...editData });
      setIsEditing(false); setEditData({});
      await refreshSubs();
      setSuccess('Đã cập nhật thông tin thành công.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể cập nhật thông tin');
    } finally { setIsSavingEdit(false); }
  };

  const handleCopyCode = () => {
    if (!selectedSub?.paymentCode) return;
    navigator.clipboard.writeText(selectedSub.paymentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        isDispute: false
      });
      setSuccess('Đã gửi yêu cầu đăng ký thành công. Hệ thống đang chờ Admin xem xét phê duyệt.');
      setFormData({ licensePlate: '', phone: '', brand: '', color: '' });
      await refreshSubs();
    } catch (err) {
      if (err?.response?.status === 409 && err.response.data?.code === 'DUPLICATE_PLATE') {
        // Trùng biển số với tài khoản khác
        setConflictData(err.response.data.details);
      } else {
        setError(err?.response?.data?.message || 'Không thể gửi yêu cầu đăng ký');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDispute = async () => {
    setError(''); setSuccess('');
    setIsSubmitting(true);
    const licensePlate = formData.licensePlate.trim();
    const phone = formData.phone.trim();
    const disputePlate = conflictData?.licensePlate || licensePlate;
    setConflictData(null);
    try {
      await api.post('/api/subscriptions', {
        username: currentUser.username,
        licensePlate: disputePlate, 
        vehicleType,
        brand: formData.brand.trim(),
        color: formData.color.trim(),
        phone, months,
        isDispute: true
      });
      setSuccess('Đã gửi yêu cầu xác minh tranh chấp biển số thành công. Admin sẽ kiểm tra giấy tờ xe và liên hệ hỗ trợ bạn sớm nhất.');
      setFormData({ licensePlate: '', phone: '', brand: '', color: '' });
      await refreshSubs();
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể gửi yêu cầu xác minh tranh chấp');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Tab bar ──────────────────────────────────────────────────────────────
  const renderTabBar = () => {
    return (
      <div className="tab-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
        {['motorbike', 'car'].map((type) => {
          const isMotorbike = type === 'motorbike';
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
              className={`tab-btn ${isActive ? (isMotorbike ? 'active-motorbike' : 'active-car') : ''}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {isMotorbike ? <Bike size={24} color={isActive ? '#2563eb' : '#64748b'} /> : <Car size={24} color={isActive ? '#d97706' : '#64748b'} />}
                <span style={{ fontSize: '16px', fontWeight: '700', color: isActive ? (isMotorbike ? '#2563eb' : '#d97706') : '#1e293b' }}>
                  {isMotorbike ? 'Xe Máy' : 'Ô Tô'}
                </span>
              </div>
              {sub && badgeLabel && (
                <span className="badge-status" style={{ color: badgeColor, backgroundColor: badgeBg, marginTop: '6px' }}>
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
    const accentColor = isMotorbike ? '#2563eb' : '#d97706';
    const price = isMotorbike ? pricing?.monthlyPriceMotorbike : pricing?.monthlyPriceCar;
    return (
      <div className={`banner-price ${isMotorbike ? 'motorbike' : 'car'}`}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: '800', color: accentColor, textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={16} /> {isMotorbike ? 'Gói tháng Xe Máy' : 'Gói tháng Ô Tô'}
          </div>
          <div style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.7', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {isMotorbike ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Check size={14} color="#16a34a" /> Gửi xe không giới hạn lượt vào/ra</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Check size={14} color="#16a34a" /> Khu vực đỗ có mái che bảo vệ</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Check size={14} color="#16a34a" /> Quản lý bằng công nghệ AI camera nhận dạng</div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Check size={14} color="#16a34a" /> Cấp mã nhận diện AprilTag dán kính lái</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Check size={14} color="#16a34a" /> Camera AI nhận diện từ xa tự động mở barrier</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Check size={14} color="#16a34a" /> Vị trí đỗ xe ô tô ưu tiên gần lối ra vào</div>
              </>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '32px', fontWeight: '800', color: accentColor, lineHeight: 1 }}>
            {fmtCurrency(price)}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', fontWeight: '500' }}>/ tháng</div>
        </div>
      </div>
    );
  };

  // ── Main content for the selected vehicle type ────────────────────────────
  const renderContent = () => {
    const isMotorbike = vehicleType === 'motorbike';
    const accentColor = isMotorbike ? '#2563eb' : '#d97706';

    if (!selectedSub) {
      return (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          {renderPriceBanner()}
          {rejectReason && (
            <div style={{ marginBottom: '24px', padding: '16px 20px', backgroundColor: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '14px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <XCircle color="#dc2626" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#b91c1c', marginBottom: '4px' }}>Yêu cầu trước bị từ chối</div>
                <div style={{ fontSize: '13px', color: '#9f1239', lineHeight: '1.5' }}>Lý do: {rejectReason}</div>
              </div>
            </div>
          )}
          
          <div className="form-grid">
            <div className="input-group">
              <label className="input-label"><CreditCard size={14} /> Biển Số Xe</label>
              <input 
                className="input-field" 
                placeholder="Ví dụ: 30A-12345" 
                value={formData.licensePlate} 
                onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value })} 
              />
              <div className="input-icon-wrapper"><CreditCard size={18} /></div>
            </div>
            
            <div className="input-group">
              <label className="input-label"><Phone size={14} /> Số Điện Thoại</label>
              <input 
                className="input-field" 
                placeholder="Ví dụ: 0987654321" 
                type="tel"
                value={formData.phone} 
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })} 
              />
              <div className="input-icon-wrapper"><Phone size={18} /></div>
            </div>

            <div className="input-group">
              <label className="input-label"><Car size={14} /> Hiệu Xe</label>
              <input 
                className="input-field" 
                placeholder="Ví dụ: Honda SH, Mazda 3..." 
                value={formData.brand} 
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })} 
              />
              <div className="input-icon-wrapper"><Car size={18} /></div>
            </div>

            <div className="input-group">
              <label className="input-label"><Calendar size={14} /> Thời Hạn Đăng Ký</label>
              <select 
                className="input-field" 
                style={{ paddingLeft: '44px', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' }}
                value={months} 
                onChange={(e) => setMonths(Number(e.target.value))}
              >
                <option value={1}>01 Tháng (Gói chuẩn)</option>
                <option value={3}>03 Tháng (Tiết kiệm 5%)</option>
                <option value={6}>06 Tháng (Tiết kiệm 10%)</option>
                <option value={12}>12 Tháng (Tặng 1 tháng)</option>
              </select>
              <div className="input-icon-wrapper"><Calendar size={18} /></div>
            </div>

            <div className="input-group" style={{ gridColumn: 'span 2' }}>
              <label className="input-label"><Edit2 size={14} /> Màu Sắc Xe</label>
              <input 
                className="input-field" 
                placeholder="Ví dụ: Đỏ đen, Trắng ngọc trai..." 
                value={formData.color} 
                onChange={(e) => setFormData({ ...formData, color: e.target.value })} 
              />
              <div className="input-icon-wrapper"><Edit2 size={18} /></div>
            </div>
          </div>

          <div style={{ marginTop: '24px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '10px' }}>
              <span style={{ color: '#64748b', fontWeight: '500' }}>Đơn giá / tháng:</span>
              <strong style={{ color: '#1e293b' }}>{fmtCurrency(pricePerMonth)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
              <span style={{ color: '#64748b', fontWeight: '600' }}>Tổng chi phí ({months} tháng):</span>
              <strong style={{ color: accentColor, fontSize: '20px', fontWeight: '800' }}>{fmtCurrency(totalAmount)}</strong>
            </div>
          </div>

          {error && <div style={{ marginTop: '16px', color: '#dc2626', fontWeight: '600', display: 'flex', gap: '8px', alignItems: 'center', fontSize: '14px' }}><AlertCircle size={16} /> {error}</div>}
          
          <button
            className={`btn-submit ${isMotorbike ? 'motorbike' : 'car'}`}
            disabled={isLoading || isSubmitting}
            onClick={handleSubmit}
            style={{ marginTop: '28px' }}
          >
            {isSubmitting ? (
              <>
                <RefreshCw size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                ĐANG XỬ LÝ...
              </>
            ) : (
              <>
                ĐĂNG KÝ VÉ THÁNG NGAY <ChevronRight size={18} />
              </>
            )}
          </button>
        </div>
      );
    }

    if (selectedSub.status === 'pending') {
      const isDisputed = selectedSub.notes && selectedSub.notes.includes('TRANH CHẤP');
      return (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#d97706', animation: 'pulse 1.5s infinite' }} />
              <span style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>Thông tin đơn đăng ký</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', backgroundColor: '#fef3c7', color: '#d97706', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <RefreshCw size={12} style={{ animation: 'spin 3s linear infinite' }} />
                {isDisputed ? 'Đang xác minh tranh chấp' : 'Đang chờ duyệt'}
              </span>
              {!isEditing && (
                <button 
                  onClick={() => handleStartEdit(selectedSub)} 
                  className="secondary-btn"
                  style={{ height: '32px', padding: '0 12px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Edit2 size={12} /> Sửa thông tin
                </button>
              )}
            </div>
          </div>

          {isEditing ? (
            <div style={{ backgroundColor: '#ffffff', border: `2px solid ${accentColor}`, borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>
              <div className="form-grid" style={{ marginBottom: 0 }}>
                {[['phone', 'SĐT liên hệ'], ['licensePlate', 'Biển số xe'], ['brand', 'Hiệu xe'], ['color', 'Màu xe']].map(([key, label]) => (
                  <div key={key} className="input-group">
                    <label className="input-label" style={{ fontSize: '12px' }}>{label}</label>
                    <input 
                      className="input-field" 
                      style={{ paddingLeft: '16px' }}
                      value={editData[key] || ''} 
                      onChange={(e) => setEditData({ ...editData, [key]: e.target.value })} 
                    />
                  </div>
                ))}
                <div className="input-group" style={{ gridColumn: 'span 2' }}>
                  <label className="input-label" style={{ fontSize: '12px' }}>Số tháng đăng ký</label>
                  <select 
                    className="input-field" 
                    style={{ paddingLeft: '16px', cursor: 'pointer' }}
                    value={editData.months} 
                    onChange={(e) => setEditData({ ...editData, months: Number(e.target.value) })}
                  >
                    <option value={1}>01 Tháng</option>
                    <option value={3}>03 Tháng</option>
                    <option value={6}>06 Tháng</option>
                    <option value={12}>12 Tháng</option>
                  </select>
                </div>
              </div>
              {error && <div style={{ color: '#dc2626', fontWeight: '600', fontSize: '13px', display: 'flex', gap: '6px', alignItems: 'center' }}><AlertCircle size={14} /> {error}</div>}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button 
                  onClick={handleCancelEdit} 
                  className="secondary-btn"
                  style={{ height: '42px', padding: '0 20px', borderRadius: '10px' }}
                >
                  Hủy
                </button>
                <button 
                  onClick={() => handleSaveEdit(selectedSub)} 
                  disabled={isSavingEdit} 
                  className="btn-submit"
                  style={{ height: '42px', padding: '0 24px', borderRadius: '10px', width: 'auto', background: accentColor }}
                >
                  {isSavingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {isDisputed && (
                <div style={{ marginBottom: '16px', padding: '12px 16px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', color: '#b45309', fontSize: '13px', fontWeight: '500', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                  <span>Biển số này trùng lặp với tài khoản khác. Hệ thống đang tiến hành đối chiếu và kiểm tra tranh chấp chính chủ.</span>
                </div>
              )}
              {[
                ['Biển số xe', selectedSub.vehicleId?.licensePlate || '—'],
                ['Loại phương tiện', selectedSub.vehicleType === 'motorbike' ? 'Xe máy' : 'Ô tô'],
                ['Thời hạn gói tháng', `${selectedSub.months} tháng`],
                ['Tổng chi phí', fmtCurrency(selectedSub.totalAmount)],
                ['Số điện thoại liên hệ', selectedSub.contactPhone || '—'],
                ['Thời điểm đăng ký', fmtDate(selectedSub.createdAt)],
              ].map(([label, value]) => (
                <div key={label} className="detail-row">
                  <span style={{ color: '#64748b', fontSize: '14px', fontWeight: '500' }}>{label}</span>
                  <span style={{ fontWeight: '700', color: '#1e293b', fontSize: '14px' }}>{value}</span>
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
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <div style={{ marginBottom: '24px', padding: '20px', backgroundColor: isPaid ? '#f0fdf4' : '#eff6ff', border: `1px solid ${isPaid ? '#bbf7d0' : '#bfdbfe'}`, borderRadius: '16px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
            <CheckCircle color={isPaid ? '#16a34a' : '#2563eb'} size={24} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: isPaid ? '#15803d' : '#1d4ed8', marginBottom: '6px' }}>
                {isPaid ? '✓ Đã xác nhận thanh toán' : 'Đơn đăng ký đã được duyệt thành công!'}
              </div>
              <div style={{ fontSize: '13px', color: isPaid ? '#166534' : '#1e40af', lineHeight: '1.5' }}>
                {isPaid
                  ? 'Gói tháng của bạn đang chờ kích hoạt. Đối với xe máy, vui lòng mang phương tiện hoặc giấy tờ đến gặp Ban Quản lý để nhận thẻ gửi xe RFID.'
                  : 'Vui lòng thực hiện chuyển khoản bằng cách quét mã QR bên dưới hoặc đến trực tiếp văn phòng ban quản lý để đóng tiền mặt kích hoạt vé xe.'}
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: isPaid || !selectedSub.paymentQrUrl ? 0 : '24px' }}>
            {[
              ['Biển số xe', selectedSub.vehicleId?.licensePlate || '—'],
              ['Loại phương tiện', selectedSub.vehicleType === 'motorbike' ? 'Xe máy' : 'Ô tô'],
              ['Thời hạn đăng ký', `${selectedSub.months} tháng`],
              ['Tổng số tiền', fmtCurrency(selectedSub.totalAmount)],
              ['Số điện thoại liên hệ', selectedSub.contactPhone || '—'],
              ['Ngày phê duyệt', fmtDate(selectedSub.approvedAt)],
            ].map(([label, value]) => (
              <div key={label} className="detail-row">
                <span style={{ color: '#64748b', fontSize: '14px', fontWeight: '500' }}>{label}</span>
                <span style={{ fontWeight: '700', color: '#1e293b', fontSize: '14px' }}>{value}</span>
              </div>
            ))}
          </div>

          {!isPaid && selectedSub.paymentQrUrl && (
            <div style={{ padding: '28px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '20px', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: '#dbeafe', borderRadius: '20px', color: '#1d4ed8', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
                <CreditCard size={12} /> Thanh toán online VietQR
              </div>
              
              <img 
                src={selectedSub.paymentQrUrl} 
                alt="VietQR Payment Code" 
                style={{ width: '240px', height: '240px', borderRadius: '16px', border: '3px solid #ffffff', display: 'block', margin: '0 auto 24px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.08)' }} 
              />
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left', backgroundColor: '#ffffff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b', fontSize: '14px', fontWeight: '500' }}>Cú pháp chuyển khoản:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ color: '#2563eb', backgroundColor: '#eff6ff', padding: '4px 12px', borderRadius: '6px', fontSize: '15px', letterSpacing: '1px', border: '1px dashed rgba(37,99,235,0.3)' }}>
                      {selectedSub.paymentCode}
                    </strong>
                    <button 
                      onClick={handleCopyCode}
                      style={{ padding: '4px 8px', background: '#f1f5f9', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#475569', fontWeight: '600' }}
                    >
                      {copied ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                      {copied ? 'Đã copy' : 'Sao chép'}
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                  <span style={{ color: '#64748b', fontSize: '14px', fontWeight: '500' }}>Số tiền chuyển khoản:</span>
                  <strong style={{ color: '#16a34a', fontSize: '20px', fontWeight: '800' }}>{fmtCurrency(selectedSub.totalAmount)}</strong>
                </div>
              </div>
              
              <div style={{ marginTop: '16px', padding: '12px', background: '#fef3c7', borderRadius: '12px', border: '1px solid #fde68a', color: '#b45309', fontSize: '12px', display: 'flex', gap: '8px', alignItems: 'flex-start', textAlign: 'left' }}>
                <InfoIcon size={14} style={{ marginTop: '2px', flexShrink: 0 }} />
                <span><strong>Quan trọng:</strong> Bạn phải điền chính xác cú pháp chuyển khoản ở trên để cổng SePay tự động ghi nhận và kích hoạt vé xe ngay lập tức mà không cần xác nhận thủ công.</span>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (selectedSub.status === 'active') {
      const isCar = selectedSub.vehicleType === 'car';
      const licensePlate = selectedSub.vehicleId?.licensePlate || '';
      
      const handleDownloadAprilTag = () => {
        const downloadUrl = `http://localhost:8000/api/aruco/generate/${encodeURIComponent(licensePlate)}?size=500&label=true`;
        window.open(downloadUrl, '_blank');
      };

      return (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
            <span style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>Gói tháng đang sử dụng</span>
            <span style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', backgroundColor: '#dcfce7', color: '#15803d', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={14} /> Đang hoạt động
            </span>
          </div>

          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '24px' }}>
            {[
              ['Biển số xe', licensePlate || '—'],
              ['Hiệu xe / Màu xe', `${selectedSub.vehicleId?.brand || '—'} / ${selectedSub.vehicleId?.color || '—'}`],
              ['Loại phương tiện', selectedSub.vehicleType === 'motorbike' ? 'Xe máy' : 'Ô tô'],
              ['Ngày bắt đầu sử dụng', fmtDate(selectedSub.startDate)],
              ['Ngày kết thúc (Hết hạn)', fmtDate(selectedSub.endDate)],
              ['Số điện thoại liên hệ', selectedSub.contactPhone || '—'],
            ].map(([label, value]) => (
              <div key={label} className="detail-row">
                <span style={{ color: '#64748b', fontSize: '14px', fontWeight: '500' }}>{label}</span>
                <span style={{ fontWeight: '700', color: '#1e293b', fontSize: '14px' }}>{value}</span>
              </div>
            ))}
          </div>

          {isCar && (
            <div style={{ padding: '28px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '20px', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.01)' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#16a34a', backgroundColor: '#dcfce7', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
                <ShieldCheck size={14} /> Mã AprilTag thông minh
              </div>
              <h3 style={{ margin: '0 0 10px', color: '#166534', fontSize: '18px', fontWeight: '800' }}>Công nghệ mở barrier tự động</h3>
              <p style={{ fontSize: '13px', color: '#166534', margin: '0 0 24px', lineHeight: '1.6', textAlign: 'left', background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1.5px solid rgba(22,163,74,0.1)' }}>
                💡 <strong>Hướng dẫn sử dụng:</strong> Hãy tải file ảnh mã nhận diện AprilTag bên dưới, in ra và dán tại mặt trong kính lái trước xe ô tô của bạn. Camera thông minh tại làn gửi xe sẽ tự động quét, xác minh biển số và mở cổng barrier từ xa khi bạn tiến lại gần.
              </p>
              
              <button
                onClick={handleDownloadAprilTag}
                style={{
                  padding: '16px 28px',
                  backgroundColor: '#16a34a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: '800',
                  fontSize: '15px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                  boxShadow: '0 8px 20px -4px rgba(22,163,74,0.35)',
                  width: '100%',
                  justifyContent: 'center'
                }}
                className="btn-download"
              >
                <Download size={18} /> TẢI VỀ MÃ APRILTAG (FILE PNG CHẤT LƯỢNG CAO)
              </button>
            </div>
          )}
        </div>
      );
    }

    // fallback for other statuses like expired, cancelled
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        <AlertTriangle size={36} color="#9ca3af" />
        <span style={{ fontSize: '15px', fontWeight: '600' }}>
          Gói tháng cho loại phương tiện này ở trạng thái: <strong>{STATUS_LABEL[selectedSub.status] || selectedSub.status}</strong>
        </span>
      </div>
    );
  };

  return (
    <div className="monthly-ticket-container">
      {/* Dynamic CSS styles injection */}
      <style>{`
        .monthly-ticket-container {
          min-height: 100vh;
          background: radial-gradient(circle at 10% 20%, rgba(240, 244, 250, 0.8) 0%, rgba(244, 247, 252, 0.8) 90%);
          padding: 40px 20px;
          font-family: 'IBM Plex Sans', sans-serif;
          color: #1e293b;
          display: flex;
          justify-content: center;
          align-items: flex-start;
        }
        .ticket-card {
          width: 100%;
          max-width: 800px;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-radius: 24px;
          border: 1px solid rgba(226, 232, 240, 0.8);
          box-shadow: 0 20px 40px -15px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(15, 23, 42, 0.02);
          padding: 40px;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
          animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .ticket-card:hover {
          box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.12);
        }
        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 24px;
        }
        @media (max-width: 640px) {
          .form-grid {
            grid-template-columns: 1fr;
          }
          .ticket-card {
            padding: 28px 18px;
          }
        }
        .input-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
          position: relative;
        }
        .input-label {
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #475569;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .input-field {
          width: 100%;
          padding: 14px 16px 14px 44px;
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          color: #1e293b;
          font-size: 15px;
          font-weight: 500;
          outline: none;
          transition: all 0.2s ease;
          box-sizing: border-box;
        }
        .input-field:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.08);
        }
        .input-icon-wrapper {
          position: absolute;
          left: 14px;
          top: 36px;
          color: #94a3b8;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }
        .tab-btn {
          padding: 16px 20px;
          border-radius: 16px;
          border: 1.5px solid #e2e8f0;
          background: #ffffff;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          user-select: none;
          position: relative;
          overflow: hidden;
        }
        .tab-btn::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 4px;
          background: transparent;
          transition: all 0.2s;
        }
        .tab-btn.active-motorbike {
          border-color: #2563eb;
          background: rgba(37, 99, 235, 0.04);
          box-shadow: 0 8px 20px -6px rgba(37, 99, 235, 0.15);
        }
        .tab-btn.active-motorbike::after {
          background: #2563eb;
        }
        .tab-btn.active-car {
          border-color: #d97706;
          background: rgba(217, 119, 6, 0.04);
          box-shadow: 0 8px 20px -6px rgba(217, 119, 6, 0.15);
        }
        .tab-btn.active-car::after {
          background: #d97706;
        }
        .tab-btn:hover:not(.active-motorbike):not(.active-car) {
          border-color: #cbd5e1;
          background: #f8fafc;
          transform: translateY(-2px);
        }
        .badge-status {
          font-size: 11px;
          font-weight: 700;
          padding: 2px 10px;
          border-radius: 999px;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }
        .banner-price {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 24px;
          border-radius: 16px;
          margin-bottom: 24px;
          border-width: 1px;
          border-style: solid;
          animation: fadeIn 0.4s ease;
        }
        .banner-price.motorbike {
          background: linear-gradient(135deg, rgba(37, 99, 235, 0.03) 0%, rgba(37, 99, 235, 0.07) 100%);
          border-color: rgba(37, 99, 235, 0.15);
        }
        .banner-price.car {
          background: linear-gradient(135deg, rgba(217, 119, 6, 0.03) 0%, rgba(217, 119, 6, 0.07) 100%);
          border-color: rgba(217, 119, 6, 0.15);
        }
        .btn-submit {
          width: 100%;
          padding: 16px;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: white;
          box-sizing: border-box;
        }
        .btn-submit.motorbike {
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          box-shadow: 0 8px 20px -4px rgba(37, 99, 235, 0.35);
        }
        .btn-submit.motorbike:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 25px -4px rgba(37, 99, 235, 0.45);
        }
        .btn-submit.car {
          background: linear-gradient(135deg, #d97706, #b45309);
          box-shadow: 0 8px 20px -4px rgba(217, 119, 6, 0.35);
        }
        .btn-submit.car:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 25px -4px rgba(217, 119, 6, 0.45);
        }
        .btn-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .btn-submit:active:not(:disabled) {
          transform: translateY(0);
        }
        .btn-download:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 25px -4px rgba(22, 163, 74, 0.45) !important;
        }
        .btn-download:active {
          transform: translateY(0);
        }
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          animation: fadeIn 0.25s ease;
        }
        .modal-content {
          width: 90%;
          max-width: 500px;
          background: #ffffff;
          border-radius: 20px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          padding: 32px;
          animation: scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
          box-sizing: border-box;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px dashed #e2e8f0;
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes scaleUp {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

      <div className="ticket-card">
        <div style={{ marginBottom: '32px', borderLeft: '4px solid #2563eb', paddingLeft: '20px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '800', margin: '0 0 8px', color: '#1e293b', letterSpacing: '-0.02em' }}>ĐĂNG KÝ VÉ THÁNG</h1>
          <p style={{ color: '#64748b', margin: 0, fontSize: '15px', fontWeight: '500' }}>Hệ thống quản lý bãi đỗ xe thông minh AI ParkVision</p>
        </div>

        {renderTabBar()}

        {success && (
          <div style={{ marginBottom: '20px', padding: '16px 20px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '14px', color: '#15803d', fontWeight: '600', display: 'flex', gap: '8px', alignItems: 'center', fontSize: '14px' }}>
            <CheckCircle size={18} style={{ flexShrink: 0 }} /> {success}
          </div>
        )}

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <RefreshCw size={36} className="animate-spin" style={{ animation: 'spin 1.5s linear infinite' }} />
            <span style={{ fontSize: '14px', fontWeight: '600' }}>Đang kết nối cơ sở dữ liệu...</span>
          </div>
        ) : (
          renderContent()
        )}
      </div>

      {/* MODAL TRANH CHẤP BIỂN SỐ XE */}
      {conflictData && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', color: '#dc2626', marginBottom: '20px' }}>
                <AlertTriangle size={32} />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b', margin: '0 0 10px' }}>Trùng lặp biển số xe</h2>
              <p style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.6', margin: '0 0 24px' }}>
                Biển số xe <strong style={{ color: '#1e293b' }}>{conflictData.licensePlate}</strong> đã được đăng ký trong hệ thống bởi tài khoản khác (<strong style={{ color: '#1e293b' }}>{conflictData.conflictingUser}</strong>).
              </p>
            </div>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#475569', lineHeight: '1.6', marginBottom: '24px' }}>
              💡 <strong>Phương án xử lý:</strong>
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div>• Nếu bạn gõ nhầm biển số xe, hãy chọn <strong>Kiểm tra lại</strong> để chỉnh sửa.</div>
                <div>• Nếu đây chính xác là xe của bạn, hãy chọn <strong>Gửi yêu cầu xác minh</strong>. Ban quản lý sẽ đối chiếu giấy tờ xe của bạn để chuyển giao quyền sở hữu.</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                onClick={handleConfirmDispute}
                className="btn-submit"
                style={{ background: '#dc2626', boxShadow: '0 4px 12px rgba(220,38,38,0.25)', height: '48px' }}
              >
                GỬI YÊU CẦU XÁC MINH CHÍNH CHỦ
              </button>
              <button 
                onClick={() => setConflictData(null)}
                className="secondary-btn"
                style={{ height: '48px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569' }}
              >
                Kiểm tra lại biển số xe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlyTicket;
