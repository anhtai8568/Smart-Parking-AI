import React, { useState } from 'react';

const MonthlyTicket = () => {
  const [ticketType, setTicketType] = useState('basic');

  const colors = {
    bg: '#f8fafc',
    card: '#ffffff',
    border: '#e2e8f0',
    accent: '#2563eb',
    textMain: '#1e293b',
    textSub: '#64748b',
    inputBg: '#ffffff'
  };

  const containerStyle = {
    minHeight: '100vh',
    backgroundColor: colors.bg,
    color: colors.textMain,
    padding: '40px 20px',
    fontFamily: "'Inter', sans-serif",
  };

  const cardStyle = {
    maxWidth: '900px',
    margin: '0 auto',
    backgroundColor: colors.card,
    borderRadius: '24px',
    border: `1px solid ${colors.border}`,
    padding: '40px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)'
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
    transition: 'border-color 0.2s',
  };

  const planCardStyle = (type) => ({
    padding: '24px',
    borderRadius: '20px',
    border: ticketType === type ? `2px solid ${colors.accent}` : `1px solid ${colors.border}`,
    backgroundColor: ticketType === type ? 'rgba(37, 99, 235, 0.05)' : '#ffffff',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    transform: ticketType === type ? 'translateY(-5px)' : 'none',
    position: 'relative',
    overflow: 'hidden',
    boxShadow: ticketType === type ? '0 10px 20px rgba(0,0,0,0.05)' : 'none'
  });

  const badgeStyle = {
    position: 'absolute',
    top: '12px',
    right: '12px',
    backgroundColor: colors.accent,
    color: 'white',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '10px',
    fontWeight: 'bold',
    textTransform: 'uppercase'
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: 'left', marginBottom: '40px', borderLeft: `4px solid ${colors.accent}`, paddingLeft: '20px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '800', margin: '0 0 8px 0', color: colors.textMain }}>ĐĂNG KÝ VÉ THÁNG</h1>
          <p style={{ color: colors.textSub, margin: 0 }}>Hệ thống quản lý gửi xe thông minh AI</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '40px' }}>
          <div style={planCardStyle('basic')} onClick={() => setTicketType('basic')}>
            {ticketType === 'basic' && <div style={badgeStyle}>Đang chọn</div>}
            <h3 style={{ margin: '0 0 10px 0', color: colors.accent, fontSize: '18px' }}>Gói Xe Máy</h3>
            <div style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '15px', color: colors.textMain }}>150.000đ<span style={{ fontSize: '16px', color: colors.textSub }}>/tháng</span></div>
            <div style={{ fontSize: '14px', color: colors.textSub, lineHeight: '1.6' }}>
              • Gửi xe không giới hạn lượt ra vào<br />
              • Bảo quản xe tại khu vực có mái che<br />
              • Quản lý qua biển số AI
            </div>
          </div>

          <div style={planCardStyle('premium')} onClick={() => setTicketType('premium')}>
            {ticketType === 'premium' && <div style={badgeStyle}>Đang chọn</div>}
            <h3 style={{ margin: '0 0 10px 0', color: '#d97706', fontSize: '18px' }}>Gói Ô Tô</h3>
            <div style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '15px', color: colors.textMain }}>800.000đ<span style={{ fontSize: '16px', color: colors.textSub }}>/tháng</span></div>
            <div style={{ fontSize: '14px', color: colors.textSub, lineHeight: '1.6' }}>
              • Vị trí đỗ xe ưu tiên gần lối ra<br />
              • Hỗ trợ cứu hộ ắc quy miễn phí<br />
              • Camera giám sát 24/7 riêng biệt
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: '#f1f5f9', padding: '30px', borderRadius: '20px', border: `1px solid ${colors.border}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px' }}>
            <div>
              <label style={{ color: colors.textMain, fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>Biển Số Xe</label>
              <input style={inputStyle} placeholder="30A-XXXXX" />
            </div>
            <div>
              <label style={{ color: colors.textMain, fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>Chủ Xe</label>
              <input style={inputStyle} placeholder="Nguyễn Văn A" />
            </div>
            <div>
              <label style={{ color: colors.textMain, fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>Loại Xe / Hiệu Xe</label>
              <input style={inputStyle} placeholder="Ví dụ: Honda SH, Mazda 3..." />
            </div>
            <div>
              <label style={{ color: colors.textMain, fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>Số Tháng Đăng Ký</label>
              <select style={inputStyle}>
                <option>01 Tháng</option>
                <option>03 Tháng (Giảm 5%)</option>
                <option>06 Tháng (Giảm 10%)</option>
                <option>12 Tháng (Giảm 20%)</option>
              </select>
            </div>
          </div>

          <button style={{
            width: '100%',
            padding: '18px',
            backgroundColor: colors.accent,
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontWeight: 'bold',
            fontSize: '16px',
            marginTop: '30px',
            cursor: 'pointer',
            boxShadow: `0 4px 14px 0 rgba(37, 99, 235, 0.39)`,
            transition: '0.3s'
          }}>
            TIẾN HÀNH ĐĂNG KÝ VÀ THANH TOÁN
          </button>
        </div>
      </div>
    </div>
  );
};

export default MonthlyTicket;