import { Outlet } from 'react-router-dom'
import Sidebar from '../components/common/Sidebar'
import Header from '../components/common/Header'

function GuardLayout() {
  return (
    <div className="dashboard-layout">
      <Sidebar type="guard" />

      <main className="main-content">
        <Header />
        <Outlet />
      </main>
    </div>
  )
}

export default GuardLayout