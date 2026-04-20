function Settings() {
  return (
    <div>
      <h3 className="page-title">Cài đặt hệ thống</h3>

      <div className="grid-2">
        <div className="card">
          <h4 className="card-title">Cấu hình camera</h4>
          <input className="input" type="text" placeholder="Camera URL" />
          <button className="primary-btn" style={{ marginTop: '12px' }}>Lưu</button>
        </div>

        <div className="card">
          <h4 className="card-title">Cấu hình barrier</h4>
          <input className="input" type="text" placeholder="Barrier IP" />
          <button className="primary-btn" style={{ marginTop: '12px' }}>Lưu</button>
        </div>

        <div className="card">
          <h4 className="card-title">Cấu hình MongoDB</h4>
          <input className="input" type="text" placeholder="MongoDB URI" />
          <button className="primary-btn" style={{ marginTop: '12px' }}>Lưu</button>
        </div>

        <div className="card">
          <h4 className="card-title">Cấu hình API</h4>
          <input className="input" type="text" placeholder="API Base URL" />
          <button className="primary-btn" style={{ marginTop: '12px' }}>Lưu</button>
        </div>
      </div>
    </div>
  )
}

export default Settings