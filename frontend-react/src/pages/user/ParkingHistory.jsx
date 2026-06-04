import { useEffect, useState } from 'react'
import DataTable from '../../components/common/DataTable'
import api from '../../services/api'

function ParkingHistory() {
  const [parkingHistory, setParkingHistory] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const columns = [
    { key: 'date', title: 'Ngày' },
    { key: 'entry', title: 'Giờ vào' },
    { key: 'exit', title: 'Giờ ra' },
    { key: 'duration', title: 'Thời lượng' },
    { key: 'fee', title: 'Chi phí' },
    { key: 'status', title: 'Trạng thái' },
  ]

  const mapStatus = (value) => {
    if (value === 'completed') return 'Hoàn tất'
    if (value === 'in_progress') return 'Đang gửi'
    if (value === 'cancelled') return 'Đã hủy'
    return value || 'Không xác định'
  }

  const formatDate = (isoDate) => {
    if (!isoDate) return '-'
    return new Date(isoDate).toLocaleDateString('vi-VN')
  }

  const formatTime = (isoDate) => {
    if (!isoDate) return '-'
    return new Date(isoDate).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDuration = (minutes) => {
    if (minutes === null || minutes === undefined) return '-'
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    if (h === 0) return `${m} phút`
    if (m === 0) return `${h} giờ`
    return `${h} giờ ${m} phút`
  }

  const formatFee = (feeAmount) => {
    if (feeAmount === null || feeAmount === undefined) return '0đ'
    return `${feeAmount.toLocaleString('vi-VN')}đ`
  }

  const fetchHistory = async () => {
    try {
      setIsLoading(true)
      setError('')

      const rawUser = localStorage.getItem('currentUser')
      const currentUser = rawUser ? JSON.parse(rawUser) : null

      const params = {}
      if (currentUser?.username) {
        params.username = currentUser.username
      }

      const response = await api.get('/api/parking-history', { params })

      const rows = (response.data?.data || []).map((item) => ({
        date: formatDate(item.entryAt),
        entry: formatTime(item.entryAt),
        exit: formatTime(item.exitAt),
        duration: formatDuration(item.durationMinutes),
        fee: formatFee(item.feeAmount),
        status: mapStatus(item.status),
      }))

      setParkingHistory(rows)
    } catch (requestError) {
      const message =
        requestError?.response?.data?.message ||
        'Không tải được lịch sử gửi xe từ backend'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [])

  return (
    <div>
      <h3 className="page-title">Lịch sử gửi xe</h3>
      <div className="card filter-bar">
        <select className="select" disabled>
          <option>Tháng 4/2026</option>
          <option>Tháng 3/2026</option>
        </select>
        <button className="secondary-btn" style={{ width: '180px' }} onClick={fetchHistory}>
          {isLoading ? 'Đang tải...' : 'Làm mới'}
        </button>
      </div>

      {error && <div className="error-box" style={{ marginBottom: '16px' }}>{error}</div>}

      <DataTable columns={columns} data={parkingHistory} />
    </div>
  )
}

export default ParkingHistory