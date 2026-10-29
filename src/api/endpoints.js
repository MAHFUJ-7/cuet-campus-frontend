// All backend endpoints — 1:1 port of lib/core/network/api_service.dart.
import { apiClient, rawRequest, upload } from './client.js';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const register = (data) => apiClient.post('/auth/register', data);
export const login = (data) => apiClient.post('/auth/login', data);
/** Dev-only: email in, session out with the account's real role. */
export const devLogin = (email, options) =>
  apiClient.post('/auth/dev-login', { email }, options);
export const setPassword = (data) => apiClient.post('/auth/set-password', data);
export const forgotPassword = (email) =>
  apiClient.post('/auth/forgot-password', { email });
export const resetPassword = ({ token, password }) =>
  apiClient.post('/auth/reset-password', { token, password });
export const getProfile = () => apiClient.get('/auth/me');
export const updateMyProfile = (data) => apiClient.put('/users/me', data);
export const completeProfile = (data) => apiClient.post('/users/complete-profile', data);

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export const getUsers = ({ page = 1, limit = 20 } = {}) =>
  apiClient.get('/users', { query: { page, limit } });
export const updateUser = (id, data) => apiClient.put(`/users/${id}`, data);
export const deleteUser = (id) => apiClient.delete(`/users/${id}`);

// ---------------------------------------------------------------------------
// Academic
// ---------------------------------------------------------------------------
export const getDepartments = () => apiClient.get('/academics/departments');
export const getDepartment = (id) => apiClient.get(`/academics/departments/${id}`);
export const getBatches = ({ departmentId } = {}) =>
  apiClient.get('/academics/batches', { query: { departmentId } });
export const getSections = ({ batchId } = {}) =>
  apiClient.get('/academics/sections', { query: { batchId } });
export const getCourses = ({ departmentId } = {}) =>
  apiClient.get('/academics/courses', { query: { departmentId } });
export const getTeachers = ({ departmentId } = {}) =>
  apiClient.get('/academics/teachers', { query: { departmentId } });

// ---------------------------------------------------------------------------
// Routine
// ---------------------------------------------------------------------------
export const getDailyRoutine = ({ day, batchId, sectionId } = {}) =>
  apiClient.get('/routine/daily', { query: { day, batchId, sectionId } });
export const getWeeklyRoutine = ({ batchId, sectionId } = {}) =>
  apiClient.get('/routine/weekly', { query: { batchId, sectionId } });
export const getAiContext = () => apiClient.get('/ai/context');
export const createRoutine = (data) => apiClient.post('/routine', data);
export const updateRoutine = (id, data) => apiClient.put(`/routine/${id}`, data);
export const deleteRoutine = (id) => apiClient.delete(`/routine/${id}`);

// ---------------------------------------------------------------------------
// Updates
// ---------------------------------------------------------------------------
export const getUpdates = ({ page = 1, limit = 20, type, courseId, status } = {}) =>
  apiClient.get('/updates', { query: { page, limit, type, courseId, status } });
export const getUpdate = (id) => apiClient.get(`/updates/${id}`);
export const createUpdate = (data) => apiClient.post('/updates', data);
export const updateUpdate = (id, data) => apiClient.put(`/updates/${id}`, data);
export const deleteUpdate = (id) => apiClient.delete(`/updates/${id}`);
export const upvoteUpdate = (id) => apiClient.post(`/updates/${id}/upvote`);
export const reviewUpdate = (id, decision, note) =>
  apiClient.post(`/updates/${id}/review`, { decision, ...(note ? { note } : {}) });
export const markUpdateRead = (id) => apiClient.put(`/updates/${id}/read`);

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------
export const getAssignments = ({ page = 1, limit = 20, status, courseId } = {}) =>
  apiClient.get('/assignments', { query: { page, limit, status, courseId } });
export const getAssignment = (id) => apiClient.get(`/assignments/${id}`);
export const createAssignment = (data) => apiClient.post('/assignments', data);
export const updateAssignment = (id, data) => apiClient.put(`/assignments/${id}`, data);
export const deleteAssignment = (id) => apiClient.delete(`/assignments/${id}`);

