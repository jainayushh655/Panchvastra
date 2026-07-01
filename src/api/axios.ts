import axios from 'axios'

const api = axios.create({
  baseURL: 'https://web-production-7de49.up.railway.app/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

export default api