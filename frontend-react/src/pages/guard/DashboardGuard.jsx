import { useState, useEffect, useCallback, useRef } from 'react'
import ParkingSlotGrid from '../../components/common/ParkingSlotGrid'
import api from '../../services/api'

const AI_URL = 'http://localhost:8000'

const EMPTY_SCAN = { plate: null, apriltag: null, image_b64: null, timestamp: null, rfid: null }

/**
 * Parse warning string từ Node.js backend thành object có cấu trúc.
 * Các format:
 *   "Lệch biển số lúc ra! Vào: 30A12345, Ra: Không đọc được"
 *   "Lệch biển số xe tháng! Đăng ký: 30A12345, AI đọc: 30B12345"
 *   Các trường hợp khác → chỉ trả về raw message
 */
function parseWarning(warning) {
  if (!warning) return null
  // Case 1: Lệch biển số lúc vào/ra (xe vãng lai)
  let m = warning.match(/Vào:\s*([^,]+),\s*Ra:\s*(.+)$/i)
  if (m) return { type: 'mismatch_visitor', plateIn: m[1].trim(), plateOut: m[2].trim() }
  // Case 2: Xe tháng lệch biển
  m = warning.match(/Đăng\s*ký:\s*([^,]+),\s*AI\s*đọc:\s*(.+)$/i)
  if (m) return { type: 'mismatch_monthly', registered: m[1].trim(), scanned: m[2].trim() }
  return { type: 'info' }
}

