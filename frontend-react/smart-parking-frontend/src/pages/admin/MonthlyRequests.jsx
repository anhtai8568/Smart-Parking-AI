import { useEffect, useState } from 'react'
import api from '../../services/api'
import DataTable from '../../components/common/DataTable'

function MonthlyRequests() {
    const [items, setItems] = useState([])
    const [statusFilter, setStatusFilter] = useState('pending')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    const formatCurrency = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`

    const mapVehicleType = (value) => {
        if (value === 'motorbike') return 'Xe máy'
        if (value === 'car') return 'Ô tô'
        return '-'
    }

    const mapPaymentMethod = (value) => {
        if (value === 'cash') return 'Tiền mặt'
        if (value === 'bank_transfer') return 'Chuyển khoản'
        return '-'
    }

    const mapStatus = (value) => {
        if (value === 'pending') return 'Chờ duyệt'
        if (value === 'active') return 'Đã duyệt'
        if (value === 'rejected') return 'Từ chối'
        if (value === 'cancelled') return 'Đã hủy'
        if (value === 'expired') return 'Hết hạn'
        return value || 'Không xác định'
    }

    const fetchItems = async () => {
        try {
            setIsLoading(true)
            setError('')

            const params = {}
            if (statusFilter) {
                params.status = statusFilter
            }

            const response = await api.get('/api/subscriptions', { params })
            const rows = (response.data?.data || []).map((item) => ({
                id: item._id,
                user: item.userId?.fullName || item.userId?.username || '-',
                phone: item.userId?.phone || item.contactPhone || '-',
                licensePlate: item.vehicleId?.licensePlate || '-',
                vehicleType: mapVehicleType(item.vehicleId?.vehicleType),
                months: `${item.months} tháng`,
                totalAmount: formatCurrency(item.totalAmount),
                paymentMethod: mapPaymentMethod(item.paymentMethod),
                status: mapStatus(item.status),
                rawStatus: item.status,
            }))

            setItems(rows)
        } catch (requestError) {
            const message =
                requestError?.response?.data?.message ||
                'Không tải được danh sách đăng ký vé tháng'
            setError(message)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchItems()
    }, [statusFilter])

    const handleApprove = async (id, method) => {
        try {
            setIsLoading(true)
            await api.patch(`/api/subscriptions/${id}/approve`, {
                paymentMethod: method,
            })
            await fetchItems()
        } catch (requestError) {
            const message =
                requestError?.response?.data?.message ||
                'Không thể duyệt yêu cầu'
            setError(message)
        } finally {
            setIsLoading(false)
        }
    }

    const handleReject = async (id) => {
        const reason = window.prompt('Nhập lý do từ chối (không bắt buộc):')
        try {
            setIsLoading(true)
            await api.patch(`/api/subscriptions/${id}/reject`, {
                reason: reason || '',
            })
            await fetchItems()
        } catch (requestError) {
            const message =
                requestError?.response?.data?.message ||
                'Không thể từ chối yêu cầu'
            setError(message)
        } finally {
            setIsLoading(false)
        }
    }

    const columns = [
        { key: 'user', title: 'Người dùng' },
        { key: 'phone', title: 'SĐT' },
        { key: 'licensePlate', title: 'Biển số' },
        { key: 'vehicleType', title: 'Loại xe' },
        { key: 'months', title: 'Thời hạn' },
        { key: 'totalAmount', title: 'Tổng tiền' },
        { key: 'paymentMethod', title: 'Thanh toán' },
        { key: 'status', title: 'Trạng thái' },
        { key: 'action', title: 'Xử lý' },
    ]

    const rowsWithActions = items.map((item) => ({
        ...item,
        action: item.rawStatus === 'pending' ? (
            <div style={{ display: 'flex', gap: '8px' }}>
                <button
                    className="primary-btn"
                    style={{ height: '38px' }}
                    disabled={isLoading}
                    onClick={() => handleApprove(item.id, 'bank_transfer')}
                >
                    Duyệt
                </button>
                <button
                    className="secondary-btn"
                    style={{ height: '38px' }}
                    disabled={isLoading}
                    onClick={() => handleReject(item.id)}
                >
                    Từ chối
                </button>
            </div>
        ) : (
            '-'
        ),
    }))

    return (
        <div>
            <div className="section-header">
                <h3 className="page-title" style={{ margin: 0 }}>Duyệt đăng ký vé tháng</h3>
                <button className="secondary-btn" onClick={fetchItems} disabled={isLoading}>
                    {isLoading ? 'Đang tải...' : 'Làm mới'}
                </button>
            </div>

            <div className="card filter-bar">
                <select
                    className="select"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                >
                    <option value="pending">Chờ duyệt</option>
                    <option value="active">Đã duyệt</option>
                    <option value="rejected">Từ chối</option>
                    <option value="expired">Hết hạn</option>
                    <option value="cancelled">Đã hủy</option>
                </select>
            </div>

            {error && <div className="error-box" style={{ marginBottom: '16px' }}>{error}</div>}

            <DataTable columns={columns} data={rowsWithActions} />
        </div>
    )
}

export default MonthlyRequests
