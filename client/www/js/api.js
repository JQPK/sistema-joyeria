export const API_URL = 'https://joyeria-marine-server.onrender.com/api';

function getHeaders() {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function handleResponse(res) {
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.hash = '';
    window.location.reload();
    throw new Error('Sesión expirada');
  }

  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new Error('Error de servidor (no JSON)');
  }

  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Error en la operación');
  }

  return data;
}

export const api = {
  async get(endpoint, params = {}) {
    const url = new URL(API_URL + endpoint, window.location.origin);
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        url.searchParams.append(key, params[key]);
      }
    });
    
    const res = await fetch(url, { method: 'GET', headers: getHeaders() });
    return handleResponse(res);
  },

  async post(endpoint, body = {}) {
    const isFormData = body instanceof FormData;
    const headers = getHeaders();
    if (isFormData) delete headers['Content-Type'];

    const res = await fetch(API_URL + endpoint, {
      method: 'POST',
      headers: headers,
      body: isFormData ? body : JSON.stringify(body)
    });
    return handleResponse(res);
  },

  async put(endpoint, body = {}) {
    const isFormData = body instanceof FormData;
    const headers = getHeaders();
    if (isFormData) delete headers['Content-Type'];

    const res = await fetch(API_URL + endpoint, {
      method: 'PUT',
      headers: headers,
      body: isFormData ? body : JSON.stringify(body)
    });
    return handleResponse(res);
  },

  async del(endpoint) {
    const res = await fetch(API_URL + endpoint, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async upload(endpoint, formData) {
    const token = localStorage.getItem('token');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const res = await fetch(API_URL + endpoint, {
      method: 'POST',
      headers,
      body: formData // No Content-Type header so browser sets multipart/form-data boundary
    });
    return handleResponse(res);
  }
};
