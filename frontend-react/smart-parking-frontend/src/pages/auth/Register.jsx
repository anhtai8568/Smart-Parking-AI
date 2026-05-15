import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';

const Register = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const fullName = formData.fullName.trim();
    const username = formData.username.trim();
    const email = formData.email.trim();

    if (!fullName || !username || !email || !formData.password) {
      setError('Vui lòng nhập đầy đủ thông tin bắt buộc');
      return;
    }

    if (formData.password.length < 6) {
      setError('Mật khẩu tối thiểu 6 ký tự');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/api/auth/register', {
        fullName,
        username,
        email,
        password: formData.password,
      });

      const payload = response.data?.data;
      if (!payload?.token || !payload?.user) {
        throw new Error('Đăng ký thất bại');
      }

      localStorage.setItem('token', payload.token);
      localStorage.setItem('currentUser', JSON.stringify(payload.user));

      if (payload.user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/user');
      }
    } catch (requestError) {
      const message =
        requestError?.response?.data?.message ||
        requestError?.message ||
        'Đăng ký thất bại';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={{ color: 'white', textAlign: 'center', marginBottom: '10px' }}>Tạo Tài Khoản</h1>
        <div style={{ height: '3px', width: '40px', backgroundColor: '#2563eb', margin: '0 auto 30px' }}></div>

        <form onSubmit={handleSubmit}>
          <label style={{ color: '#93c5fd', fontSize: '13px' }}>HỌ VÀ TÊN</label>
          <input
            type="text"
            placeholder="Nguyễn Văn A"
            style={inputStyle}
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            autoComplete="name"
          />

          <label style={{ color: '#93c5fd', fontSize: '13px' }}>TÊN ĐĂNG NHẬP</label>
          <input
            type="text"
            placeholder="user123"
            style={inputStyle}
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            autoComplete="username"
          />

          <label style={{ color: '#93c5fd', fontSize: '13px' }}>EMAIL</label>
          <input
            type="email"
            placeholder="partner@example.com"
            style={inputStyle}
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            autoComplete="email"
          />

          <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ color: '#93c5fd', fontSize: '13px' }}>MẬT KHẨU</label>
              <input
                type="password"
                placeholder="••••"
                style={inputStyle}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                autoComplete="new-password"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ color: '#93c5fd', fontSize: '13px' }}>XÁC NHẬN</label>
              <input
                type="password"
                placeholder="••••"
                style={inputStyle}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                autoComplete="new-password"
              />
            </div>
          </div>

          {error && (
            <div style={{ color: '#fca5a5', fontSize: '13px', marginTop: '10px' }}>
              {error}
            </div>
          )}

          <button
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              marginTop: '15px'
            }}
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? 'ĐANG ĐĂNG KÝ...' : 'ĐĂNG KÝ NGAY'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '25px' }}>
          <Link to="/login" style={{ color: '#93c5fd', fontSize: '14px', textDecoration: 'none' }}>← Quay lại đăng nhập</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;