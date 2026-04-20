export const demoAccounts = [
  {
    username: 'admin',
    password: '123456',
    role: 'admin',
    fullName: 'Quản Trị',
  },
  {
    username: 'user1',
    password: '123456',
    role: 'user',
    fullName: 'Nguyễn Văn A',
  },
  {
    username: 'user2',
    password: '123456',
    role: 'user',
    fullName: 'Trần Thị B',
  },
]

export function loginWithMockAccount(username, password) {
  const account = demoAccounts.find(
    (item) => item.username === username && item.password === password
  )

  if (!account) return null

  return {
    token: 'demo-token-123',
    user: {
      username: account.username,
      fullName: account.fullName,
      role: account.role,
    },
  }
}