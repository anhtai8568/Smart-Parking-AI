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
        if (value === 'sepay') return 'SePay QR'
        return '-'
    }

    const mapPaymentStatus = (method, status) => {
        if (method !== 'sepay') return null
        return status === 'paid'
            ? { label: 'Đã nhận tiền', color: '#15803d', bg: '#dcfce7' }
            : { label: 'Chờ thanh toán', color: '#b45309', bg: '#fef3c7' }
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
                vehicleType: mapVehicleType(item.vehicleId?.vehicleType || item.vehicleType),
                months: `${item.months} tháng`,
                totalAmount: formatCurrency(item.totalAmount),
                paymentMethod: item.paymentMethod,
                status: mapStatus(item.status),
                rawStatus: item.status,
                rawPaymentMethod: item.paymentMethod,
                rawPaymentStatus: item.paymentStatus,
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
        { key: 'paymentMethodDisplay', title: 'Thanh toán' },
        { key: 'status', title: 'Trạng thái' },
        { key: 'action', title: 'Xử lý' },
    ]

    const rowsWithActions = items.map((item) => {
        const paymentBadge = mapPaymentStatus(item.rawPaymentMethod, item.rawPaymentStatus)
        const canApprove = item.rawPaymentMethod !== 'sepay' || item.rawPaymentStatus === 'paid'

        return {
            ...item,
            paymentMethodDisplay: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span>{mapPaymentMethod(item.rawPaymentMethod)}</span>
                    {paymentBadge && (
                        <span style={{
                            fontSize: '11px', fontWeight: '600',
                            padding: '2px 8px', borderRadius: '12px',
                            color: paymentBadge.color, backgroundColor: paymentBadge.bg,
                            display: 'inline-block', width: 'fit-content',
                        }}>
                            {paymentBadge.label}
                        </span>
                    )}
                </div>
            ),
            action: item.rawStatus === 'pending' ? (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                        className="primary-btn"
                        style={{ height: '38px', opacity: canApprove ? 1 : 0.45, cursor: canApprove ? 'pointer' : 'not-allowed' }}
                        disabled={isLoading || !canApprove}
                        title={!canApprove ? 'Chờ SePay xác nhận thanh toán' : ''}
                        onClick={() => handleApprove(item.id, item.rawPaymentMethod)}
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
            ) : '-',
        }
    })

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
