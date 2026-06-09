import { useState, useEffect, useCallback, useRef } from 'react'
import ParkingSlotGrid from '../../components/common/ParkingSlotGrid'
import api from '../../services/api'

const AI_URL = 'http://localhost:8000'

const EMPTY_SCAN = { plate: null, apriltag: null, image_b64: null, timestamp: null, rfid: null }

// Phát tiếng beep cảnh báo qua Web Audio API
function playAlertBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'square'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.4)
  } catch (_) {}
}

function DashboardGuard() {
  // ── Barrier control ──
  const [barrierStatus, setBarrierStatus] = useState(null)
  const [loadingOpen,   setLoadingOpen]   = useState(false)
  const [loadingClose,  setLoadingClose]  = useState(false)

  // ── Scan results từ AI (biển số + ảnh) ──
  const [scanIn,  setScanIn]  = useState(EMPTY_SCAN)
  const [scanOut, setScanOut] = useState(EMPTY_SCAN)

  // ── Zoom Image Modal State ──
  const [zoomImage, setZoomImage] = useState(null)

  // ── Alert: không nhận diện được biển số ──
  // gate = 'in' | 'out' | null
  const [noPlateAlert, setNoPlateAlert] = useState(null)
  const prevScanIn  = useRef(EMPTY_SCAN)
  const prevScanOut = useRef(EMPTY_SCAN)
  const alertTimer  = useRef(null)

  // ── Poll /api/latest-scan mỗi 2 giây ──
  const fetchLatestScan = useCallback(async () => {
    try {
      const res  = await fetch(`${AI_URL}/api/latest-scan`)
      const json = await res.json()
      if (json.status === 'success') {
        const newIn  = json.data.in   || EMPTY_SCAN
        const newOut = json.data.out  || EMPTY_SCAN

        // Phát hiện scan MỚI (timestamp thay đổi) nhưng KHÔNG có biển số
        const isNewScanIn  = newIn.timestamp  !== prevScanIn.current.timestamp
        const isNewScanOut = newOut.timestamp !== prevScanOut.current.timestamp

        // Lỗi xảy ra khi có cảnh báo rõ ràng từ backend, hoặc khi đã quẹt thẻ RFID mà vẫn không nhận diện được biển số
        const hasErrorIn = newIn.warning || (newIn.rfid && !newIn.plate);
        const hasErrorOut = newOut.warning || (newOut.rfid && !newOut.plate);

        if (isNewScanIn && hasErrorIn) {
          setNoPlateAlert('in')
          playAlertBeep()
          clearTimeout(alertTimer.current)
          alertTimer.current = setTimeout(() => setNoPlateAlert(null), 12000)
        } else if (isNewScanIn && newIn.plate && !newIn.warning) {
          setNoPlateAlert(null)
        }

        if (isNewScanOut && hasErrorOut) {
          setNoPlateAlert('out')
          playAlertBeep()
          clearTimeout(alertTimer.current)
          alertTimer.current = setTimeout(() => setNoPlateAlert(null), 12000)
        } else if (isNewScanOut && newOut.plate && !newOut.warning) {
          setNoPlateAlert(null)
        }

        prevScanIn.current  = newIn
        prevScanOut.current = newOut
        setScanIn(newIn)
        setScanOut(newOut)
      }
    } catch (_) {}
  }, [])

  useEffect(() => {
    fetchLatestScan()
    const id = setInterval(fetchLatestScan, 2000)
    return () => {
      clearInterval(id)
      clearTimeout(alertTimer.current)
    }
  }, [fetchLatestScan])

  // ── Barrier handlers ──
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
      open:    { label: '✅ Barrier đã MỞ', color: '#10b981' },
      closed:  { label: '🔒 Barrier đã ĐÓNG', color: '#6366f1' },
      error:   { label: '❌ Lỗi kết nối MQTT', color: '#ef4444' },
    }
    const s = map[barrierStatus]
    return (
      <div style={{
        marginTop: '10px', padding: '8px 14px', borderRadius: '8px',
        background: s.color + '22', border: `1px solid ${s.color}`,
        color: s.color, fontWeight: 600, fontSize: '13px',
        textAlign: 'center', animation: 'fadeInUp 0.3s ease',
      }}>
        {s.label}
      </div>
    )
  }

  // ── Helper: hiển thị biển số + AprilTag ──
  const formatPlateLabel = (scan) => {
    if (!scan.plate && !scan.apriltag) return '—'
    const parts = []
    if (scan.plate)    parts.push(scan.plate)
    if (scan.apriltag != null) parts.push(`AprilTag #${scan.apriltag}`)
    return parts.join('  |  ')
  }

  // ── PlateBlock component (dùng lại cho vào/ra) ──
  const PlateBlock = ({ scan, direction }) => {
    const isIn    = direction === 'in'
    const label   = isIn ? 'Biển số vào' : 'Biển số ra'
    const timeLabel = isIn ? 'Giờ vào' : 'Giờ ra'
    const cls     = isIn ? 'in' : 'out'

    return (
      <div className={`plate-block ${cls}`}>
        {/* Text biển số */}
        <input
          className="plate-input"
          type="text"
          value={formatPlateLabel(scan)}
          readOnly
          title={scan.plate || ''}
          style={{ fontSize: scan.plate ? '13px' : '11px', color: scan.plate ? '#0f172a' : '#94a3b8' }}
        />

        {/* Ảnh chụp lúc sensor kích hoạt */}
        <div 
          className={`plate-wrap ${cls}`} 
          style={{ position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
          onClick={() => {
            const currentImgSrc = scan.image_b64 || `${AI_URL}/api/video-stream`;
            setZoomImage(currentImgSrc);
          }}
          title="Click để phóng to hình ảnh"
        >
          <div className="plate-label accent">{label}</div>
          {scan.image_b64 ? (
            <img
              className="plate-media"
              src={scan.image_b64}
              alt={label}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            // Fallback: stream video liên tục khi chưa có ảnh chụp
            <img
              className="plate-media"
              src={`${AI_URL}/api/video-stream`}
              alt={`Camera ${label}`}
            />
          )}
          {/* Badge "Đang chờ" khi chưa có ảnh */}
          {!scan.image_b64 && (
            <div style={{
              position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.6)', color: '#fff',
              fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px',
              whiteSpace: 'nowrap',
            }}>
              Chờ sensor kích hoạt
            </div>
          )}
        </div>

        <div className="plate-time">
          {scan.timestamp ? `${timeLabel}: ${scan.timestamp}` : `${timeLabel}: —`}
        </div>
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

          {/* ── CẢNH BÁO: Lỗi xác thực hoặc không nhận diện được biển số ── */}
          {noPlateAlert && (
            <div className="no-plate-alert">
              <div className="no-plate-alert-icon">⚠️</div>
              <div className="no-plate-alert-body">
                <div className="no-plate-alert-title">
                  {noPlateAlert === 'in' ? 'Cảnh báo cổng vào!' : 'Cảnh báo cổng ra!'}
                </div>
                <div className="no-plate-alert-msg">
                  {noPlateAlert === 'in' 
                    ? (scanIn.warning || 'Không nhận diện được biển số xe vào! Vui lòng nhắc người dùng điều chỉnh xe vào đúng khung hình camera hoặc giơ biển số xe lên trước ống kính.')
                    : (scanOut.warning || 'Không nhận diện được biển số xe ra! Vui lòng nhắc người dùng điều chỉnh xe vào đúng khung hình camera hoặc giơ biển số xe lên trước ống kính.')
                  }
                </div>
              </div>
              <button
                className="no-plate-alert-dismiss"
                onClick={() => setNoPlateAlert(null)}
                title="Đã xử lý"
              >
                ✕
              </button>
            </div>
          )}

          <div className="lane-exit-body">
            {/* Camera stream liên tục — xe vào / xe ra */}
            <div className="lane-exit-frames">
              <div className="frame frame-vehicle in">
                <div className="frame-label accent">Xe vào</div>
                <img className="frame-media" src={`${AI_URL}/api/video-stream`} alt="Camera xe vào" />
              </div>
              <div className="frame frame-vehicle out">
                <div className="frame-label accent">Xe ra</div>
                <img className="frame-media" src={`${AI_URL}/api/video-stream`} alt="Camera xe ra" />
              </div>
            </div>

            <div className="lane-notice">
              Hệ thống đang theo dõi lượt xe vào/ra. Ảnh biển số cập nhật khi cảm biến kích hoạt.
            </div>

            <div className="lane-exit-details">
              <div className="lane-exit-plates">
                <PlateBlock scan={scanIn}  direction="in" />
                <div className="total-time">
                  {(scanIn.timestamp && scanOut.timestamp) ? 'Đang xử lý...' : 'Chờ lượt xe'}
                </div>
                <PlateBlock scan={scanOut} direction="out" />
              </div>

              <div className="card-info">
                {scanIn.warning && (
                  <div style={{
                    padding: '6px 10px', borderRadius: '8px',
                    background: '#fef2f2', border: '1px solid #f87171',
                    color: '#dc2626', fontWeight: 600, fontSize: '12px',
                    textAlign: 'center', marginBottom: '8px', animation: 'fadeInUp 0.3s ease'
                  }}>
                    ⚠️ Cổng vào: {scanIn.warning}
                  </div>
                )}

                {scanOut.warning && (
                  <div style={{
                    padding: '6px 10px', borderRadius: '8px',
                    background: '#fef2f2', border: '1px solid #f87171',
                    color: '#dc2626', fontWeight: 600, fontSize: '12px',
                    textAlign: 'center', marginBottom: '8px', animation: 'fadeInUp 0.3s ease'
                  }}>
                    ⚠️ Cổng ra: {scanOut.warning}
                  </div>
                )}

                {/* CỔNG VÀO SECTION */}
                <div className="gate-info-section" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '12px' }}>
                  <div style={{ fontWeight: 700, color: '#1d4ed8', marginBottom: '8px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>📥 CỔNG VÀO</span>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: scanIn.warning ? '#dc2626' : (scanIn.plate ? '#16a34a' : '#94a3b8') }}>
                      {scanIn.warning ? 'LỖI' : (scanIn.plate ? 'ĐÃ NHẬN DIỆN' : 'CHỜ XE')}
                    </span>
                  </div>
                  
                  <div className="info-row">
                    <span>Mã thẻ RFID vào</span>
                    <strong style={{ color: scanIn.rfid ? '#1d4ed8' : '#64748b' }}>
                      {scanIn.rfid || '—'}
                    </strong>
                  </div>

                  <div className="info-row">
                    <span>Biển số vào</span>
                    <strong style={{ color: scanIn.plate ? '#0f172a' : '#64748b' }}>
                      {scanIn.plate || '—'}
                    </strong>
                  </div>

                  {scanIn.apriltag != null && (
                    <div className="info-row">
                      <span>AprilTag ID</span>
                      <strong>#{scanIn.apriltag}</strong>
                    </div>
                  )}

                  <div className="info-row">
                    <span>Giờ vào</span>
                    <strong>{scanIn.timestamp || '—'}</strong>
                  </div>
                </div>

                {/* CỔNG RA SECTION */}
                <div className="gate-info-section" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '12px' }}>
                  <div style={{ fontWeight: 700, color: '#047857', marginBottom: '8px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>📤 CỔNG RA</span>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: scanOut.warning ? '#dc2626' : (scanOut.plate ? '#16a34a' : '#94a3b8') }}>
                      {scanOut.warning ? 'LỖI' : (scanOut.plate ? 'ĐÃ NHẬN DIỆN' : 'CHỜ XE')}
                    </span>
                  </div>

                  <div className="info-row">
                    <span>Mã thẻ RFID ra</span>
                    <strong style={{ color: scanOut.rfid ? '#047857' : '#64748b' }}>
                      {scanOut.rfid || '—'}
                    </strong>
                  </div>

                  <div className="info-row">
                    <span>Biển số ra</span>
                    <strong style={{ color: scanOut.plate ? '#0f172a' : '#64748b' }}>
                      {scanOut.plate || '—'}
                    </strong>
                  </div>

                  {scanOut.apriltag != null && (
                    <div className="info-row">
                      <span>AprilTag ID</span>
                      <strong>#{scanOut.apriltag}</strong>
                    </div>
                  )}

                  <div className="info-row">
                    <span>Giờ ra</span>
                    <strong>{scanOut.timestamp || '—'}</strong>
                  </div>
                </div>

                {/* ── Điều khiển barrier ── */}
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
                      {loadingOpen ? <span className="btn-spinner" /> : <span className="btn-icon">▲</span>}
                      Mở cổng
                    </button>
                    <button
                      id="btn-close-barrier"
                      className="barrier-btn close"
                      onClick={handleCloseBarrier}
                      disabled={loadingOpen || loadingClose}
                    >
                      {loadingClose ? <span className="btn-spinner" /> : <span className="btn-icon">▼</span>}
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

      {/* Zoom Image Modal */}
      {zoomImage && (
        <div 
          onClick={() => setZoomImage(null)}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            cursor: 'zoom-out',
            animation: 'fadeInUp 0.2s ease-out'
          }}
        >
          <img 
            src={zoomImage} 
            alt="Phóng to hình ảnh" 
            style={{ 
              maxWidth: '90%', 
              maxHeight: '90%', 
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              border: '3px solid #f59e0b'
            }} 
          />
          <div style={{
            position: 'absolute',
            top: '20px', right: '20px',
            color: '#fff', fontSize: '18px', fontWeight: 'bold',
            background: 'rgba(0,0,0,0.6)', padding: '6px 14px', borderRadius: '20px'
          }}>✕ Đóng</div>
        </div>
      )}
    </div>
  )
}

export default DashboardGuard