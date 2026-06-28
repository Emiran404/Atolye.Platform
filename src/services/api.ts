// API Base URL - Vite proxy kullanıldığı için sadece /api yeterli
const API_BASE = '/api';

// Token'ı storage'dan al
function getAuthToken() {
  try {
    const local = localStorage.getItem('auth-storage');
    const session = sessionStorage.getItem('auth-storage');
    
    // Check both for an active session with a token
    for (const stored of [session, local]) {
      if (stored && typeof stored === 'string' && stored.startsWith('{')) {
        try {
          const data = JSON.parse(stored);
          if (data.state?.isAuthenticated && data.state?.token) {
            return data.state.token;
          }
        } catch (e) {}
      }
    }
  } catch (error) {
    console.warn('Token reading error:', error);
  }
  return null;
}

// Generic fetch wrapper (JWT token otomatik eklenir)
const fetchApi = async (endpoint, options = {}) => {
  const url = `${API_BASE}${endpoint}`;
  const token = getAuthToken();

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  };

  // FormData için Content-Type header'ı silmeli
  if (options.body instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    // Herhangi bir 401 (Yetkisiz) hatasında oturumu temizle ve login'e at
    if (response.status === 401) {
      console.warn('⚠️ Yetkilendirme hatası (401). Oturum temizleniyor...', data.error || 'Oturum geçersiz');
      
      // Sadece state storage'dan yüklendikten (rehydrate) sonra kontrol et
      if (data.error && !data.error.includes('bulunamadı') && !data.error.includes('şifre')) {
        localStorage.removeItem('auth-storage');
        sessionStorage.removeItem('auth-storage');
        window.location.href = '/';
      }
      
      return { success: false, error: data.error || 'Yetkilendirme hatası (401)' };
    }

    if (!response.ok) {
      throw new Error(data.error || 'Bir hata oluştu');
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};


// Auth API
export const authApi = {
  registerStudent: (data) =>
    fetchApi('/auth/register/student', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  loginStudent: (studentNumber, password) =>
    fetchApi('/auth/login/student', {
      method: 'POST',
      body: JSON.stringify({ studentNumber, password }),
    }),

  resetStudentPassword: (studentNumber, newPassword) =>
    fetchApi('/auth/login/student-reset', {
      method: 'POST',
      body: JSON.stringify({ studentNumber, newPassword }),
    }),

  registerTeacher: (data) =>
    fetchApi('/auth/register/teacher', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  loginTeacher: (username, password, rememberMe = false) =>
    fetchApi('/auth/login/teacher', {
      method: 'POST',
      body: JSON.stringify({ username, password, rememberMe }),
    }),

  getStudents: () => fetchApi('/auth/students'),
  getClasses: () => fetchApi('/auth/classes'),

  passkeyRegisterChallenge: (username) =>
    fetchApi('/auth/passkey/register-challenge', {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),

  passkeyRegister: (username, credentialId, publicKey) =>
    fetchApi('/auth/passkey/register', {
      method: 'POST',
      body: JSON.stringify({ username, credentialId, publicKey }),
    }),

  passkeyLoginChallenge: (username) =>
    fetchApi('/auth/passkey/login-challenge', {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),

  passkeyLogin: (username, credentialId, authenticatorData, clientDataJSON, signature, rememberMe = false) =>
    fetchApi('/auth/passkey/login', {
      method: 'POST',
      body: JSON.stringify({ username, credentialId, authenticatorData, clientDataJSON, signature, rememberMe }),
    }),

  passkeyRemove: (username, passkeyId) =>
    fetchApi('/auth/passkey/remove', {
      method: 'POST',
      body: JSON.stringify({ username, passkeyId }),
    }),

  generateRecoveryKey: (username) =>
    fetchApi('/auth/recovery-key/generate', {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),

  resetPasswordWithKey: (username, recoveryKey, newPassword) =>
    fetchApi('/auth/recovery-key/reset', {
      method: 'POST',
      body: JSON.stringify({ username, recoveryKey, newPassword }),
    }),
};

// User API
export const userApi = {
  update: (id, userType, updates) =>
    fetchApi(`/users/${id}/update`, {
      method: 'PATCH',
      body: JSON.stringify({ userType, updates }),
    }),

  getStudents: () => fetchApi('/users/students'),
  getTeachers: () => fetchApi('/users/teachers'),

  delete: (id, userType) =>
    fetchApi(`/users/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ userType }),
    }),

  suspend: (id, userType, suspended) =>
    fetchApi(`/users/${id}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ userType, suspended }),
    }),
};

// LiderAhenk SSO API
export const liderAhenkApi = {
  getSettings: () => fetchApi('/liderahenk/settings'),
  saveSettings: (settings) => fetchApi('/liderahenk/settings', {
    method: 'POST',
    body: JSON.stringify(settings)
  }),
  testConnection: (settings) => fetchApi('/liderahenk/test', {
    method: 'POST',
    body: JSON.stringify(settings)
  }),
  getUsers: () => fetchApi('/liderahenk/users'),
  syncUsers: (users, targetRole) => fetchApi('/liderahenk/sync', {
    method: 'POST',
    body: JSON.stringify({ users, targetRole })
  }),
  getLocalUsers: () => fetchApi('/liderahenk/local-users'),
  exportUsers: (users) => fetchApi('/liderahenk/export', {
    method: 'POST',
    body: JSON.stringify({ users })
  })
};

// PolyOS Lab API
export const polyosApi = {
  getSettings: () => fetchApi('/polyos/settings'),
  saveSettings: (settings) => fetchApi('/polyos/settings', {
    method: 'POST',
    body: JSON.stringify(settings)
  }),
  testConnection: (serverUrl) => fetchApi('/polyos/test', {
    method: 'POST',
    body: JSON.stringify({ serverUrl })
  }),
  getClients: () => fetchApi('/polyos/clients')
};

// Exam API
export const examApi = {
  getAll: (teacherId) => {
    const endpoint = teacherId ? `/exams?createdBy=${teacherId}` : '/exams';
    return fetchApi(endpoint);
  },
  getActive: () => fetchApi('/exams/active'),
  getActiveByClass: (className) => fetchApi(`/exams/active/${encodeURIComponent(className)}`),
  getById: (id) => fetchApi(`/exams/${id}`),
  create: (data) =>
    fetchApi('/exams', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id, data) =>
    fetchApi(`/exams/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id) =>
    fetchApi(`/exams/${id}`, {
      method: 'DELETE',
    }),
  toggle: (id) =>
    fetchApi(`/exams/${id}/toggle`, {
      method: 'PATCH',
    }),
};

// Submission API
export const submissionApi = {
  getAll: () => fetchApi('/submissions'),
  getByStudent: (studentId) => fetchApi(`/submissions/student/${studentId}`),
  getByExam: (examId) => fetchApi(`/submissions/exam/${examId}`),
  get: (examId, studentId) => fetchApi(`/submissions/${examId}/${studentId}`),
  create: (data) =>
    fetchApi('/submissions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  submitQuiz: (data) =>
    fetchApi('/submissions/quiz', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  submitClassic: (data) =>
    fetchApi('/submissions/classic', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  lock: (id) =>
    fetchApi(`/submissions/${id}/lock`, {
      method: 'PATCH',
    }),
  markReady: (id) =>
    fetchApi(`/submissions/${id}/ready`, {
      method: 'PATCH',
    }),
  grade: (id, grade, feedback, gradedBy) =>
    fetchApi(`/submissions/${id}/grade`, {
      method: 'PATCH',
      body: JSON.stringify({ grade, feedback, gradedBy }),
    }),
  requestEdit: (id, reason) =>
    fetchApi(`/submissions/${id}/edit-request`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  respondEditRequest: (id, requestId, approved, response, respondedBy, editDuration) =>
    fetchApi(`/submissions/${id}/edit-request/${requestId}`, {
      method: 'PATCH',
      body: JSON.stringify({ approved, response, respondedBy, editDuration }),
    }),
  grantEditPermission: (submissionId, examId, studentId, note, teacherId) =>
    fetchApi(`/submissions/${submissionId}/grant-edit-permission`, {
      method: 'POST',
      body: JSON.stringify({ examId, studentId, note, teacherId }),
    }),
  checkDuplicate: (fileHash, examId, studentId) =>
    fetchApi('/submissions/check-duplicate', {
      method: 'POST',
      body: JSON.stringify({ fileHash, examId, studentId }),
    }),
  getExamDuplicates: (examId) =>
    fetchApi(`/submissions/exam/${examId}/duplicates`),
};

// Upload API
export const uploadApi = {
  upload: (fileOrFormData, folderPath, examId, studentId) => {
    let finalFormData;
    if (fileOrFormData instanceof FormData) {
      finalFormData = fileOrFormData;
    } else {
      finalFormData = new FormData();
      finalFormData.append('file', fileOrFormData);
      finalFormData.append('folderPath', folderPath);
      finalFormData.append('examId', examId);
      finalFormData.append('studentId', studentId);
    }

    return fetchApi('/uploads', {
      method: 'POST',
      body: finalFormData,
    });
  },
  getDownloadUrl: (filePath) => `${API_BASE}/uploads/download/${filePath}`,
  getViewUrl: (filePath) => `${API_BASE}/uploads/view/${filePath}`,
  listFolder: (folderPath) => fetchApi(`/uploads/list/${folderPath}`),
  delete: (filePath) =>
    fetchApi(`/uploads/${filePath}`, {
      method: 'DELETE',
    }),
};

// Schedule API
export const scheduleApi = {
  getAll: () => fetchApi('/schedules'),
  getByClass: (className) => fetchApi(`/schedules/class/${className}`),
  create: (data) =>
    fetchApi('/schedules', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  createBulk: (schedules) =>
    fetchApi('/schedules/bulk', {
      method: 'POST',
      body: JSON.stringify({ newSchedules: schedules }),
    }),
  update: (id, data) =>
    fetchApi(`/schedules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id) =>
    fetchApi(`/schedules/${id}`, {
      method: 'DELETE',
    }),
};

// Notification API
export const notificationApi = {
  getByUser: (userType, userId) => fetchApi(`/notifications/user/${userType}/${userId}`),
  create: (data) =>
    fetchApi('/notifications', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  createBulk: (data) =>
    fetchApi('/notifications/bulk', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  markAsRead: (id) =>
    fetchApi(`/notifications/${id}/read`, {
      method: 'PATCH',
    }),
  markAllAsRead: (userType, userId) =>
    fetchApi(`/notifications/read-all/${userType}/${userId}`, {
      method: 'PATCH',
    }),
  delete: (id) =>
    fetchApi(`/notifications/${id}`, {
      method: 'DELETE',
    }),
};

// Live Sessions API
export const liveSessionApi = {
  heartbeat: (data) =>
    fetchApi('/live-sessions/heartbeat', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  reportWarning: (data) =>
    fetchApi('/live-sessions/warning', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  getExamSessions: (examId) => fetchApi(`/live-sessions/exam/${examId}`),
  finishSession: (examId, studentId) =>
    fetchApi('/live-sessions/finish', {
      method: 'POST',
      body: JSON.stringify({ examId, studentId })
    }),
  cancelSession: (examId, studentId) => 
    fetchApi('/live-sessions/cancel', {
      method: 'POST',
      body: JSON.stringify({ examId, studentId })
    })
};

// System API (Version, Update, etc.)
export const systemApi = {
  sendSystemControl: (action) => fetchApi('/system/control', { method: 'POST', body: JSON.stringify({ action }) }),
  getVersion: () => fetchApi('/system/version'),
  getUpdates: () => fetchApi('/system/updates'),
  checkUpdate: (force = false) => 
    fetchApi('/system/check-update', {
      method: 'POST',
      body: JSON.stringify({ force })
    }),
  installUpdate: (version, description) =>
    fetchApi('/system/install-update', {
      method: 'POST',
      body: JSON.stringify({ version, description })
    })
};

// Stats API
export const statsApi = {
  get: () => fetchApi('/stats')
};

// Backup API
export const backupApi = {
  get: () => fetchApi('/backup'),
  restore: (data) =>
    fetchApi('/backup/restore', {
      method: 'POST',
      body: JSON.stringify({ data })
    }),
  restoreZip: (file) => {
    const formData = new FormData();
    formData.append('backup', file);
    return fetchApi('/backup/restore-zip', {
      method: 'POST',
      body: formData
    });
  }
};

// Settings API
export const settingsApi = {
  get: () => fetchApi('/settings'),
  update: (data) =>
    fetchApi('/settings', {
      method: 'POST',
      body: JSON.stringify(data)
    })
};

// Health check
export const healthCheck = () => fetchApi('/health');

// Class API
export const classApi = {
  getAll: () => fetchApi('/classes'),
  add: (name) => fetchApi('/classes', { method: 'POST', body: JSON.stringify({ name }) }),
  delete: (name) => fetchApi(`/classes/${name}`, { method: 'DELETE' }),
  update: (oldName, newName) => fetchApi(`/classes/${oldName}`, { method: 'PUT', body: JSON.stringify({ newName }) })
};

// Logs API
export const logsApi = {
  getAll: () => fetchApi('/logs'),
  reportClientEvent: (data) => fetchApi('/logs/client-event', { method: 'POST', body: JSON.stringify(data) })
};

export default {
  auth: authApi,
  exam: examApi,
  submission: submissionApi,
  upload: uploadApi,
  notification: notificationApi,
  schedule: scheduleApi,
  liveSession: liveSessionApi,
  settings: settingsApi,
  user: userApi,
  system: systemApi,
  stats: statsApi,
  backup: backupApi,
  liderAhenk: liderAhenkApi,
  class: classApi,
  logs: logsApi,
  healthCheck,
};
