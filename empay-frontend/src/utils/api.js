const API_BASE = '/api';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('empay_token') || ''}`,
});

const request = async (method, endpoint, data = null) => {
  const opts = { method, headers: getHeaders() };
  if (data) opts.body = JSON.stringify(data);
  const res = await fetch(`${API_BASE}${endpoint}`, opts);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Request failed');
  // Auto-unwrap {success, data} envelope — return .data if exists, else raw json
  return json && json.data !== undefined ? json.data : json;
};

export const api = {
  get: (ep) => request('GET', ep),
  post: (ep, d) => request('POST', ep, d),
  put: (ep, d) => request('PUT', ep, d),
  delete: (ep) => request('DELETE', ep),
};

export default api;
