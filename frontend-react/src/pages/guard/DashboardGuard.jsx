import { useState } from 'react'
import ParkingSlotGrid from '../../components/common/ParkingSlotGrid'
import api from '../../services/api'

function DashboardGuard() {
  const [barrierStatus, setBarrierStatus] = useState(null) // null | 'opening' | 'closing' | 'open' | 'closed' | 'error'
  const [loadingOpen, setLoadingOpen] = useState(false)
  const [loadingClose, setLoadingClose] = useState(false)

  const handleOpenBarrier = async () => {
    setLoadingOpen(true)
    setBarrierStatus('opening')
    try {
      await api.post('/api/gate/open')
      setBarrierStatus('open')
      setTimeout(() => setBarrierStatus(null), 3000)
    } catch (err) {
      console.error(err)
      setBarrierStatus('error')
      setTimeout(() => setBarrierStatus(null), 3000)
    } finally {
      setLoadingOpen(false)
    }
  }

  const handleCloseBarrier = async () => {
    setLoadingClose(true)
    setBarrierStatus('closing')
    try {
      await api.post('/api/gate/close')
      setBarrierStatus('closed')
      setTimeout(() => setBarrierStatus(null), 3000)
    } catch (err) {
      console.error(err)
      setBarrierStatus('error')
      setTimeout(() => setBarrierStatus(null), 3000)
    } finally {
      setLoadingClose(false)
    }
  }

  const getStatusBadge = () => {
    if (!barrierStatus) return null
    const map = {
      opening: { label: '⏳ Đang mở...', color: '#f59e0b' },
      closing: { label: '⏳ Đang đóng...', color: '#f59e0b' },
      open: { label: '✅ Barrier đã MỞ', color: '#10b981' },
      closed: { label: '🔒 Barrier đã ĐÓNG', color: '#6366f1' },
      error: { label: '❌ Lỗi kết nối MQTT', color: '#ef4444' },
    }
    const s = map[barrierStatus]
    return (
      <div style={{
        marginTop: '10px',
        padding: '8px 14px',
        borderRadius: '8px',
        background: s.color + '22',
        border: `1px solid ${s.color}`,
        color: s.color,
        fontWeight: 600,
        fontSize: '13px',
        textAlign: 'center',
        animation: 'fadeInUp 0.3s ease',
      }}>
        {s.label}
      </div>
    )
  }

  return (
    <div>

      <div className="lane-split single-gate">
        <div className="card compare-card lane-exit">
          <div className="card-header">
            <div>
              <h3 className="card-title">Quản lý vào ra</h3>
            </div>
            <span className="match-badge success">Chế độ: Tự động</span>
          </div>

          <div className="lane-exit-body">
            <div className="lane-exit-frames">
              <div className="frame frame-vehicle in">
                <div className="frame-label accent">Xe vào</div>
                <img
                  className="frame-media"
                  src="http://localhost:8000/api/video-stream"
                  alt="Camera xe vào"
                />
              </div>

              <div className="frame frame-vehicle out">
                <div className="frame-label accent">Xe ra</div>
                <img
                  className="frame-media"
                  src="http://localhost:8000/api/video-stream"
                  alt="Camera xe ra"
                />
              </div>
            </div>

            <div className="lane-notice">
              Hệ thống đang theo dõi lượt xe vào/ra.
            </div>

            <div className="lane-exit-details">
              <div className="lane-exit-plates">
                <div className="plate-block in">
                  <input
                    className="plate-input"
                    type="text"
                    value="59A1-123.45"
                    readOnly
                  />

                  <div className="plate-wrap in">
                    <div className="plate-label accent">Biển số vào</div>
                    <img
                      className="plate-media"
                      src="http://localhost:8000/api/video-stream"
                      alt="Biển số xe vào"
                    />
                  </div>

                  <div className="plate-time">Giờ vào: 09:15 29/04/2026</div>
                </div>

                <div className="total-time">Tổng thời gian: 47 phút</div>

                <div className="plate-block out">
                  <input
                    className="plate-input"
                    type="text"
                    value="59A1-987.65"
                    readOnly
                  />

                  <div className="plate-wrap out">
                    <div className="plate-label accent">Biển số ra</div>
                    <img
                      className="plate-media"
                      src="http://localhost:8000/api/video-stream"
                      alt="Biển số xe ra"
                    />
                  </div>

                  <div className="plate-time">Giờ ra: 10:02 29/04/2026</div>
                </div>
              </div>

              <div className="card-info">
                <div className="info-row">
                  <span>Số thẻ</span>
                  <strong>THE-09124</strong>
                </div>

                <div className="info-row">
                  <span>Loại thẻ</span>
                  <strong>Thẻ tháng xe máy</strong>
                </div>

                <div className="info-row">
                  <span>Hạn thẻ</span>
                  <strong>15/05/2026</strong>
                </div>

                <div className="info-row">
                  <span>Chủ thẻ</span>
                  <strong>Nguyễn Văn A</strong>
                </div>

                <div className="info-row">
                  <span>Số tiền</span>
                  <strong>8.000 VND</strong>
                </div>

                {/* ===== ĐIỀU KHIỂN BARRIER THỦ CÔNG ===== */}
                <div className="barrier-control-panel">
                  <div className="barrier-control-title">
                    <span className="barrier-icon">🚧</span>
                    Điều khiển barrier
                  </div>
                  <div className="barrier-control-buttons">
                    <button
                      id="btn-open-barrier"
                      className="barrier-btn open"
                      onClick={handleOpenBarrier}
                      disabled={loadingOpen || loadingClose}
                    >
                      {loadingOpen ? (
                        <span className="btn-spinner" />
                      ) : (
                        <span className="btn-icon">▲</span>
                      )}
                      Mở cổng
                    </button>
                    <button
                      id="btn-close-barrier"
                      className="barrier-btn close"
                      onClick={handleCloseBarrier}
                      disabled={loadingOpen || loadingClose}
                    >
                      {loadingClose ? (
                        <span className="btn-spinner" />
                      ) : (
                        <span className="btn-icon">▼</span>
                      )}
                      Đóng cổng
                    </button>
                  </div>
                  {getStatusBadge()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '24px' }}>
        <ParkingSlotGrid />
      </div>
    </div>
  )
}

export default DashboardGuard