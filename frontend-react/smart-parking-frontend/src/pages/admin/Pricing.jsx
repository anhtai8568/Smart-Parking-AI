function Pricing() {
  return (
    <div>
      <h3 className="page-title">Quản lý giá vé</h3>

      <div className="grid-2">
        <div className="card">
          <h4 className="card-title">Giá vé tháng</h4>
          <input className="input" type="text" defaultValue="300000" />
          <input className="input" type="text" defaultValue="700000" />
          <button className="primary-btn" style={{ marginTop: '12px' }}>Cập nhật</button>
        </div>

        <div className="card">
          <h4 className="card-title">Giá vé lượt</h4>
          <input className="input" type="text" defaultValue="5000" />
          <input className="input" type="text" defaultValue="20000" />
          <button className="primary-btn" style={{ marginTop: '12px' }}>Cập nhật</button>
        </div>
      </div>
    </div>
  )
}

export default Pricing