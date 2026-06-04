import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

const ForgotPassword = () => {
    const [formData, setFormData] = useState({ username: '', email: '' });
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

        const username = formData.username.trim();
        const email = formData.email.trim();

        if (!username && !email) {
            setError('Vui lòng nhập tên đăng nhập hoặc email');
            return;
        }

        setIsLoading(true);
        try {
            await api.post('/api/auth/forgot-password', {
                username: username || undefined,
                email: email || undefined,
            });

            setSuccess('Đã gửi link đặt lại mật khẩu. Vui lòng kiểm tra email.');
            setFormData({ username: '', email: '' });
        } catch (requestError) {
            const message =
                requestError?.response?.data?.message ||
                requestError?.message ||
                'Không thể gửi link đặt lại mật khẩu';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={containerStyle}>
            <div style={cardStyle}>
                <h1 style={{ color: 'white', textAlign: 'center', marginBottom: '8px' }}>Quên Mật Khẩu</h1>
                <p style={{ color: '#9ca3af', textAlign: 'center', fontSize: '13px', marginBottom: '24px' }}>
                    Nhập tên đăng nhập hoặc email để nhận link đặt lại mật khẩu.
                </p>

                <form onSubmit={handleSubmit}>
                    <label style={{ color: '#93c5fd', fontSize: '13px' }}>TÊN ĐĂNG NHẬP</label>
                    <input
                        type="text"
                        placeholder="admin"
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
                        {isLoading ? 'ĐANG GỬI...' : 'GỬI LINK ĐẶT LẠI'}
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

export default ForgotPassword;
