import StatCard from '../../components/common/StatCard'
import DataTable from '../../components/common/DataTable'
import { adminStats, vehicles } from '../../data/mockData'

function DashboardAdmin() {
  const columns = [
    { key: 'time', title: 'Thời gian' },
    { key: 'licensePlate', title: 'Biển số' },
    { key: 'type', title: 'Loại xe' },
    { key: 'source', title: 'Nguồn nhận diện' },
    { key: 'status', title: 'Trạng thái' },
  ]

  return (
    <div>
      <div className="grid-4">
        {adminStats.map((item, index) => (
          <StatCard key={index} title={item.title} value={item.value} note={item.note} />
        ))}
      </div>

      <div className="lane-split">
        <div className="card lane-entry">
          <div className="card-header">
            <div>
              <h3 className="card-title">Làn vào</h3>
            </div>
          </div>
          <div className="lane-entry-body">
            <div className="frame frame-vehicle in">
              <div className="frame-label">Xe vào</div>
              <img
                className="frame-media"
                src="http://localhost:8000/api/video-stream"
                alt="Xe vao"
              />
            </div>
            <div className="lane-entry-row">
              <div className="plate-block in">
                <div className="plate-wrap in">
                  <div className="plate-label">Biển số vào</div>
                  <img
                    className="plate-media"
                    src="http://localhost:8000/api/video-stream"
                    alt="Bien so vao"
                  />
                </div>
                <div className="plate-time">Giờ vào: 09:15 29/04/2026</div>
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
                  <strong>120.000 VND</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card compare-card lane-exit">
          <div className="card-header">
            <div>
              <h3 className="card-title">Làn ra - Đối chiếu</h3>
            </div>
            <span className="match-badge success">Khớp biển số</span>
          </div>

          <div className="lane-exit-body">
            <div className="lane-exit-frames">
              <div className="frame frame-vehicle in">
                <div className="frame-label">Xe vào</div>
                <img
                  className="frame-media"
                  src="http://localhost:8000/api/video-stream"
                  alt="Xe vao doi chieu"
                />
              </div>
              <div className="frame frame-vehicle out">
                <div className="frame-label">Xe ra</div>
                <img
                  className="frame-media"
                  src="http://localhost:8000/api/video-stream"
                  alt="Xe ra doi chieu"
                />
              </div>
            </div>

            <div className="lane-exit-details">
              <div className="lane-exit-plates">
                <div className="plate-block in">
                  <div className="plate-wrap in">
                    <div className="plate-label">Biển số vào</div>
                    <img
                      className="plate-media"
                      src="http://localhost:8000/api/video-stream"
                      alt="Bien so vao doi chieu"
                    />
                  </div>
                  <div className="plate-time">Giờ vào: 09:15 29/04/2026</div>
                </div>
                <div className="total-time">
                  Tổng thời gian: 47 phút
                </div>
                <div className="plate-block out">
                  <div className="plate-wrap out">
                    <div className="plate-label">Biển số ra</div>
                    <img
                      className="plate-media"
                      src="http://localhost:8000/api/video-stream"
                      alt="Bien so ra doi chieu"
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
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Trạng thái barrier</h3>
              <p className="card-subtitle">Điều khiển cổng ra vào bãi xe</p>
            </div>
          </div>

          <div className="barrier-box">
            <div className="barrier-status-row">
              <span className="badge success">Barrier 1: Đang mở</span>
              <span className="badge warning">Barrier 2: Đang đóng</span>
            </div>

            <button className="primary-btn">Xác nhận mở cổng</button>
            <button className="secondary-btn">Làm mới trạng thái</button>
          </div>
        </div>

        <div className="card quick-alerts">
          <div className="card-header">
            <div>
              <h3 className="card-title">Cảnh báo nhanh</h3>
              <p className="card-subtitle">Lỗi OCR, biển số mờ, barrier thủ công</p>
            </div>
          </div>
          <div className="alert-list">
            <div className="alert-item danger">2 xe ra khong nhan dien duoc</div>
            <div className="alert-item warning">1 xe vao thieu anh bien so</div>
            <div className="alert-item neutral">Chua co yeu cau mo cong thu cong</div>
          </div>
        </div>
      </div>

      <h3 className="page-title">Xe vào/ra gần đây</h3>
      <DataTable columns={columns} data={vehicles} />
    </div>
  )
}

export default DashboardAdmin