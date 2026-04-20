import StatCard from '../../components/common/StatCard'

function DashboardUser() {
  return (
    <div>
      <div className="card">
        <h3 className="card-title">Thông tin phương tiện</h3>
        <p>Biển số: 15A-123.45</p>
        <p>Loại xe: Ô tô</p>
        <p>Mã thành viên: TV001</p>
      </div>

      <div className="grid-3">
        <StatCard title="Số dư" value="500.000đ" />
        <StatCard title="Gói tháng" value="Đang hoạt động" note="Hết hạn 30/04/2026" />
        <StatCard title="Trạng thái xe" value="Đang ở ngoài bãi" />
      </div>
    </div>
  )
}

export default DashboardUser