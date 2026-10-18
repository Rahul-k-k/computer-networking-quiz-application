import axios from 'axios';

// All API calls go through Vite's proxy (/api -> backend). See vite.config.js.
const api = axios.create({ baseURL: '/api' });

/**
 * Set (or clear) the bearer token used for every request. Called by
 * AuthContext for both persisted logins and in-memory trial sessions.
 */
export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export default api;
