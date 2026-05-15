import React from 'react';
import { Link } from 'react-router-dom';

const Register = () => {
  const containerStyle = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a192f',
    fontFamily: 'sans-serif',
    padding: '20px'
  };

  const cardStyle = {
    width: '100%',
    maxWidth: '450px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(10px)',
    borderRadius: '24px',
    padding: '40px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 15px',
    margin: '8px 0 15px',
    backgroundColor: 'rgba(10, 25, 47, 0.5)',
    border: '1px solid #1e3a8a',
    borderRadius: '12px',
    color: 'white',
    outline: 'none',
    boxSizing: 'border-box'
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={{ color: 'white', textAlign: 'center', marginBottom: '10px' }}>Tạo Tài Khoản</h1>
        <div style={{ height: '3px', width: '40px', backgroundColor: '#2563eb', margin: '0 auto 30px' }}></div>
        
        <label style={{ color: '#93c5fd', fontSize: '13px' }}>HỌ VÀ TÊN</label>
        <input type="text" placeholder="Nguyễn Văn A" style={inputStyle} />
        
        <label style={{ color: '#93c5fd', fontSize: '13px' }}>EMAIL</label>
        <input type="email" placeholder="partner@example.com" style={inputStyle} />
        
        <div style={{ display: 'flex', gap: '15px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ color: '#93c5fd', fontSize: '13px' }}>MẬT KHẨU</label>
            <input type="password" placeholder="••••" style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ color: '#93c5fd', fontSize: '13px' }}>XÁC NHẬN</label>
            <input type="password" placeholder="••••" style={inputStyle} />
          </div>
        </div>
        
        <button style={{ 
          width: '100%', padding: '14px', backgroundColor: '#2563eb', 
          color: 'white', border: 'none', borderRadius: '12px', 
          fontWeight: 'bold', cursor: 'pointer', marginTop: '15px' 
        }}>ĐĂNG KÝ NGAY</button>
        
        <div style={{ textAlign: 'center', marginTop: '25px' }}>
          <Link to="/login" style={{ color: '#93c5fd', fontSize: '14px', textDecoration: 'none' }}>← Quay lại đăng nhập</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;