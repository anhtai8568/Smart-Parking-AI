import { Navigate } from 'react-router-dom'

function ProtectedRoute({ children, allowedRole }) {
  const rawUser = localStorage.getItem('currentUser')

  if (!rawUser) {
    return <Navigate to="/login" replace />
  }

  const currentUser = JSON.parse(rawUser)

  if (allowedRole && currentUser.role !== allowedRole) {
    return <Navigate to="/login" replace />
  }

  return children
}

export default ProtectedRoute