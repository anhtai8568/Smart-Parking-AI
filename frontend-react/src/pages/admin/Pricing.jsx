import { useEffect, useState } from 'react'
import api from '../../services/api'

function Pricing() {
  const [formData, setFormData] = useState({
    monthlyPriceMotorbike: '',
    monthlyPriceCar: '',
    singlePriceMotorbike: '',
    singlePriceCar: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const fetchPricing = async () => {
    try {
      setIsLoading(true)
      setError('')
      setSuccess('')
      const response = await api.get('/api/pricing/active')
      const data = response.data?.data
      if (data) {
        setFormData({
          monthlyPriceMotorbike: data.monthlyPriceMotorbike ?? '',
          monthlyPriceCar: data.monthlyPriceCar ?? '',
          singlePriceMotorbike: data.singlePriceMotorbike ?? '',
          singlePriceCar: data.singlePriceCar ?? '',
        })
      }
    } catch (requestError) {
      const message =
        requestError?.response?.data?.message ||
        'Không tải được bảng giá'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPricing()
  }, [])

  const handleSubmit = async () => {
    setError('')
    setSuccess('')

    setIsLoading(true)
    try {
      await api.post('/api/pricing', {
        monthlyPriceMotorbike: Number(formData.monthlyPriceMotorbike),
        monthlyPriceCar: Number(formData.monthlyPriceCar),
        singlePriceMotorbike: Number(formData.singlePriceMotorbike),
        singlePriceCar: Number(formData.singlePriceCar),
      })

      setSuccess('Đã cập nhật bảng giá thành công')
      await fetchPricing()
    } catch (requestError) {
      const message =
        requestError?.response?.data?.message ||
        'Không thể cập nhật bảng giá'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <h3 className="page-title">Quản lý giá vé</h3>

      <div className="grid-2">
        <div className="card">
          <h4 className="card-title">Giá vé tháng</h4>
          <input
            className="input"
            type="number"
            value={formData.monthlyPriceMotorbike}
            onChange={(event) => setFormData({ ...formData, monthlyPriceMotorbike: event.target.value })}
            placeholder="Giá vé tháng xe máy"
          />
          <input
            className="input"
            type="number"
            value={formData.monthlyPriceCar}
            onChange={(event) => setFormData({ ...formData, monthlyPriceCar: event.target.value })}
            placeholder="Giá vé tháng ô tô"
          />
        </div>

        <div className="card">
          <h4 className="card-title">Giá vé lượt</h4>
          <input
            className="input"
            type="number"
            value={formData.singlePriceMotorbike}
            onChange={(event) => setFormData({ ...formData, singlePriceMotorbike: event.target.value })}
            placeholder="Giá vé lượt xe máy"
          />
          <input
            className="input"
            type="number"
            value={formData.singlePriceCar}
            onChange={(event) => setFormData({ ...formData, singlePriceCar: event.target.value })}
            placeholder="Giá vé lượt ô tô"
          />
        </div>
      </div>

      {error && <div className="error-box" style={{ marginBottom: '16px' }}>{error}</div>}
      {success && <div className="card" style={{ background: '#ecfdf3', color: '#166534', fontWeight: 600 }}>{success}</div>}

      <button className="primary-btn" onClick={handleSubmit} disabled={isLoading}>
        {isLoading ? 'Đang lưu...' : 'Cập nhật bảng giá'}
      </button>
    </div>
  )
}

export default Pricing