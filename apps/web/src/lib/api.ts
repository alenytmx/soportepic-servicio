export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const bodyIsForm = options.body instanceof FormData;
  if (options.body && !bodyIsForm && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(path.startsWith('/api') ? path : `/api${path}`, {
    ...options,
    headers,
    credentials: 'include'
  });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) throw new ApiError(payload?.message || 'No fue posible completar la solicitud.', response.status, payload?.code, payload?.details);
  return payload as T;
}

export function jsonBody(data: unknown): Pick<RequestInit, 'body'> {
  return { body: JSON.stringify(data) };
}

export async function openPdf(path: string) {
  const response = await fetch(path, { credentials: 'include' });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new ApiError(payload.message || 'No fue posible generar el PDF.', response.status);
  }
  const url = URL.createObjectURL(await response.blob());
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadFile(path: string, filename: string) {
  const response = await fetch(path, { credentials: 'include' });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new ApiError(payload.message || 'No fue posible descargar el archivo.', response.status, payload.code, payload.details);
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function query(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  return search.toString();
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Ocurrio un error inesperado.';
}
