import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';

const Login = () => {
  const [formData, setFormData] = useState({ username: '', password: '' });
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
    maxWidth: '400px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(10px)',
    borderRadius: '24px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
  };

  const headerStyle = {
    padding: '40px 20px',
    textAlign: 'center',
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
  };

  const logoStyle = {
    width: '70px',
    height: '70px',
    backgroundColor: '#2563eb',
    margin: '0 auto 15px',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px',
    color: 'white',
    fontWeight: 'bold',
    fontStyle: 'italic',
    boxShadow: '0 0 20px rgba(37, 99, 235, 0.4)'
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 15px',
    margin: '8px 0 20px',
    backgroundColor: 'rgba(10, 25, 47, 0.5)',
    border: '1px solid #1e3a8a',
    borderRadius: '12px',
    color: 'white',
    outline: 'none',
    boxSizing: 'border-box'
  };

  const buttonStyle = {
    width: '100%',
    padding: '14px',
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontSize: '16px',
    marginTop: '10px'
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const username = formData.username.trim();
    if (!username || !formData.password) {
      setError('Vui lòng nhập tên đăng nhập và mật khẩu');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/api/auth/login', {
        username,
        password: formData.password,
      });

      const payload = response.data?.data;
      if (!payload?.token || !payload?.user) {
        throw new Error('Dữ liệu đăng nhập không hợp lệ');
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
        'Đăng nhập thất bại';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={headerStyle}>
          <div style={logoStyle}>P</div>
          <h1 style={{ color: 'white', margin: 0, fontSize: '20px', letterSpacing: '2px' }}>SMART PARKING AI</h1>
        </div>

        <div style={{ padding: '30px' }}>
          <h2 style={{ color: '#d1d5db', textAlign: 'center', fontSize: '18px', marginBottom: '25px', fontStyle: 'italic' }}>Hệ Thống Đăng Nhập</h2>

          <form onSubmit={handleSubmit}>
            <label style={{ color: '#93c5fd', fontSize: '14px' }}>Tên đăng nhập</label>
            <input
              type="text"
              placeholder="admin"
              style={inputStyle}
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              autoComplete="username"
            />

            <label style={{ color: '#93c5fd', fontSize: '14px' }}>Mật khẩu</label>
            <input
              type="password"
              placeholder="••••••••"
              style={inputStyle}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              autoComplete="current-password"
            />

            {error && (
              <div style={{ color: '#fca5a5', fontSize: '13px', marginBottom: '12px' }}>
                {error}
              </div>
            )}

            <button style={buttonStyle} type="submit" disabled={isLoading}>
              {isLoading ? 'ĐANG ĐĂNG NHẬP...' : 'ĐĂNG NHẬP'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '18px' }}>
            <Link to="/forgot-password" style={{ color: '#93c5fd', fontSize: '13px', textDecoration: 'none' }}>
              Quên mật khẩu?
            </Link>
          </div>

          <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '14px', marginTop: '25px' }}>
            Chưa có tài khoản? <Link to="/register" style={{ color: '#60a5fa', fontWeight: 'bold', textDecoration: 'none' }}>Đăng ký ngay</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;