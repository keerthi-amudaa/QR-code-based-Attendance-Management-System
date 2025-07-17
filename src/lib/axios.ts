import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to automatically add token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    // Add token to query params since your backend expects it there
    const separator = config.url?.includes('?') ? '&' : '?';
    config.url = `${config.url}${separator}token=${token}`;
  }
  return config;
});

// Add response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;