import { NavLink, useNavigate } from 'react-router-dom'

function Sidebar({ type }) {
  const navigate = useNavigate()

  const adminMenus = [
    { label: 'Tổng quan', path: '/admin/dashboard' },
    { label: 'Quản lý người dùng', path: '/admin/users' },
    { label: 'Quản lý xe vào/ra', path: '/admin/vehicles' },
    { label: 'Khách vãng lai', path: '/admin/visitors' },
    { label: 'Giá vé', path: '/admin/pricing' },
    { label: 'Báo cáo', path: '/admin/reports' },
    { label: 'Cài đặt', path: '/admin/settings' },
  ]

  const userMenus = [
    { label: 'Tổng quan', path: '/user/dashboard' },
    { label: 'Lịch sử gửi xe', path: '/user/history' },
    { label: 'Thông tin tài khoản', path: '/user/account' },
    { label: 'Lịch sử thanh toán', path: '/user/payments' },
    { label: 'Nạp tiền', path: '/user/topup' },
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