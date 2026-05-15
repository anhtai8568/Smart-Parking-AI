import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../../services/api';

const ResetPassword = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const token = useMemo(() => new URLSearchParams(location.search).get('token') || '', [location.search]);

    const [formData, setFormData] = useState({ password: '', confirmPassword: '' });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);

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
        maxWidth: '420px',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(10px)',
        borderRadius: '24px',
        padding: '34px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
    };

    const inputStyle = {
        width: '100%',
        padding: '12px 15px',
        margin: '8px 0 16px',
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
        marginTop: '10px'
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setSuccess('');

        if (!token) {
            setError('Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
            return;
        }

        if (!formData.password) {
            setError('Vui lòng nhập mật khẩu mới');
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
            await api.post('/api/auth/reset-password', {
                token,
                password: formData.password,
            });

            setSuccess('Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.');
            setFormData({ password: '', confirmPassword: '' });
            setTimeout(() => navigate('/login'), 800);
        } catch (requestError) {
            const message =
                requestError?.response?.data?.message ||
                requestError?.message ||
                'Không thể đặt lại mật khẩu';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={containerStyle}>
            <div style={cardStyle}>
                <h1 style={{ color: 'white', textAlign: 'center', marginBottom: '8px' }}>Đặt Lại Mật Khẩu</h1>
                <p style={{ color: '#9ca3af', textAlign: 'center', fontSize: '13px', marginBottom: '24px' }}>
                    Nhập mật khẩu mới để hoàn tất.
                </p>

                <form onSubmit={handleSubmit}>
                    <label style={{ color: '#93c5fd', fontSize: '13px' }}>MẬT KHẨU MỚI</label>
                    <input
                        type="password"
                        placeholder="••••••••"
                        style={inputStyle}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        autoComplete="new-password"
                    />

                    <label style={{ color: '#93c5fd', fontSize: '13px' }}>XÁC NHẬN MẬT KHẨU</label>
                    <input
                        type="password"
                        placeholder="••••••••"
                        style={inputStyle}
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        autoComplete="new-password"
                    />

                    {error && (
                        <div style={{ color: '#fca5a5', fontSize: '13px', marginBottom: '12px' }}>
                            {error}
                        </div>
                    )}

                    {success && (
                        <div style={{ color: '#86efac', fontSize: '13px', marginBottom: '12px' }}>
                            {success}
                        </div>
                    )}

                    <button style={buttonStyle} type="submit" disabled={isLoading}>
                        {isLoading ? 'ĐANG XỬ LÝ...' : 'XÁC NHẬN'}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                    <Link to="/login" style={{ color: '#93c5fd', fontSize: '14px', textDecoration: 'none' }}>
                        ← Quay lại đăng nhập
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
