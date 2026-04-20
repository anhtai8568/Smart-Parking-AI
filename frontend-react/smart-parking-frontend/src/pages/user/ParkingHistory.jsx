import DataTable from '../../components/common/DataTable'
import { parkingHistory } from '../../data/mockData'

function ParkingHistory() {
  const columns = [
    { key: 'date', title: 'Ngày' },
    { key: 'entry', title: 'Giờ vào' },
    { key: 'exit', title: 'Giờ ra' },
    { key: 'duration', title: 'Thời lượng' },
    { key: 'fee', title: 'Chi phí' },
    { key: 'status', title: 'Trạng thái' },
  ]

  return (
    <div>
      <h3 className="page-title">Lịch sử gửi xe</h3>
      <div className="card filter-bar">
        <select className="select">
          <option>Tháng 4/2026</option>
          <option>Tháng 3/2026</option>
        </select>
      </div>
      <DataTable columns={columns} data={parkingHistory} />
    </div>
  )
}

export default ParkingHistory