// ---------------------------------------------------------------------------
// Exams
// ---------------------------------------------------------------------------
export const getExams = ({ page = 1, limit = 20, type, courseId } = {}) =>
  apiClient.get('/exams', { query: { page, limit, type, courseId } });
export const getExam = (id) => apiClient.get(`/exams/${id}`);
export const createExam = (data) => apiClient.post('/exams', data);
export const updateExam = (id, data) => apiClient.put(`/exams/${id}`, data);
export const deleteExam = (id) => apiClient.delete(`/exams/${id}`);

// ---------------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------------
export const askAi = (message, { history } = {}) =>
  apiClient.post('/ai/chat', {
    message,
    ...(history ? { history } : {}),
  });
export const getAiSuggestions = () => apiClient.get('/ai/suggestions');
export const getStudyPlan = () => apiClient.post('/ai/study-plan');
export const getWorkloadAnalysis = () => apiClient.post('/ai/workload');

// ---------------------------------------------------------------------------
// Coordinator
// ---------------------------------------------------------------------------
export const getCoordinatorSections = () => apiClient.get('/coordinator/sections');
export const getCoordinatorStudents = ({ sectionId, batchId } = {}) =>
  apiClient.get('/coordinator/students', { query: { sectionId, batchId } });
export const getCoordinatorCRs = ({ sectionId } = {}) =>
  apiClient.get('/coordinator/crs', { query: { sectionId } });
export const assignCR = (studentId, sectionId, permissions) =>
  apiClient.put('/coordinator/assign-cr', {
    studentId,
    sectionId,
    ...(permissions ? { permissions } : {}),
  });
export const removeCR = (studentId, sectionId) =>
  apiClient.put('/coordinator/remove-cr', { studentId, sectionId });
export const getCoordinatorStats = () => apiClient.get('/coordinator/stats');
export const getCoordinatorAuditLogs = ({
  action,
  sectionId,
  limit = 50,
  skip = 0,
} = {}) =>
  apiClient.get('/coordinator/audit-logs', {
    query: { action, sectionId, limit, skip },
  });
export const getCoordinatorQuality = () => apiClient.get('/coordinator/quality');
export const publishCoordinatorNotice = ({
  audience,
  title,
  body,
  priority = 'normal',
  sectionId,
}) =>
  apiClient.post('/coordinator/notices', {
    audience,
    title,
    body,
    priority,
    ...(sectionId ? { sectionId } : {}),
  });

// Coordinator: student-ID-range assignment rules
export const getAssignmentRules = ({ termId } = {}) =>
  apiClient.get('/coordinator/assignment-rules', { query: { termId } });
export const createAssignmentRule = ({ termId, sectionId, startId, endId }) =>
  apiClient.post('/coordinator/assignment-rules', { termId, sectionId, startId, endId });
export const updateAssignmentRule = (id, { startId, endId } = {}) =>
  apiClient.put(`/coordinator/assignment-rules/${id}`, {
    ...(startId != null ? { startId } : {}),
    ...(endId != null ? { endId } : {}),
  });
export const deleteAssignmentRule = (id) =>
  apiClient.delete(`/coordinator/assignment-rules/${id}`);
export const applyAssignmentRule = (id) =>
  apiClient.post(`/coordinator/assignment-rules/${id}/apply`);
export const moveStudent = ({ studentId, targetSectionId }) =>
  apiClient.put('/coordinator/students/move', { studentId, targetSectionId });

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
export const getAdminStats = () => apiClient.get('/admin/stats');
export const getAuditLogs = ({ page = 1, limit = 20 } = {}) =>
  apiClient.get('/admin/audit-logs', { query: { page, limit } });

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export const saveFcmToken = (token) =>
  apiClient.post('/users/fcm-token', { fcmToken: token });
export const getNotifications = ({ page = 1, limit = 20 } = {}) =>
  apiClient.get('/notifications', { query: { page, limit } });
export const markNotificationRead = (id) => apiClient.put(`/notifications/${id}/read`);

