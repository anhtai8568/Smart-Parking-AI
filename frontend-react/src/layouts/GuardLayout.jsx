import { Outlet } from 'react-router-dom'
import Sidebar from '../components/common/Sidebar'
import Header from '../components/common/Header'

function GuardLayout() {
  return (
    <div className="layout">
      <Sidebar type="guard" />
      <div className="main-area">
        <Header title="Cổng bảo vệ" />
        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export default GuardLayout