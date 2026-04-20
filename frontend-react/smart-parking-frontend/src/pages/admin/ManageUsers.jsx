import DataTable from '../../components/common/DataTable'
import { users } from '../../data/mockData'

function ManageUsers() {
  const columns = [
    { key: 'fullName', title: 'Họ tên' },
    { key: 'phone', title: 'Số điện thoại' },
    { key: 'licensePlate', title: 'Biển số' },
    { key: 'packageType', title: 'Gói' },
    { key: 'balance', title: 'Số dư' },
    { key: 'status', title: 'Trạng thái' },
  ]

  return (
    <div>
      <div className="section-header">
        <h3 className="page-title" style={{ margin: 0 }}>Quản lý người dùng tháng</h3>
        <button className="primary-btn" style={{ width: 'auto' }}>+ Thêm người dùng</button>
      </div>

      <div className="card filter-bar">
        <input className="input" type="text" placeholder="Tìm theo tên hoặc biển số..." />
        <button className="secondary-btn" style={{ width: '180px' }}>Tìm kiếm</button>
      </div>

      <DataTable columns={columns} data={users} />
    </div>
  )
}

export default ManageUsers