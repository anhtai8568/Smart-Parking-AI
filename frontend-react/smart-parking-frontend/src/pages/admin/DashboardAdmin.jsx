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

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Camera vào/ra</h3>
              <p className="card-subtitle">Dữ liệu nhận diện biển số theo thời gian thực</p>
            </div>
          </div>
          <div className="camera-box">
            <img
              className="camera-stream"
              src="http://localhost:8000/api/video-stream"
              alt="Luồng camera AI"
            />
          </div>
        </div>

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
      </div>

      <h3 className="page-title">Xe vào/ra gần đây</h3>
      <DataTable columns={columns} data={vehicles} />
    </div>
  )
}

export default DashboardAdmin