import DataTable from '../../components/common/DataTable'
import { payments } from '../../data/mockData'

function PaymentHistory() {
  const columns = [
    { key: 'date', title: 'Ngày' },
    { key: 'content', title: 'Nội dung' },
    { key: 'amount', title: 'Số tiền' },
    { key: 'method', title: 'Phương thức' },
    { key: 'status', title: 'Trạng thái' },
  ]

  return (
    <div>
      <h3 className="page-title">Lịch sử thanh toán</h3>
      <DataTable columns={columns} data={payments} />
    </div>
  )
}

export default PaymentHistory