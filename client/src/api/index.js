import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : '/api'
})

export async function getShipments() {
  const response = await api.get('/shipments')
  return response.data
}

export async function getShipment(id) {
  const response = await api.get(`/shipments/${id}`)
  return response.data
}

export async function createShipment(data) {
  const response = await api.post('/shipments', data)
  return response.data
}

export async function updateShipment(id, data) {
  const response = await api.put(`/shipments/${id}`, data)
  return response.data
}

export async function deleteShipment(id) {
  const response = await api.delete(`/shipments/${id}`)
  return response.data
}

export async function checkShipment(id) {
  const response = await api.post(`/track/check/${id}`)
  return response.data
}

export async function getSettings() {
  const response = await api.get('/settings')
  return response.data
}

export async function updateSettings(data) {
  const response = await api.put('/settings', data)
  return response.data
}

export async function testEmail() {
  const response = await api.post('/settings/test-email')
  return response.data
}

export async function testDiscord() {
  const response = await api.post('/settings/test-discord')
  return response.data
}

export async function getSchedulerStatus() {
  const response = await api.get('/settings/scheduler')
  return response.data
}

export default api
