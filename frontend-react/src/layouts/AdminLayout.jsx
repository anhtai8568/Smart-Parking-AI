import { Outlet } from 'react-router-dom'
import Sidebar from '../components/common/Sidebar'
import Header from '../components/common/Header'

function AdminLayout() {
  return (
    <div className="layout">
      <Sidebar type="admin" />
      <div className="main-area">
        <Header title="Bảng điều khiển quản trị" />
        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export default AdminLayout