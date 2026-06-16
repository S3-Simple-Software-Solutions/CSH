export async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  const json = await response.json().catch(() => ({ ok: false, error: 'Respuesta invalida' }));
  if (!response.ok && json.ok !== false) json.error = 'Error de servidor';
  return json;
}

export async function uploadFile(path, file) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': file.type },
    body: file,
  });
  return response.json().catch(() => ({ ok: false, error: 'Respuesta invalida' }));
}
