import StatCard from '../../components/common/StatCard'

function Reports() {
  return (
    <div>
      <h3 className="page-title">Báo cáo doanh thu</h3>

      <div className="grid-4">
        <StatCard title="Doanh thu ngày" value="2.500.000đ" />
        <StatCard title="Doanh thu tuần" value="15.000.000đ" />
        <StatCard title="Doanh thu tháng" value="62.000.000đ" />
        <StatCard title="Tổng lượt gửi xe" value="1.240" />
      </div>

      <div className="card">
        <h4 className="card-title">Biểu đồ doanh thu</h4>
        <div className="chart-box">Mô phỏng biểu đồ doanh thu</div>
      </div>
    </div>
  )
}

export default Reports