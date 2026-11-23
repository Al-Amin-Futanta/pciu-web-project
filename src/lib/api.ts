import type {
  BootstrapPayload,
  IntegrityReport,
  PrivateMessage,
  ReviewStatus,
  UserProfile,
  UserRole,
} from '../shared/types';

// Keep signed session Bearer token strictly in memory (never localStorage/sessionStorage)
let inMemoryToken: string | null = null;

export function getAuthToken(): string | null {
  return inMemoryToken;
}

export function setAuthToken(token: string | null): void {
  inMemoryToken = token;
}

async function requestJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  if (inMemoryToken) {
    headers.set('Authorization', `Bearer ${inMemoryToken}`);
  }
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, { ...options, headers });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export async function fetchDemoUsers(): Promise<UserProfile[]> {
  const res = await requestJson<{ users: UserProfile[] }>('/api/demo-users');
  return res.users;
}

export async function loginWithCredentials(payload: {
  email: string;
  passcode: string;
  role: UserRole;
}): Promise<{ token: string; user: UserProfile }> {
  const res = await requestJson<{ token: string; user: UserProfile }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  setAuthToken(res.token);
  return res;
}

export function logoutSession(): void {
  setAuthToken(null);
}

export async function fetchBootstrap(): Promise<BootstrapPayload> {
  return requestJson<BootstrapPayload>('/api/bootstrap');
}

export async function createAssignment(payload: {
  courseId: string;
  title: string;
  description: string;
  instructions: string;
  dueAt: string;
  allowResubmission: boolean;
}): Promise<{ id: string }> {
  return requestJson<{ id: string }>('/api/assignments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAssignment(
  id: string,
  payload: {
    title?: string;
    instructions?: string;
    dueAt?: string;
    status?: 'active' | 'modified' | 'canceled';
    modificationNote?: string;
  }
): Promise<{ ok: boolean }> {
  return requestJson<{ ok: boolean }>(`/api/assignments/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function submitAssignmentFile(params: {
  assignmentId: string;
  file: File;
  studentNote?: string;
}): Promise<{ id: string; version: number; wordCount: number; fileName: string }> {
  const form = new FormData();
  form.append('assignmentId', params.assignmentId);
  form.append('file', params.file);
  if (params.studentNote?.trim()) {
    form.append('studentNote', params.studentNote.trim());
  }
  return requestJson<{ id: string; version: number; wordCount: number; fileName: string }>(
    '/api/submissions',
    {
      method: 'POST',
      body: form,
    }
  );
}

export async function fetchSubmissionFileBlob(
  submissionId: string,
  download = false
): Promise<{ blob: Blob; objectUrl: string }> {
  const headers = new Headers();
  if (inMemoryToken) {
    headers.set('Authorization', `Bearer ${inMemoryToken}`);
  }
  const url = `/api/submissions/${encodeURIComponent(submissionId)}/file${download ? '?download=1' : ''}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errBody.error || `Unable to open file (${res.status}).`);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  return { blob, objectUrl };
}

export async function runIntegrityScan(
  submissionId: string
): Promise<{ report: IntegrityReport }> {
  return requestJson<{ report: IntegrityReport }>(
    `/api/submissions/${encodeURIComponent(submissionId)}/analyze`,
    { method: 'POST' }
  );
}

export async function saveSubmissionReview(
  submissionId: string,
  payload: {
    reviewStatus: ReviewStatus;
    feedback: string;
  }
): Promise<{ ok: boolean; reviewId: string; reviewStatus: ReviewStatus }> {
  return requestJson(`/api/submissions/${encodeURIComponent(submissionId)}/review`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function acknowledgeFeedback(
  submissionId: string,
  note: string
): Promise<{ ok: boolean }> {
  return requestJson(`/api/submissions/${encodeURIComponent(submissionId)}/acknowledge`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
}

export async function requestExtension(payload: {
  assignmentId: string;
  requestedDueAt: string;
  reason: string;
}): Promise<{ id: string }> {
  return requestJson('/api/extensions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function decideExtension(
  id: string,
  payload: { status: 'approved' | 'denied'; lecturerNote: string }
): Promise<{ ok: boolean }> {
  return requestJson(`/api/extensions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function sendPrivateMessage(payload: {
  recipientId: string;
  courseId: string;
  assignmentId?: string | null;
  body: string;
}): Promise<{ message: PrivateMessage }> {
  return requestJson('/api/messages', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function markNotificationsRead(notificationId?: string): Promise<void> {
  await requestJson('/api/notifications/read', {
    method: 'PATCH',
    body: JSON.stringify(notificationId ? { notificationId } : {}),
  });
}

export async function markPeerMessagesRead(peerId: string): Promise<void> {
  await requestJson('/api/messages/read', {
    method: 'PATCH',
    body: JSON.stringify({ peerId }),
  });
}

export function buildWebSocketUrl(token: string): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;
}
