import { useEffect, useState } from 'react'
import DataTable from '../../components/common/DataTable'
import api from '../../services/api'

function ManageUsers() {
  const [users, setUsers] = useState([])
  const [keyword, setKeyword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const columns = [
    { key: 'fullName', title: 'Họ tên' },
    { key: 'phone', title: 'Số điện thoại' },
    { key: 'licensePlate', title: 'Biển số' },
    { key: 'packageType', title: 'Gói' },
    { key: 'balance', title: 'Số dư' },
    { key: 'status', title: 'Trạng thái' },
  ]

  const mapStatus = (value) => {
    if (value === 'active') return 'Hoạt động'
    if (value === 'blocked') return 'Tạm khóa'
    return value || 'Không xác định'
  }

  const formatBalance = (amount) => {
    const safeNumber = Number(amount || 0)
    return `${safeNumber.toLocaleString('vi-VN')}đ`
  }

  const fetchUsers = async () => {
    try {
      setIsLoading(true)
      setError('')

      const params = {}
      if (keyword.trim()) {
        params.q = keyword.trim()
      }

      const response = await api.get('/api/users', { params })
      const rows = (response.data?.data || []).map((item) => ({
        fullName: item.fullName,
        phone: item.phone || '-',
        licensePlate: item.defaultVehicleId?.licensePlate || '-',
        packageType: 'Tháng',
        balance: formatBalance(item.walletBalance),
        status: mapStatus(item.status),
      }))

      setUsers(rows)
    } catch (requestError) {
      const message =
        requestError?.response?.data?.message ||
        'Không tải được danh sách người dùng từ backend'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  return (
    <div>
      <div className="section-header">
        <h3 className="page-title" style={{ margin: 0 }}>Quản lý người dùng tháng</h3>
        <button className="primary-btn" style={{ width: 'auto' }}>+ Thêm người dùng</button>
      </div>

      <div className="card filter-bar">
        <input
          className="input"
          type="text"
          placeholder="Tìm theo tên, tài khoản hoặc số điện thoại..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <button className="secondary-btn" style={{ width: '180px' }} onClick={fetchUsers}>
          {isLoading ? 'Đang tải...' : 'Tìm kiếm'}
        </button>
      </div>

      {error && <div className="error-box" style={{ marginBottom: '16px' }}>{error}</div>}

      <DataTable columns={columns} data={users} />
    </div>
  )
}

export default ManageUsers