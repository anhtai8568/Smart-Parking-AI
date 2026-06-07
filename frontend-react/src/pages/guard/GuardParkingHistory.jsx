import { useEffect, useState } from 'react'
import DataTable from '../../components/common/DataTable'
import api from '../../services/api'

function GuardParkingHistory() {
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

      const response = await api.get('/api/parking-history')

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
        'Không tải được lịch sử xe vào/ra từ backend'

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
      <div className="page-header">
        <div>
          <h3 className="page-title">Lịch sử xe vào/ra</h3>
          <p className="page-subtitle">
            Bảo vệ theo dõi danh sách các lượt xe vào và xe ra trong bãi đỗ.
          </p>
        </div>
      </div>

      <div className="card filter-bar">
        <select className="select" disabled>
          <option>Tất cả lịch sử xe vào/ra</option>
        </select>

        <button
          className="secondary-btn"
          style={{ width: '180px' }}
          onClick={fetchHistory}
          disabled={isLoading}
        >
          {isLoading ? 'Đang tải...' : 'Làm mới'}
        </button>
      </div>

      {error && (
        <div className="error-box" style={{ marginBottom: '16px' }}>
          {error}
        </div>
      )}

      <DataTable columns={columns} data={parkingHistory} />
    </div>
  )
}

export default GuardParkingHistory