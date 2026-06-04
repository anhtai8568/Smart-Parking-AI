import { useEffect, useState } from 'react'
import DataTable from '../../components/common/DataTable'
import api from '../../services/api'

function ManageVehicles() {
  const [vehicles, setVehicles] = useState([])
  const [plateFilter, setPlateFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const columns = [
    { key: 'licensePlate', title: 'Biển số' },
    { key: 'type', title: 'Loại xe' },
    { key: 'owner', title: 'Chủ xe' },
    { key: 'visitor', title: 'Loại đăng ký' },
    { key: 'status', title: 'Trạng thái' },
  ]

  const mapStatus = (value) => {
    if (value === 'active') return 'Hoạt động'
    if (value === 'inactive') return 'Tạm khóa'
    return value || 'Không xác định'
  }

  const mapVehicleType = (value) => {
    if (value === 'car') return 'Ô tô'
    if (value === 'motorbike') return 'Xe máy'
    return value || 'Khác'
  }

  const fetchVehicles = async () => {
    try {
      setIsLoading(true)
      setError('')

      const params = {}
      if (plateFilter.trim()) {
        params.plate = plateFilter.trim()
      }
      if (statusFilter !== 'all') {
        params.status = statusFilter
      }

      const response = await api.get('/api/vehicles', { params })
      const rows = (response.data?.data || []).map((item) => ({
        licensePlate: item.licensePlate,
        type: mapVehicleType(item.vehicleType),
        owner: item.userId?.fullName || 'Khách vãng lai',
        visitor: item.isVisitor ? 'Vãng lai' : 'Thành viên',
        status: mapStatus(item.status),
      }))

      setVehicles(rows)
    } catch (requestError) {
      const message =
        requestError?.response?.data?.message ||
        'Không tải được danh sách xe từ backend'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchVehicles()
  }, [])

  return (
    <div>
      <div className="section-header">
        <h3 className="page-title" style={{ margin: 0 }}>Quản lý xe vào/ra</h3>
        <button className="secondary-btn" style={{ width: '160px' }} onClick={fetchVehicles}>
          {isLoading ? 'Đang tải...' : 'Làm mới'}
        </button>
      </div>

      <div className="card filter-bar">
        <input
          className="input"
          type="text"
          placeholder="Nhập biển số..."
          value={plateFilter}
          onChange={(e) => setPlateFilter(e.target.value)}
        />
        <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Tất cả</option>
          <option value="active">Hoạt động</option>
          <option value="inactive">Tạm khóa</option>
        </select>
        <button className="secondary-btn" style={{ width: '180px' }} onClick={fetchVehicles}>
          Tìm kiếm
        </button>
      </div>

      {error && <div className="error-box" style={{ marginBottom: '16px' }}>{error}</div>}

      <DataTable columns={columns} data={vehicles} />
    </div>
  )
}

export default ManageVehicles