// ---------------------------------------------------------------------------
// Study materials
// ---------------------------------------------------------------------------
export const getStudyMaterials = ({ courseId, type } = {}) =>
  apiClient.get('/study-materials', { query: { courseId, type } });
export const uploadStudyMaterial = (data) => apiClient.post('/study-materials', data);

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------
export const submitFeedback = (data) => apiClient.post('/feedback', data);

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
export const healthCheck = () => apiClient.get('/health');

// ---------------------------------------------------------------------------
// Shared files
// ---------------------------------------------------------------------------
export const getSharedFiles = ({ courseId, type, assignmentId } = {}) =>
  apiClient.get('/shared-files', { query: { courseId, type, assignmentId } });
export const uploadFile = (data) => apiClient.post('/shared-files', data);
export const deleteFile = (id) => apiClient.delete(`/shared-files/${id}`);

// ---------------------------------------------------------------------------
// Chat rooms (unused by current UI but kept for parity)
// ---------------------------------------------------------------------------
export const getChatRooms = () => apiClient.get('/chat/rooms');
export const getChatMessages = (roomId, { page = 1, limit = 50 } = {}) =>
  apiClient.get(`/chat/rooms/${roomId}/messages`, { query: { page, limit } });
export const sendChatMessage = (roomId, data) =>
  apiClient.post(`/chat/rooms/${roomId}/messages`, data);
export const createChatRoom = (data) => apiClient.post('/chat/rooms', data);

// ---------------------------------------------------------------------------
// Routine PDF
// ---------------------------------------------------------------------------
export const getLatestRoutinePdf = ({ sectionId } = {}) =>
  apiClient.get('/routine-pdf/latest', { query: { sectionId } });
export const deleteRoutinePdf = (id) => apiClient.delete(`/routine-pdf/${id}`);
export const extractRoutinePdf = (id) => apiClient.post(`/routine-pdf/${id}/extract`);
export const getRoutineExtraction = (id) =>
  apiClient.get(`/routine-pdf/${id}/extraction`);
export const publishRoutinePdf = (id, { sections, replace = true }) =>
  apiClient.post(`/routine-pdf/${id}/publish`, { sections, replace });

/** Upload a routine PDF (multipart). */
export function uploadRoutinePdf(file, { sectionId, title } = {}) {
  const formData = new FormData();
  formData.append('file', file);
  if (sectionId) formData.append('sectionId', sectionId);
  if (title) formData.append('title', title);
  return upload('/routine-pdf', formData);
}

/** Download routine PDF bytes (returns a Blob). */
export async function downloadRoutinePdf(id) {
  const response = await rawRequest('GET', `/routine-pdf/download/${id}`);
  return response.blob();
}

// ---------------------------------------------------------------------------
// Calendar — effective schedule (official routine + overrides + exams)
// ---------------------------------------------------------------------------
export const getCalendarDay = (dateIso, { sectionId } = {}) =>
  apiClient.get('/calendar/day', { query: { date: dateIso, sectionId } });
export const getCalendarRange = (fromIso, toIso, { sectionId } = {}) =>
  apiClient.get('/calendar/range', { query: { from: fromIso, to: toIso, sectionId } });

// ---------------------------------------------------------------------------
// Schedule overrides
// ---------------------------------------------------------------------------
export const getOverrides = ({ sectionId, status } = {}) =>
  apiClient.get('/overrides', { query: { sectionId, status } });
export const createOverride = (data) => apiClient.post('/overrides', data);
export const reviewOverride = (id, decision, note) =>
  apiClient.put(`/overrides/${id}/review`, { decision, ...(note ? { note } : {}) });
export const cancelOverride = (id) => apiClient.delete(`/overrides/${id}`);

// ---------------------------------------------------------------------------
// Attendance (personal tracker)
// ---------------------------------------------------------------------------
export const getAttendanceView = ({ days = 90 } = {}) =>
  apiClient.get('/attendance/view', { query: { days } });
export const markAttendance = ({
  courseId,
  date,
  startTime,
  endTime,
  status,
  classType = 'lecture',
}) =>
  apiClient.post('/attendance/mark', {
    courseId,
    date,
    startTime,
    endTime,
    status,
    classType,
  });
