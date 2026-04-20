import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginWithMockAccount } from '../data/mockAuth'

function Login() {
  const navigate = useNavigate()
  const [error, setError] = useState('')

  const handleLogin = (e) => {
    e.preventDefault()

    const username = e.target.username.value.trim()
    const password = e.target.password.value.trim()

    const result = loginWithMockAccount(username, password)

    if (!result) {
      setError('Sai tài khoản hoặc mật khẩu')
      return
    }

    localStorage.setItem('token', result.token)
    localStorage.setItem('currentUser', JSON.stringify(result.user))

    if (result.user.role === 'admin') {
      navigate('/admin/dashboard')
    } else {
      navigate('/user/dashboard')
    }
  }

  return (
    <div className="login-page">
      <form className="login-box" onSubmit={handleLogin}>
        <div style={{ textAlign: 'center', marginBottom: '10px' }}>
          <div
            style={{
              width: '68px',
              height: '68px',
              margin: '0 auto 14px',
              borderRadius: '18px',
              display: 'grid',
              placeItems: 'center',
              background: 'linear-gradient(135deg, #1e40af, #2563eb)',
              color: 'white',
              fontWeight: 800,
              fontSize: '28px',
            }}
          >
            P
          </div>
        </div>

        <h2>Đăng nhập hệ thống</h2>
        <p>Smart Parking AI</p>

        <div className="login-form">
          <input
            className="input"
            name="username"
            type="text"
            placeholder="Tên đăng nhập"
          />
          <input
            className="input"
            name="password"
            type="password"
            placeholder="Mật khẩu"
          />

          {error && <div className="error-box">{error}</div>}

          <button className="primary-btn login-btn" type="submit">
            Đăng nhập
          </button>
        </div>

        <div className="demo-box">
          <div><strong>Admin:</strong> admin / 123456</div>
          <div><strong>User:</strong> user1 / 123456</div>
        </div>
      </form>
    </div>
  )
}

export default Login