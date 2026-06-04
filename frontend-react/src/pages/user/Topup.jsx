function Topup() {
  return (
    <div>
      <h3 className="page-title">Nạp tiền</h3>

      <div className="card">
        <p>Số dư hiện tại: 500.000đ</p>
        <input className="input" type="number" placeholder="Nhập số tiền muốn nạp" />
        <select className="select">
          <option>Tiền mặt</option>
          <option>Chuyển khoản</option>
          <option>Ví điện tử</option>
        </select>
        <button className="primary-btn" style={{ marginTop: '12px' }}>Xác nhận nạp tiền</button>
      </div>
    </div>
  )
}

export default Topup