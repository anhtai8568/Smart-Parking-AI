import DataTable from '../../components/common/DataTable'
import { vehicles } from '../../data/mockData'

function ManageVehicles() {
  const columns = [
    { key: 'time', title: 'Thời gian' },
    { key: 'licensePlate', title: 'Biển số' },
    { key: 'type', title: 'Loại xe' },
    { key: 'source', title: 'Nguồn' },
    { key: 'status', title: 'Trạng thái' },
  ]

  return (
    <div>
      <div className="section-header">
        <h3 className="page-title" style={{ margin: 0 }}>Quản lý xe vào/ra</h3>
        <button className="secondary-btn" style={{ width: '160px' }}>Làm mới</button>
      </div>

      <div className="card filter-bar">
        <input className="input" type="text" placeholder="Nhập biển số..." />
        <select className="select">
          <option>Tất cả</option>
          <option>Xe vào</option>
          <option>Xe ra</option>
        </select>
      </div>

      <DataTable columns={columns} data={vehicles} />
    </div>
  )
}

export default ManageVehicles