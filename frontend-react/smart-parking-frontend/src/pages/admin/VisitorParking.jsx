import DataTable from '../../components/common/DataTable'
import { visitors } from '../../data/mockData'

function VisitorParking() {
  const columns = [
    { key: 'licensePlate', title: 'Biển số' },
    { key: 'type', title: 'Loại xe' },
    { key: 'entryTime', title: 'Giờ vào' },
    { key: 'exitTime', title: 'Giờ ra' },
    { key: 'fee', title: 'Số tiền' },
    { key: 'paymentStatus', title: 'Thanh toán' },
  ]

  return (
    <div>
      <h3 className="page-title">Quản lý khách vãng lai</h3>

      <div className="grid-2">
        <div className="card">
          <h4 className="card-title">Ghi nhận xe vãng lai</h4>
          <input className="input" type="text" placeholder="Biển số" />
          <select className="select">
            <option>Ô tô</option>
            <option>Xe máy</option>
          </select>
          <button className="primary-btn" style={{ marginTop: '12px' }}>Lưu thông tin</button>
        </div>

        <div className="card">
          <h4 className="card-title">Tính phí khi xe ra</h4>
          <input className="input" type="text" placeholder="Biển số" />
          <input className="input" type="text" placeholder="Số tiền" />
          <button className="primary-btn" style={{ marginTop: '12px' }}>Xác nhận thanh toán</button>
        </div>
      </div>

      <DataTable columns={columns} data={visitors} />
    </div>
  )
}

export default VisitorParking