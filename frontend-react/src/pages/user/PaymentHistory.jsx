import { useEffect, useState } from 'react'
import DataTable from '../../components/common/DataTable'
import api from '../../services/api'

function PaymentHistory() {
  const [history, setHistory] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const columns = [
    { key: 'date', title: 'Ngày' },
    { key: 'content', title: 'Nội dung' },
    { key: 'amount', title: 'Số tiền' },
    { key: 'method', title: 'Phương thức' },
    { key: 'status', title: 'Trạng thái' },
  ]

  const formatDate = (isoDate) => {
    if (!isoDate) return '-'
    return new Date(isoDate).toLocaleDateString('vi-VN')
  }

  const formatAmount = (amount) => {
    if (amount === null || amount === undefined) return '-'
    return `${Number(amount).toLocaleString('vi-VN')}đ`
  }

  const formatMethod = (method) => {
    if (method === 'cash') return 'Tiền mặt'
    if (method === 'bank_transfer') return 'Chuyển khoản'
    if (method === 'sepay') return 'SePay'
    return method || '-'
  }

  const formatContent = (item) => {
    const vehicle = item.vehicleType === 'car' ? 'Ô tô' : 'Xe máy'
    const plate = item.licensePlate && item.licensePlate !== '—' ? ` (${item.licensePlate})` : ''
    const months = item.months ? ` - ${item.months} tháng` : ''
    if (item.type === 'renewal') return `Gia hạn gói tháng ${vehicle}${plate}${months}`
    return `Đăng ký gói tháng ${vehicle}${plate}${months}`
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

      const response = await api.get('/api/subscriptions/payment-history', { params })

      const rows = (response.data?.data || []).map((item) => ({
        date: formatDate(item.date),
        content: formatContent(item),
        amount: formatAmount(item.amount),
        method: formatMethod(item.paymentMethod),
        status: 'Thành công',
      }))

      setHistory(rows)
    } catch (requestError) {
      const message =
        requestError?.response?.data?.message ||
        'Không tải được lịch sử thanh toán từ backend'
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
      <h3 className="page-title">Lịch sử thanh toán</h3>
      <div className="card filter-bar">
        <button className="secondary-btn" style={{ width: '180px' }} onClick={fetchHistory}>
          {isLoading ? 'Đang tải...' : 'Làm mới'}
        </button>
      </div>

      {error && <div className="error-box" style={{ marginBottom: '16px' }}>{error}</div>}

      <DataTable columns={columns} data={history} />
    </div>
  )
}

export default PaymentHistory
