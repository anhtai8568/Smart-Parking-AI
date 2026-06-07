function DashboardGuard() {
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardGuard