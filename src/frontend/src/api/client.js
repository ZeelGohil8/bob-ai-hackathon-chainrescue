/**
 * Axios base client.
 * BASE_URL is empty so Vite's dev proxy forwards /api/* to localhost:3000.
 * In production builds, set VITE_API_BASE_URL to the deployed backend origin.
 */
import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  headers: {
    'Content-Type': 'application/json',
    // Set VITE_API_KEY to enable auth header in dev if needed
    ...(import.meta.env.VITE_API_KEY
      ? { 'x-api-key': import.meta.env.VITE_API_KEY }
      : {}),
  },
  timeout: 15000,
});

// Normalise errors into a plain message string
client.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err.response?.data?.error || err.message || 'Unknown error';
    return Promise.reject(new Error(message));
  }
);

export default client;
