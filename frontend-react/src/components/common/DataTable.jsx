function formatCell(key, value) {
  if (key === 'status' || key === 'paymentStatus') {
    if (
      value === 'Vào' ||
      value === 'Hoạt động' ||
      value === 'Đã thanh toán' ||
      value === 'Thành công'
    ) {
      return <span className="status-in">{value}</span>
    }

    if (value === 'Ra' || value === 'Tạm khóa') {
      return <span className="status-out">{value}</span>
    }
  }

  return value
}

function DataTable({ columns, data }) {
  return (
    <div className="card">
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key}>{col.title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr key={index}>
                {columns.map((col) => (
                  <td key={col.key}>{formatCell(col.key, row[col.key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default DataTable