import { useEffect, useState } from 'react'
import api from '../../services/api'
import DataTable from '../../components/common/DataTable'

function MonthlyRequests() {
    const [pendingItems, setPendingItems] = useState([])
    const [approvedItems, setApprovedItems] = useState([])
    const [historyItems, setHistoryItems] = useState([])
    const [tab, setTab] = useState('pending')
    const [historyFilter, setHistoryFilter] = useState('')
    const [cashConfirmed, setCashConfirmed] = useState({})
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    const fmt = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—'

    const mapVehicleType = (v) => v === 'motorbike' ? 'Xe máy' : v === 'car' ? 'Ô tô' : '-'

    const STATUS_LABEL = { pending: 'Chờ duyệt', approved: 'Chờ cấp thẻ', active: 'Hoạt động', rejected: 'Từ chối', cancelled: 'Đã hủy', expired: 'Hết hạn' }
    const STATUS_COLOR = { active: '#15803d', approved: '#1d4ed8', rejected: '#b91c1c', cancelled: '#6b7280', expired: '#6b7280' }
    const STATUS_BG   = { active: '#dcfce7', approved: '#dbeafe', rejected: '#fee2e2', cancelled: '#f3f4f6', expired: '#f3f4f6' }

    const toRow = (item) => ({
        id: item._id,
        user: item.userId?.fullName || item.userId?.username || '-',
        phone: item.userId?.phone || item.contactPhone || '-',
        licensePlate: item.vehicleId?.licensePlate || '-',
        vehicleType: mapVehicleType(item.vehicleId?.vehicleType || item.vehicleType),
        months: `${item.months} tháng`,
        totalAmount: fmt(item.totalAmount),
        rawPaymentStatus: item.paymentStatus,
        rawPaymentMethod: item.paymentMethod,
        rawStatus: item.status,
        startDate: fmtDate(item.startDate),
        endDate: fmtDate(item.endDate),
        approvedAt: fmtDate(item.approvedAt),
        notes: item.notes || '—',
        createdAt: fmtDate(item.createdAt),
        paymentQrUrl: item.paymentQrUrl,
    })

    const fetchAll = async () => {
        try {
            setIsLoading(true)
            setError('')
            const [pendingRes, approvedRes, historyRes] = await Promise.all([
                api.get('/api/subscriptions', { params: { status: 'pending', limit: 300 } }),
                api.get('/api/subscriptions', { params: { status: 'approved', limit: 300 } }),
                api.get('/api/subscriptions', { params: { limit: 300 } }),
            ])

            setPendingItems((pendingRes.data?.data || []).map(toRow))
            setApprovedItems((approvedRes.data?.data || []).map(toRow))

            const history = (historyRes.data?.data || [])
                .filter((i) => i.status !== 'pending' && i.status !== 'approved')
                .map(toRow)
            setHistoryItems(history)

            setCashConfirmed({})
        } catch (e) {
            setError(e?.response?.data?.message || 'Không tải được dữ liệu')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => { fetchAll() }, [])

    const handleApprove = async (id) => {
        try {
            setIsLoading(true)
            await api.patch(`/api/subscriptions/${id}/approve`)
            await fetchAll()
        } catch (e) {
            setError(e?.response?.data?.message || 'Không thể duyệt yêu cầu')
        } finally {
            setIsLoading(false)
        }
    }

    const handleReject = async (id) => {
        const reason = window.prompt('Nhập lý do từ chối (không bắt buộc):')
        if (reason === null) return
        try {
            setIsLoading(true)
            await api.patch(`/api/subscriptions/${id}/reject`, { reason: reason || '' })
            await fetchAll()
        } catch (e) {
            setError(e?.response?.data?.message || 'Không thể từ chối yêu cầu')
        } finally {
            setIsLoading(false)
        }
    }

    const handleIssueCard = async (id, isPaid) => {
        try {
            setIsLoading(true)
            await api.patch(`/api/subscriptions/${id}/issue-card`, {
                confirmCash: !isPaid,
            })
            await fetchAll()
        } catch (e) {
            setError(e?.response?.data?.message || 'Không thể cấp thẻ')
        } finally {
            setIsLoading(false)
        }
    }

    // --- Column definitions ---
    const pendingColumns = [
        { key: 'user', title: 'Người dùng' },
        { key: 'phone', title: 'SĐT' },
        { key: 'licensePlate', title: 'Biển số' },
        { key: 'vehicleType', title: 'Loại xe' },
        { key: 'months', title: 'Thời hạn' },
        { key: 'totalAmount', title: 'Tổng tiền' },
        { key: 'notes', title: 'Ghi chú / Tranh chấp' },
        { key: 'createdAt', title: 'Ngày đăng ký' },
        { key: 'action', title: 'Xử lý' },
    ]

    const approvedColumns = [
        { key: 'user', title: 'Người dùng' },
        { key: 'phone', title: 'SĐT' },
        { key: 'licensePlate', title: 'Biển số' },
        { key: 'vehicleType', title: 'Loại xe' },
        { key: 'months', title: 'Thời hạn' },
        { key: 'totalAmount', title: 'Tổng tiền' },
        { key: 'paymentDisplay', title: 'Thanh toán' },
        { key: 'approvedAt', title: 'Ngày duyệt' },
        { key: 'action', title: 'Cấp thẻ' },
    ]

    const historyColumns = [
        { key: 'user', title: 'Người dùng' },
        { key: 'phone', title: 'SĐT' },
        { key: 'licensePlate', title: 'Biển số' },
        { key: 'vehicleType', title: 'Loại xe' },
        { key: 'months', title: 'Thời hạn' },
        { key: 'totalAmount', title: 'Tổng tiền' },
        { key: 'statusDisplay', title: 'Trạng thái' },
        { key: 'startDate', title: 'Ngày bắt đầu' },
        { key: 'endDate', title: 'Ngày hết hạn' },
        { key: 'notes', title: 'Ghi chú / Lý do' },
    ]

    // --- Row builders ---
    const pendingRows = pendingItems.map((item) => {
        const isDisputed = item.notes && (item.notes.includes('TRANH CHẤP') || item.notes.includes('TRANG CHẤP'))
        return {
            ...item,
            licensePlate: isDisputed ? (
                <div>
                    <span style={{ fontWeight: 'bold', color: '#dc2626' }}>{item.licensePlate}</span>
                    <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '2px', fontWeight: 'bold' }}>
                        ⚠️ Tranh chấp chính chủ
                    </div>
                </div>
            ) : item.licensePlate,
            notes: isDisputed ? (
                <span style={{ color: '#dc2626', fontWeight: '500', fontSize: '13px' }}>{item.notes}</span>
            ) : item.notes,
            action: (
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        className="primary-btn"
                        style={{ height: '38px' }}
                        disabled={isLoading}
                        onClick={() => handleApprove(item.id)}
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
            ),
        }
    })

    const approvedRows = approvedItems.map((item) => {
        const isPaid = item.rawPaymentStatus === 'paid'
        const ticked = isPaid || !!cashConfirmed[item.id]
        const canIssue = ticked

        return {
            ...item,
            paymentDisplay: (
                <span style={{
                    fontSize: '11px', fontWeight: '600', padding: '2px 10px', borderRadius: '12px',
                    display: 'inline-block',
                    color: isPaid ? '#15803d' : '#b45309',
                    backgroundColor: isPaid ? '#dcfce7' : '#fef3c7',
                }}>
                    {isPaid ? 'Đã thanh toán' : 'Chờ thanh toán'}
                </span>
            ),
            action: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '180px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: isPaid ? 'default' : 'pointer', userSelect: 'none' }}>
                        <input
                            type="checkbox"
                            checked={isPaid || !!cashConfirmed[item.id]}
                            disabled={isPaid}
                            onChange={(e) =>
                                setCashConfirmed((prev) => ({ ...prev, [item.id]: e.target.checked }))
                            }
                            style={{ width: '15px', height: '15px', accentColor: '#2563eb' }}
                        />
                        {isPaid ? (
                            <span style={{ color: '#15803d', fontWeight: '600' }}>Đã thanh toán</span>
                        ) : (
                            <span style={{ color: '#92400e' }}>Xác nhận thu tiền mặt</span>
                        )}
                    </label>
                    <button
                        className="primary-btn"
                        style={{ height: '36px', opacity: canIssue ? 1 : 0.45, cursor: canIssue ? 'pointer' : 'not-allowed' }}
                        disabled={isLoading || !canIssue}
                        onClick={() => handleIssueCard(item.id, isPaid)}
                    >
                        Cấp thẻ
                    </button>
                </div>
            ),
        }
    })

    const filteredHistory = historyFilter
        ? historyItems.filter((i) => i.rawStatus === historyFilter)
        : historyItems

    const paymentMethodLabel = (method) => {
        if (method === 'sepay') return 'Thanh toán online (SePay)'
        if (method === 'cash') return 'Tiền mặt'
        if (method === 'bank_transfer') return 'Chuyển khoản'
        return '—'
    }

    const historyRows = filteredHistory.map((item) => {
        let notesDisplay
        if (item.rawStatus === 'rejected') {
            notesDisplay = item.notes && item.notes !== '—'
                ? <span style={{ color: '#b91c1c', fontSize: '13px' }}>{item.notes}</span>
                : <span style={{ color: '#9ca3af', fontSize: '13px' }}>Không có lý do</span>
        } else if (item.rawStatus === 'active') {
            notesDisplay = (
                <span style={{ fontSize: '13px', color: '#15803d', fontWeight: '600' }}>
                    {paymentMethodLabel(item.rawPaymentMethod)}
                </span>
            )
        } else {
            notesDisplay = <span style={{ color: '#9ca3af', fontSize: '13px' }}>{item.notes}</span>
        }

        return {
            ...item,
            notes: notesDisplay,
            statusDisplay: (
                <span style={{
                    fontSize: '12px', fontWeight: '600', padding: '3px 10px', borderRadius: '20px',
                    color: STATUS_COLOR[item.rawStatus] || '#6b7280',
                    backgroundColor: STATUS_BG[item.rawStatus] || '#f3f4f6',
                }}>
                    {STATUS_LABEL[item.rawStatus] || item.rawStatus}
                </span>
            ),
        }
    })

    const tabStyle = (active) => ({
        padding: '10px 24px', borderRadius: '8px 8px 0 0', fontWeight: '600', fontSize: '14px', border: 'none', cursor: 'pointer',
        backgroundColor: active ? '#fff' : '#f1f5f9',
        color: active ? '#2563eb' : '#64748b',
        borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
    })

    const Badge = ({ count }) => count > 0 ? (
        <span style={{ marginLeft: '6px', backgroundColor: '#2563eb', color: '#fff', borderRadius: '12px', padding: '1px 7px', fontSize: '11px' }}>
            {count}
        </span>
    ) : null

    return (
        <div>
            <div className="section-header">
                <h3 className="page-title" style={{ margin: 0 }}>Quản lý vé tháng</h3>
                <button className="secondary-btn" onClick={fetchAll} disabled={isLoading}>
                    {isLoading ? 'Đang tải...' : 'Làm mới'}
                </button>
            </div>

            <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #e2e8f0', marginBottom: '16px' }}>
                <button style={tabStyle(tab === 'pending')} onClick={() => setTab('pending')}>
                    Chờ duyệt <Badge count={pendingItems.length} />
                </button>
                <button style={tabStyle(tab === 'approved')} onClick={() => setTab('approved')}>
                    Chờ cấp thẻ <Badge count={approvedItems.length} />
                </button>
                <button style={tabStyle(tab === 'history')} onClick={() => setTab('history')}>
                    Lịch sử
                </button>
            </div>

            {error && <div className="error-box" style={{ marginBottom: '16px' }}>{error}</div>}

            {tab === 'pending' && (
                pendingItems.length === 0 && !isLoading
                    ? <div className="card" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Không có yêu cầu nào đang chờ duyệt.</div>
                    : <DataTable columns={pendingColumns} data={pendingRows} />
            )}

            {tab === 'approved' && (
                approvedItems.length === 0 && !isLoading
                    ? <div className="card" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Không có đăng ký nào đang chờ cấp thẻ.</div>
                    : <DataTable columns={approvedColumns} data={approvedRows} />
            )}

            {tab === 'history' && (
                <>
                    <div className="card filter-bar" style={{ marginBottom: '16px' }}>
                        <select className="select" value={historyFilter} onChange={(e) => setHistoryFilter(e.target.value)}>
                            <option value="">Tất cả trạng thái</option>
                            <option value="active">Hoạt động</option>
                            <option value="rejected">Từ chối</option>
                            <option value="expired">Hết hạn</option>
                            <option value="cancelled">Đã hủy</option>
                        </select>
                    </div>
                    <DataTable columns={historyColumns} data={historyRows} />
                </>
            )}
        </div>
    )
}

export default MonthlyRequests
