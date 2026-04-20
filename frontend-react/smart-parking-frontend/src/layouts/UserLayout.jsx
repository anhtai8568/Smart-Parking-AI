import { Outlet } from 'react-router-dom'
import Sidebar from '../components/common/Sidebar'
import Header from '../components/common/Header'

function UserLayout() {
  return (
    <div className="layout">
      <Sidebar type="user" />
      <div className="main-area">
        <Header title="Trang người dùng" />
        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export default UserLayout