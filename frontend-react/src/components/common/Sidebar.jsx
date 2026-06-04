import { NavLink, useNavigate } from 'react-router-dom'

function Sidebar({ type }) {
  const navigate = useNavigate()

  const adminMenus = [
    { label: 'Tổng quan', path: '/admin/dashboard' },
    { label: 'Duyệt vé tháng', path: '/admin/monthly-tickets' },
    { label: 'Quản lý người dùng', path: '/admin/users' },
    { label: 'Lịch sử xe vào/ra', path: '/admin/parking-history' },
    { label: 'Giá vé', path: '/admin/pricing' },
  ]

  const userMenus = [
    { label: 'Tổng quan', path: '/user/dashboard' },
    { label: 'Lịch sử gửi xe', path: '/user/history' },
    { label: 'Lịch sử thanh toán', path: '/user/payments' },
    { label: 'Thông tin tài khoản', path: '/user/account' },
  ]

  const menus = type === 'admin' ? adminMenus : userMenus

  const handleLogout = () => {
    localStorage.removeItem('currentUser')
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <aside className="sidebar">
      <div className="logo-wrap">
        <div className="logo">SMART PARKING AI</div>
        <div className="logo-sub">
          {type === 'admin' ? 'Bảng điều khiển quản trị' : 'Cổng thông tin người dùng'}
        </div>
      </div>

      <div className="menu-group-title">Chức năng</div>

      <nav className="menu">
        {menus.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => (isActive ? 'menu-link active' : 'menu-link')}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <button className="logout-btn logout-button-real" onClick={handleLogout}>
          Đăng xuất
        </button>
      </div>
    </aside>
  )
}

export default Sidebar