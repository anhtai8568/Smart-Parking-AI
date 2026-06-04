import { useEffect, useState } from 'react'
import api from '../../services/api'

function Header({ title }) {
  const rawUser = localStorage.getItem('currentUser')
  const initialUser = rawUser ? JSON.parse(rawUser) : null
  const [currentUser, setCurrentUser] = useState(initialUser)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await api.get('/api/auth/me')
        const user = response.data?.data?.user
        if (user) {
          setCurrentUser(user)
          localStorage.setItem('currentUser', JSON.stringify(user))
        }
      } catch (_error) {
        // Keep localStorage fallback if backend is unavailable.
      }
    }

    fetchProfile()
  }, [])

  return (
    <header className="header">
      <div className="header-left">
        <h2>{title}</h2>
        <p>Hệ thống quản lý bãi đỗ xe thông minh Smart Parking AI</p>
      </div>

      <div className="header-user">
        <div className="avatar">
          {currentUser?.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}
        </div>
        <div>
          <div style={{ fontWeight: 800 }}>
            Xin chào, {currentUser?.fullName || 'Người dùng'}
          </div>
          <div style={{ color: '#6b7280', fontSize: '13px' }}>
            {currentUser?.role === 'admin' ? 'Quản trị hệ thống' : 'Người dùng hàng tháng'}
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header