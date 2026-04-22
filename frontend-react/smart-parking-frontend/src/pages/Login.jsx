import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

function Login() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()

    const username = e.target.username.value.trim()
    const password = e.target.password.value.trim()

    if (!username || !password) {
      setError('Vui lòng nhập đầy đủ tài khoản và mật khẩu')
      return
    }

    try {
      setIsLoading(true)
      setError('')

      const response = await api.post('/api/auth/login', { username, password })
      const result = response.data?.data

      if (!result?.token || !result?.user) {
        setError('Phản hồi đăng nhập không hợp lệ')
        return
      }

      localStorage.setItem('token', result.token)
      localStorage.setItem('currentUser', JSON.stringify(result.user))

      if (result.user.role === 'admin') {
        navigate('/admin/dashboard')
      } else {
        navigate('/user/dashboard')
      }
    } catch (requestError) {
      const message =
        requestError?.response?.data?.message ||
        'Đăng nhập thất bại. Kiểm tra backend và thử lại.'
      setError(message)
    } finally {
      setIsLoading(false)
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

          <button className="primary-btn login-btn" type="submit" disabled={isLoading}>
            {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
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