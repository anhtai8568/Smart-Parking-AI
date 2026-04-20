export const adminStats = [
  { title: 'Người dùng tháng', value: '120', note: 'Đang hoạt động' },
  { title: 'Xe đang trong bãi', value: '35', note: 'Cập nhật thời gian thực' },
  { title: 'Chỗ trống', value: '15', note: 'Có thể nhận thêm xe' },
  { title: 'Doanh thu hôm nay', value: '2.500.000đ', note: 'Tính đến hiện tại' },
]

export const users = [
  {
    fullName: 'Nguyễn Văn A',
    phone: '0912345678',
    licensePlate: '15A-123.45',
    packageType: 'Tháng',
    balance: '500.000đ',
    status: 'Hoạt động',
  },
  {
    fullName: 'Trần Thị B',
    phone: '0987654321',
    licensePlate: '16B-678.90',
    packageType: 'Tháng',
    balance: '300.000đ',
    status: 'Hoạt động',
  },
  {
    fullName: 'Phạm Văn C',
    phone: '0909999999',
    licensePlate: '17C-888.88',
    packageType: 'Tháng',
    balance: '150.000đ',
    status: 'Tạm khóa',
  },
]

export const vehicles = [
  {
    time: '08:20',
    licensePlate: '15A-123.45',
    type: 'Ô tô',
    source: 'AI',
    status: 'Vào',
  },
  {
    time: '08:35',
    licensePlate: '16B-678.90',
    type: 'Xe máy',
    source: 'RFID',
    status: 'Ra',
  },
  {
    time: '09:00',
    licensePlate: '30F-999.88',
    type: 'Ô tô',
    source: 'QR',
    status: 'Vào',
  },
]

export const visitors = [
  {
    licensePlate: '29A-111.22',
    type: 'Ô tô',
    entryTime: '07:30',
    exitTime: '09:15',
    fee: '30.000đ',
    paymentStatus: 'Đã thanh toán',
  },
  {
    licensePlate: '18M-222.33',
    type: 'Xe máy',
    entryTime: '08:00',
    exitTime: '08:45',
    fee: '5.000đ',
    paymentStatus: 'Đã thanh toán',
  },
]

export const parkingHistory = [
  {
    date: '18/04/2026',
    entry: '08:00',
    exit: '17:00',
    duration: '9 giờ',
    fee: '0đ',
    status: 'Hoàn tất',
  },
  {
    date: '19/04/2026',
    entry: '07:45',
    exit: '18:10',
    duration: '10 giờ 25 phút',
    fee: '0đ',
    status: 'Hoàn tất',
  },
]

export const payments = [
  {
    date: '01/04/2026',
    content: 'Nạp tiền tài khoản',
    amount: '200.000đ',
    method: 'Tiền mặt',
    status: 'Thành công',
  },
  {
    date: '05/04/2026',
    content: 'Gia hạn gói tháng',
    amount: '300.000đ',
    method: 'Chuyển khoản',
    status: 'Thành công',
  },
]