// AudioContext dùng chung – tạo 1 lần duy nhất sau user gesture, tránh bị trình duyệt chặn
let _audioCtx = null
function getAudioCtx() {
  if (!_audioCtx) {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  return _audioCtx
}

// Phát tiếng beep cảnh báo qua Web Audio API
function playAlertBeep() {
  try {
    const ctx = getAudioCtx()
    // Resume context nếu bị suspend (policy của trình duyệt)
    const doPlay = () => {
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
    }
    if (ctx.state === 'suspended') {
      ctx.resume().then(doPlay).catch(() => {})
    } else {
      doPlay()
    }
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

  // ── GateInfoBlock: hiển thị thông tin cổng + panel đối chiếu biển khi có lệch ──
  const GateInfoBlock = ({ scan, direction }) => {
    const isIn    = direction === 'in'
    const label   = isIn ? '📥 CỔNG VÀO' : '📤 CỔNG RA'
    const clr     = isIn ? '#1d4ed8' : '#047857'
    const rfidClr = isIn ? '#1d4ed8' : '#047857'
    const timeLabel = isIn ? 'Giờ vào' : 'Giờ ra'
    const rfidLabel = isIn ? 'Mã thẻ RFID vào' : 'Mã thẻ RFID ra'
    const plateLabel = isIn ? 'Biển số vào' : 'Biển số ra'

    const statusColor = scan.warning ? '#dc2626' : (scan.plate ? '#16a34a' : '#94a3b8')
    const statusText  = scan.warning ? 'LỖI' : (scan.plate ? 'ĐÃ NHẬN DIỆN' : 'CHỜ XE')

    const parsed = parseWarning(scan.warning)

    return (
      <div className="gate-info-section" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '12px' }}>
        {/* Header */}
        <div style={{ fontWeight: 700, color: clr, marginBottom: '8px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{label}</span>
          <span style={{ fontSize: '11px', fontWeight: 600, color: statusColor }}>{statusText}</span>
        </div>

        {/* Info rows */}
        <div className="info-row">
          <span>{rfidLabel}</span>
          <strong style={{ color: scan.rfid ? rfidClr : '#64748b', fontFamily: 'monospace', fontSize: '13px' }}>
            {scan.rfid || '—'}
          </strong>
        </div>

        <div className="info-row">
          <span>{plateLabel}</span>
          <strong style={{ color: scan.plate ? '#0f172a' : '#64748b', fontFamily: 'monospace', fontSize: '13px', letterSpacing: '0.5px' }}>
            {scan.plate || '—'}
          </strong>
        </div>

        {scan.apriltag != null && (
          <div className="info-row">
            <span>AprilTag ID</span>
            <strong>#{scan.apriltag}</strong>
          </div>
        )}

        {scan.entryTime ? (
          <>
            <div className="info-row">
              <span>Giờ vào</span>
              <strong>{scan.entryTime}</strong>
            </div>
            <div className="info-row">
              <span>Giờ ra</span>
              <strong>{scan.exitTime || scan.timestamp || '—'}</strong>
            </div>
          </>
        ) : (
          <div className="info-row">
            <span>{timeLabel}</span>
            <strong>{scan.timestamp || '—'}</strong>
          </div>
        )}

        {scan.fee !== undefined && scan.fee !== null && (
          <div className="info-row">
            <span>Phí đỗ xe</span>
            <strong style={{ color: '#dc2626', fontSize: '14px', fontWeight: 800 }}>
              {Number(scan.fee).toLocaleString('vi-VN')} VNĐ
            </strong>
          </div>
        )}

        {/* ── PANEL THANH TOÁN CHO XE RA ── */}
        {!isIn && scan.fee > 0 && (
          <div style={{
            marginTop: '12px',
            padding: '12px',
            borderRadius: '10px',
            border: `1px solid ${scan.paymentStatus === 'paid' ? '#10b981' : '#f59e0b'}`,
            background: scan.paymentStatus === 'paid' ? '#f0fdf4' : '#fffbeb',
            textAlign: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
            animation: 'fadeInUp 0.3s ease'
          }}>
            <div style={{ fontWeight: 800, fontSize: '11px', color: '#1e293b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              💳 HÌNH THỨC THANH TOÁN
            </div>
            
            {scan.paymentStatus === 'paid' ? (
              <div style={{ color: '#15803d', fontWeight: 800, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '6px 0' }}>
                <span style={{ fontSize: '16px' }}>✓</span> ĐÃ THANH TOÁN THÀNH CÔNG!
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px', lineHeight: '1.4' }}>
                  Quét mã VietQR chuyển khoản (Hệ thống tự nhận diện và mở cổng):
                </div>
                {scan.qrUrl && (
                  <div style={{ margin: '8px auto', width: '140px', height: '140px', background: '#fff', padding: '6px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src={scan.qrUrl} alt="Sepay VietQR Code" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  </div>
                )}
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '4px 8px', borderRadius: '6px', display: 'inline-block', fontFamily: 'monospace', border: '1px solid #fde68a', marginBottom: '8px' }}>
                  Cú pháp: DX {scan.rfid}
                </div>
                
                <div style={{ borderTop: '1px dashed #cbd5e1', margin: '8px 0' }}></div>
                
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>
                  Hoặc nếu người dùng trả tiền mặt:
                </div>
                <button
                  onClick={async () => {
                    try {
                      await api.post('/api/gate/open', { gate: 'out' });
                    } catch (err) {
                      alert('Lỗi khi mở cổng thủ công: ' + err.message);
                    }
                  }}
                  style={{
                    background: '#16a34a', color: '#fff', border: 'none',
                    padding: '8px 14px', borderRadius: '8px', fontSize: '12px',
                    fontWeight: 700, cursor: 'pointer', display: 'inline-flex',
                    alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(22,163,74,0.2)',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#15803d'}
                  onMouseOut={(e) => e.currentTarget.style.background = '#16a34a'}
                >
                  💵 Xác nhận tiền mặt & Mở cổng
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── PANEL ĐỐI CHIẾU BIỂN SỐ (chỉ hiện khi có lệch biển) ── */}
        {parsed && parsed.type === 'mismatch_visitor' && (
          <div style={{
            marginTop: '10px', borderRadius: '10px', overflow: 'hidden',
            border: '2px solid #fbbf24', background: '#fffbeb',
            animation: 'fadeInUp 0.3s ease'
          }}>
            <div style={{ padding: '6px 12px', background: '#f59e0b', color: '#fff', fontWeight: 700, fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🔍 ĐỐI CHIẾU BIỂN SỐ — BẢO VỆ KIỂM TRA
            </div>
            <div style={{ padding: '10px 12px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '8px', alignItems: 'center' }}>
              {/* Biển lúc vào */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Lúc vào (DB)</div>
                <div style={{
                  padding: '6px 10px', borderRadius: '8px',
                  background: '#f0fdf4', border: '2px solid #86efac',
                  fontFamily: 'monospace', fontWeight: 800, fontSize: '14px',
                  color: '#15803d', letterSpacing: '1px'
                }}>
                  {parsed.plateIn}
                </div>
              </div>
              {/* Mũi tên */}
              <div style={{ fontSize: '18px', color: '#94a3b8', fontWeight: 700 }}>⟷</div>
              {/* Biển lúc ra */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Lúc ra (AI)</div>
                <div style={{
                  padding: '6px 10px', borderRadius: '8px',
                  background: parsed.plateOut === 'Không đọc được' ? '#f8fafc' : '#fef2f2',
                  border: `2px solid ${parsed.plateOut === 'Không đọc được' ? '#cbd5e1' : '#fca5a5'}`,
                  fontFamily: 'monospace', fontWeight: 800, fontSize: '14px',
                  color: parsed.plateOut === 'Không đọc được' ? '#94a3b8' : '#b91c1c',
                  letterSpacing: '1px'
                }}>
                  {parsed.plateOut}
                </div>
              </div>
            </div>
            <div style={{ padding: '6px 12px', background: '#fef9c3', fontSize: '11px', color: '#92400e', fontWeight: 600, borderTop: '1px solid #fde68a' }}>
              💡 Nếu AI nhầm 1–2 ký tự, bảo vệ có thể xác nhận và mở cổng thủ công.
            </div>
          </div>
        )}

        {parsed && parsed.type === 'mismatch_monthly' && (
          <div style={{
            marginTop: '10px', borderRadius: '10px', overflow: 'hidden',
            border: '2px solid #fbbf24', background: '#fffbeb',
            animation: 'fadeInUp 0.3s ease'
          }}>
            <div style={{ padding: '6px 12px', background: '#f59e0b', color: '#fff', fontWeight: 700, fontSize: '11px' }}>
              🔍 ĐỐI CHIẾU BIỂN SỐ XE THÁNG — BẢO VỆ KIỂM TRA
            </div>
            <div style={{ padding: '10px 12px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '8px', alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Đăng ký (DB)</div>
                <div style={{
                  padding: '6px 10px', borderRadius: '8px',
                  background: '#f0fdf4', border: '2px solid #86efac',
                  fontFamily: 'monospace', fontWeight: 800, fontSize: '14px',
                  color: '#15803d', letterSpacing: '1px'
                }}>
                  {parsed.registered}
                </div>
              </div>
              <div style={{ fontSize: '18px', color: '#94a3b8', fontWeight: 700 }}>⟷</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>AI đọc được</div>
                <div style={{
                  padding: '6px 10px', borderRadius: '8px',
                  background: '#fef2f2', border: '2px solid #fca5a5',
                  fontFamily: 'monospace', fontWeight: 800, fontSize: '14px',
                  color: '#b91c1c', letterSpacing: '1px'
                }}>
                  {parsed.scanned}
                </div>
              </div>
            </div>
            <div style={{ padding: '6px 12px', background: '#fef9c3', fontSize: '11px', color: '#92400e', fontWeight: 600, borderTop: '1px solid #fde68a' }}>
              💡 Nếu AI nhầm 1–2 ký tự, bảo vệ có thể xác nhận và mở cổng thủ công.
            </div>
          </div>
        )}

        {/* Raw warning cho các trường hợp khác */}
        {scan.warning && parsed && parsed.type === 'info' && (
          <div style={{
            marginTop: '8px', padding: '6px 10px', borderRadius: '8px',
            background: '#fef2f2', border: '1px solid #f87171',
            color: '#dc2626', fontWeight: 600, fontSize: '11px',
            animation: 'fadeInUp 0.3s ease'
          }}>
            ⚠️ {scan.warning}
          </div>
        )}
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

                {/* CỔNG VÀO SECTION */}
                <GateInfoBlock
                  scan={scanIn}
                  direction="in"
                />

                {/* CỔNG RA SECTION */}
                <GateInfoBlock
                  scan={scanOut}
                  direction="out"
                />

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