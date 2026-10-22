import axios from "axios";
import toast from "react-hot-toast";
import { API_URL } from "../../config";
import { translateUiText } from "../locales/uiText";

const API_BASE_URL = API_URL;
const getPreferredLanguage = () => {
  if (typeof window === "undefined") return "en";
  try {
    return window.localStorage.getItem("ipes-language") === "am" ? "am" : "en";
  } catch {
    return "en";
  }
};

export const DASHBOARD_DATA_UPDATED_EVENT = "ipes-dashboard-data-updated";
export const EVALUATION_WINDOW_UPDATED_EVENT = "ipes-evaluation-window-updated";

const getBrowserDeviceId = () => {
  if (typeof window === "undefined") return "";
  try {
    const storedId = window.localStorage.getItem("ipesDeviceId");
    if (storedId) return storedId;
    const deviceId = window.crypto?.randomUUID?.() || `browser-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem("ipesDeviceId", deviceId);
    return deviceId;
  } catch {
    return "";
  }
};

axios.interceptors.request.use((config) => {
  if (typeof window === "undefined") return config;
  const deviceId = getBrowserDeviceId();
  config.headers = config.headers || {};
  if (deviceId) {
    if (typeof config.headers.set === "function") {
      config.headers.set("X-Device-ID", deviceId);
    } else {
      config.headers["X-Device-ID"] = deviceId;
    }
  }

  const token =
    window.localStorage.getItem("ipesAuthToken") ||
    window.localStorage.getItem("token");
  if (!token) return config;

  if (typeof config.headers.set === "function") {
    config.headers.set("Authorization", `Bearer ${token}`);
  } else {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const requestUrl = error?.config?.url || "";
    const isLoginRequest = requestUrl.includes("/auth/login");
    const message = error?.response?.data?.message;
    const isSystemUnavailable =
      status === 503 ||
      (status === 403 && /system.*(disabled|unavailable|maintenance)/i.test(String(message || "")));

    if (typeof window !== "undefined" && isSystemUnavailable) {
      const keysToClear = ["isLoggedIn", "userData", "user", "ipesAuthToken", "token", "role"];
      keysToClear.forEach((key) => {
        window.localStorage.removeItem(key);
        window.sessionStorage.removeItem(key);
      });
      toast.error(
        translateUiText(
          "System is currently unavailable. Please contact the administrator.",
          getPreferredLanguage(),
        ),
        { id: "system-unavailable" },
      );
      window.dispatchEvent(new Event("ipes-system-disabled"));
    }

    if (typeof window !== "undefined" && !isLoginRequest && status === 401) {
      window.localStorage.removeItem("token");
      window.localStorage.removeItem("ipesAuthToken");
      window.localStorage.removeItem("role");
      window.localStorage.removeItem("user");
      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    }
    return Promise.reject(error);
  },
);

const getMessageText = (message, language = "en") => {
  if (typeof message === "string") return translateUiText(message, language);
  if (Array.isArray(message)) {
    return message
      .map((entry) => getMessageText(entry, language))
      .filter(Boolean)
      .join(" ");
  }
  if (message && typeof message === "object") {
    if (language === "am" && typeof message.am === "string") return message.am;
    if (typeof message.en === "string") return message.en;
    if (typeof message.am === "string") return message.am;
    if (typeof message.message === "string") return message.message;
    return Object.values(message)
      .map((entry) => getMessageText(entry, language))
      .filter(Boolean)
      .join(" ");
  }
  return "";
};

const request = async (path, options = {}) => {
  const { ...axiosOptions } = options;
  const containsFormData = axiosOptions.data instanceof FormData;
  const headers = {
    ...(containsFormData ? {} : { "Content-Type": "application/json" }),
    ...(axiosOptions.headers || {}),
  };

  try {
    const response = await axios({
      url: `${API_BASE_URL}${path}`,
      headers,
      withCredentials: true,
      ...axiosOptions,
    });

    const responseData = response.data;
    const method = String(axiosOptions.method || "GET").toUpperCase();
    if (typeof window !== "undefined" && !["GET", "HEAD", "OPTIONS"].includes(method)) {
      window.dispatchEvent(new Event(DASHBOARD_DATA_UPDATED_EVENT));
    }
    if (
      responseData &&
      typeof responseData === "object" &&
      responseData.hasOwnProperty("success") &&
      responseData.hasOwnProperty("data")
    ) {
      return responseData.data;
    }

    return responseData;
  } catch (error) {
    const language = getPreferredLanguage();
    const errorPayload = error?.response?.data;
    const errorMessage = getMessageText(
      errorPayload?.message ||
        errorPayload?.error ||
        error.message ||
        translateUiText("Request failed.", language),
      language,
    );
    const errorDetail = getMessageText(errorPayload?.error, language);
    const validationDetails = Array.isArray(errorPayload?.errors)
      ? errorPayload.errors
          .map(({ field, message: fieldMessage }) => {
            const detail = getMessageText(fieldMessage, language);
            return detail ? `${field ? `${field}: ` : ""}${detail}` : "";
          })
          .filter(Boolean)
          .join(" ")
      : "";
    const message =
      [
        errorMessage,
        errorDetail && errorDetail !== errorMessage ? errorDetail : "",
        validationDetails,
      ]
        .filter(Boolean)
        .join(" ");
    const normalizedError = new Error(message || translateUiText("Request failed.", language));
    normalizedError.status = error?.response?.status || 500;
    normalizedError.response = error?.response;
    throw normalizedError;
  }
};

export const authApi = {
  registerInstructor: (payload) =>
    request("/auth/register-instructor", { method: "POST", data: payload }),
  registerStudent: (payload) =>
    request("/students/register", { method: "POST", data: payload }),
  bulkRegister: (payload) =>
    request("/auth/bulk-register", { method: "POST", data: payload }),
  createDepartment: (payload) =>
    request("/auth/departments", { method: "POST", data: payload }),
  login: (payload) => request("/auth/login", { method: "POST", data: payload }),
  logout: () => request("/auth/logout", { method: "POST" }),
  me: () => request("/auth/me"),
  changePassword: (payload) =>
    request("/auth/change-password", { method: "POST", data: payload }),
  forgotPassword: (identifier) =>
    request("/auth/forgot-password", {
      method: "POST",
      data: { email: identifier },
    }),
  verifyOtp: (payload) =>
    request("/auth/verify-otp", { method: "POST", data: payload }),
  resetPasswordOtp: (payload) =>
    request("/auth/reset-password-otp", { method: "POST", data: payload }),
  resetPassword: (payload) =>
    request("/auth/reset-password", { method: "POST", data: payload }),
};

export const publicApi = {
  getSystemStats: () => request("/public/system-stats"),
  getIEPSFocusAreas: () => request("/public/focus-areas"),
  getCollegesWithDepartments: () =>
    request("/public/colleges-with-departments"),
};

export const adminApi = {
  getContactInfo: () => request("/contact/admin-info"),
  updateContactInfo: (payload) =>
    request("/contact/admin-info", { method: "PUT", data: payload }),
  getDashboardStats: () => request("/admin/dashboard-stats"),
  getBroadcastHistory: () => request("/admin/broadcasts"),
  sendBroadcast: (payload) =>
    request("/admin/broadcasts", { method: "POST", data: payload }),
  deleteBroadcast: (id) =>
    request(`/admin/broadcasts/${id}`, { method: "DELETE" }),
  getDepartmentAnalytics: () => request("/admin/department-analytics"),
  getSecurityLogs: (params = {}) => request("/admin/security-logs", { params }),
  getAuditLogs: (params = {}) => request("/admin/audit-logs", { params }),
  getSecurityScore: () => request("/admin/security-score"),
  getApiToken: () => request("/admin/api-token"),
  rotateApiToken: () => request("/admin/api-token/rotate", { method: "POST" }),
  getMfaToggle: () => request("/admin/mfa-toggle"),
  setMfaToggle: (enabled, roles = []) =>
    request("/admin/mfa-toggle", { method: "POST", data: { enabled, roles } }),
  getDatabaseHealth: () => request("/admin/db-health"),
  setSystemMaintenance: (active) =>
    request("/admin/system/maintenance", { method: "POST", data: { active } }),
  getEvaluationWindow: () => request("/admin/system/evaluation-window"),
  getEvaluationCycles: () => request("/admin/system/evaluation-cycles"),
  startEvaluationCycle: async (payload) => {
    const startedCycle = await request("/admin/system/evaluation-cycles", {
      method: "POST",
      data: payload,
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(EVALUATION_WINDOW_UPDATED_EVENT));
    }
    return startedCycle;
  },
  setEvaluationWindow: async (payload) => {
    const savedWindow = await request("/admin/system/evaluation-window", {
      method: "PUT",
      data: payload,
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(EVALUATION_WINDOW_UPDATED_EVENT));
    }
    return savedWindow;
  },
  createCollege: (payload) =>
    request("/admin/colleges", { method: "POST", data: payload }),
  updateCollege: (id, payload) =>
    request(`/admin/colleges/${id}`, { method: "PUT", data: payload }),
  deleteCollege: (id) =>
    request(`/admin/colleges/${id}`, { method: "DELETE" }),
  getColleges: () => request("/colleges"),
  getRoleCandidates: () => request("/admin/role-candidates"),
  downloadRegisteredUsers: (role) =>
    request("/admin/registered-users/export", {
      params: { role },
      responseType: "blob",
    }),
  getManagementRoleOccupant: (params) =>
    request("/admin/management-role-occupant", { params }),
  assignManagementRole: (id, role, hierarchy = {}) =>
    request(`/admin/users/${id}/management-role`, {
      method: "PUT",
      data: { role, ...hierarchy },
    }),
  resetManagementRole: (id) =>
    request(`/admin/users/${id}/management-role/reset`, { method: "PUT" }),
  resetUserPassword: (userId) =>
    request(`/admin/users/${userId}/password/reset`, { method: "PUT" }),
};

export const deanApi = {
  getOverviewStats: () => request("/dean/overview-stats"),
  getDepartmentAnalytics: () => request("/dean/department-analytics"),
  getDepartmentHeads: () => request("/dean/dept-heads"),
  submitDepartmentHeadEvaluation: (payload) =>
    request("/dean/submit-evaluation", { method: "POST", data: payload }),
  calculateDepartmentHeadResults: () =>
    request("/dean/calculate-dept-head-results", { method: "POST" }),
  getFacultyPerformance: () => request("/dean/faculty-performance"),
  getMyPerformance: () => request("/dean/my-performance"),
};

export const directorateApi = {
  getOverviewStats: () => request("/directorate/overview-stats"),
  getDeans: () => request("/directorate/deans"),
  getAnalytics: () => request("/directorate/analytics"),
  evaluateDean: (payload) =>
    request("/directorate/evaluate-dean", { method: "POST", data: payload }),
  calculatePublishResults: () =>
    request("/directorate/calculate-publish-results", { method: "POST" }),
};

export const vicePresidentApi = {
  getAcademicDirectorate: () => request("/vice-president/academic-directorate"),
  evaluateAcademicDirectorate: (payload) =>
    request("/vice-president/evaluate-academic-directorate", { method: "POST", data: payload }),
  calculatePublishResults: () =>
    request("/vice-president/calculate-publish-results", { method: "POST" }),
};

export const departmentApi = {
  createDepartment: (payload) =>
    request("/departments", { method: "POST", data: payload }),
  updateDepartment: (id, payload) =>
    request(`/department/${id}`, { method: "PUT", data: payload }),
  deleteDepartment: (id) => request(`/department/${id}`, { method: "DELETE" }),
  getDepartmentData: (type, department) =>
    request(`/department-data/${type}`, {
      method: "GET",
      params: { department },
    }),
  getOverview: (department) =>
    request("/department/overview", { params: { department } }),
  getAssignments: () => request("/department/assignments"),
  createAssignment: (payload) =>
    request("/department/assignments", { method: "POST", data: payload }),
  updateAssignment: (id, payload) =>
    request(`/department/assignments/${id}`, { method: "PUT", data: payload }),
  deleteAssignment: (id) =>
    request(`/department/assignments/${id}`, { method: "DELETE" }),
  getAll: () => request("/departments"),
  getDepartmentCourses: (department) =>
    request("/dept-head/courses", { method: "GET", params: { department } }),
  getDepartmentInstructors: (department) =>
    request("/dept-head/instructors", {
      method: "GET",
      params: { department },
    }),
  getDepartmentStudents: (department) =>
    request("/dept-head/students", { method: "GET", params: { department } }),
  getAnalytics: () => request("/dept-head/analytics"),
};

export const registrationApi = {
  getUsers: (filters = {}) =>
    request("/secure/users", { method: "GET", params: filters }),
  getInstructorStaff: (filters = {}) =>
    request("/secure/users", {
      method: "GET",
      params: { ...filters, role: "instructors" },
    }),
  getStudents: (filters = {}) =>
    request("/secure/users", {
      method: "GET",
      params: { role: "student", ...filters },
    }),
  getCourses: (filters = {}) =>
    request("/secure/courses", { method: "GET", params: filters }),
  getEvaluations: () => request("/secure/evaluations"),
  createUser: (payload) =>
    request("/secure/users", { method: "POST", data: payload }),
  updateUser: (id, payload) =>
    request(`/secure/users/${id}`, { method: "PUT", data: payload }),
  deleteUser: (id) => request(`/secure/users/${id}`, { method: "DELETE" }),
  createCourse: (payload) =>
    request("/courses/register", { method: "POST", data: payload }),
  bulkUploadCourses: (payload) =>
    request("/secure/courses/bulk-upload", { method: "POST", data: payload }),
  updateCourse: (id, payload) =>
    request(`/secure/courses/${id}`, { method: "PUT", data: payload }),
  deleteCourse: (id) => request(`/secure/courses/${id}`, { method: "DELETE" }),
};

export const studentApi = {
  // hits /api/students
  bulkUpload: (payload) =>
    request("/students/bulk-upload", { method: "POST", data: payload }),
  getFiltered: (filters = {}) =>
    request("/students", { method: "GET", params: filters }),
  getProfile: () => request("/student/profile", { method: "GET" }),
  getPendingEvaluations: () =>
    request("/student/pending-evaluations", { method: "GET" }),
  getAvailableEvaluations: () =>
    request("/student/evaluations/available", { method: "GET" }),
};

export const userApi = {
  getProfile: () => request("/user/profile"),
  updateProfile: (payload) =>
    request("/user/profile", { method: "PUT", data: payload }),
  getNotificationPreferences: () =>
    request("/user/notification-preferences"),
  updateNotificationPreferences: (payload) =>
    request("/user/notification-preferences", { method: "PUT", data: payload }),
  getSessions: () => request("/user/sessions"),
  revokeSession: (sessionId) =>
    request(`/user/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" }),
  getUsers: (filters = {}) =>
    request("/secure/users", { method: "GET", params: filters }),
  getStudents: (filters = {}) =>
    request("/secure/users", {
      method: "GET",
      params: { role: "student", ...filters },
    }),
  createUser: (payload) =>
    request("/secure/users", { method: "POST", data: payload }),
  updateUser: (id, payload) =>
    request(`/secure/users/${id}`, { method: "PUT", data: payload }),
  deleteUser: (id) => request(`/secure/users/${id}`, { method: "DELETE" }),
};

export const courseApi = {
  getCourses: () => request("/secure/courses"),
  createCourse: (payload) =>
    request("/secure/courses", { method: "POST", data: payload }),
  updateCourse: (id, payload) =>
    request(`/secure/courses/${id}`, { method: "PUT", data: payload }),
  deleteCourse: (id) => request(`/secure/courses/${id}`, { method: "DELETE" }),
};

export const evaluationApi = {
  getFinalResults: (params) =>
    request("/results/final", { method: "GET", params }),
  getFinalResultCertificate: (instructorId, params) =>
    request(`/results/final/${instructorId}/certificate`, {
      method: "GET",
      params,
    }),
  getPublishAssignments: (params = {}) =>
    request("/evaluations/publish-assignments", { method: "GET", params }),
  publishStudent: (payload) =>
    request("/evaluations/publish-student", { method: "POST", data: payload }),
  publishCourseLabAssistant: (payload) =>
    request("/evaluations/publish", { method: "POST", data: payload }),
  unpublishStudent: (payload) =>
    request("/evaluations/student/unpublish", {
      method: "POST",
      data: payload,
    }),
  publishInstructor: (payload) =>
    request("/evaluations/publish-instructor", {
      method: "POST",
      data: payload,
    }),
  publishDispatch: (payload) =>
    request("/evaluations/publish-dispatch", { method: "POST", data: payload }),
  getOverview: () => request("/evaluations/template"),
  getLatestTemplate: () => request("/evaluations/template"),
  saveTemplate: (payload) =>
    request("/evaluations/template", { method: "POST", data: payload }),
  updateTemplate: (id, payload) =>
    request(`/evaluations/template/${id}`, { method: "PUT", data: payload }),
  dispatchStudentEvaluation: (payload) =>
    request("/evaluations/dispatch", { method: "POST", data: payload }),
  getDispatches: (filters = {}) =>
    request("/evaluations/dispatches", { method: "GET", params: filters }),
  getSubmissions: (filters = {}) =>
    request("/evaluations/submissions", { method: "GET", params: filters }),
  getPendingStudentEvaluations: () =>
    request("/student/evaluations/pending", { method: "GET" }),
  getStudentEvaluations: () =>
    request("/student/evaluations", { method: "GET" }),
  submitStudentEvaluation: (payload) =>
    request("/student/evaluations/submit", { method: "POST", data: payload }),
  submitStudentEvaluationForm: (payload) =>
    request("/evaluations/submit-student", { method: "POST", data: payload }),
  submitPeerEvaluationForm: (payload) =>
    request("/evaluations/submit-peer", { method: "POST", data: payload }),
  getDeptHeadStudentTracking: (params = {}) =>
    request("/dept-head/tracking/students", { method: "GET", params }),
  getDeptHeadTrackingInstructors: (params = {}) =>
    request("/dept-head/tracking/instructors", { method: "GET", params }),
  getDeptHeadPeerTracking: (params = {}) =>
    request("/dept-head/tracking/peers", { method: "GET", params }),
  publishDepartmentPeerEvaluations: (payload = {}) =>
    request("/evaluations/peer/publish-department", {
      method: "POST",
      data: payload,
    }),
  unpublishDepartmentPeerEvaluations: (payload = {}) =>
    request("/evaluations/peer/unpublish-department", {
      method: "POST",
      data: payload,
    }),
  getDeptHeadDeptHeadTracking: (params = {}) =>
    request("/dept-head/tracking/dept-head", { method: "GET", params }),
  sendReminder: (payload = {}) =>
    request("/evaluations/send-reminder", { method: "POST", data: payload }),
  calculatePublishFinalResults: () =>
    request("/dept-head/calculate-publish", { method: "POST" }),
  getDeptHeadInstructors: (params = {}) =>
    request("/dept-head/instructors", { method: "GET", params }),
  submitDeptHeadEvaluation: (payload) =>
    request("/dept-head/submit-evaluation", { method: "POST", data: payload }),
  getDeptHeadEvaluations: (params = {}) =>
    request("/dept-head/evaluations", { method: "GET", params }),
  getDeptHeadEvaluation: (id) =>
    request(`/dept-head/evaluations/${id}`, { method: "GET" }),
  getPerformanceDashboard: () =>
    request("/instructor/performance-summary", { method: "GET" }),
  getLabAssistantPerformance: () =>
    request("/lab-assistant/performance-summary", { method: "GET" }),
  getDeptHeadPerformance: () =>
    request("/dept-head/performance", { method: "GET" }),
  getAll: () => request("/evaluations"),
  submitEvaluation: (payload) =>
    request("/evaluations", { method: "POST", data: payload }),
};

export const deptHeadApi = {
  getEvaluationSchedule: () =>
    request("/dept-head/evaluation-schedule"),
  setEvaluationSchedule: (payload) =>
    request("/dept-head/evaluation-schedule", {
      method: "POST",
      data: payload,
    }),
  clearEvaluationSchedule: () =>
    request("/dept-head/evaluation-schedule", { method: "DELETE" }),
};

export const notificationApi = {
  getUnread: () => request("/notifications"),
  getAll: (filter = "all") => request("/notifications", { params: { filter } }),
  markRead: (id) => request(`/notifications/${id}/read`, { method: "PUT" }),
  deleteOne: (id) => request(`/notifications/${id}`, { method: "DELETE" }),
  clearAll: () => request("/notifications/clear-all", { method: "DELETE" }),
  deleteMany: (ids) =>
    request("/notifications/bulk-delete", { method: "DELETE", data: { ids } }),
};

export const criteriaApi = {
  get: (type, targetRole) =>
    request("/criteria", {
      method: "GET",
      params: { type, ...(targetRole ? { target_role: targetRole } : {}) },
    }),
  getAll: (type) =>
    request("/admin/criteria", { method: "GET", params: type ? { type } : {} }),
  create: (payload) =>
    request("/admin/criteria", { method: "POST", data: payload }),
  update: (id, payload) =>
    request(`/admin/criteria/${id}`, { method: "PUT", data: payload }),
  remove: (id) => request(`/admin/criteria/${id}`, { method: "DELETE" }),
};

export const courseAssignmentApi = {
  assign: (payload) =>
    request("/assignments/assign", { method: "POST", data: payload }),
  batchAssign: (payload) =>
    request("/courses/batch-assign", { method: "POST", data: payload }),
  batchAssignMatrix: (payload) =>
    request("/courses/batch-assign-matrix", { method: "POST", data: payload }),
  getFilteredCourses: (params) =>
    request("/courses/by-filters", { method: "GET", params }),
  getDepartmentInstructors: (departmentId) =>
    request(`/courses/department-instructors/${departmentId}`, {
      method: "GET",
    }),
  getAll: () => request("/course-assignments"),
  create: (payload) =>
    request("/course-assignments", { method: "POST", data: payload }),
  createDeptHeadAssignment: (payload) =>
    request("/dept-head/assign-course", { method: "POST", data: payload }),
  updateAssignment: (id, payload) =>
    request(`/course-assignments/${id}`, { method: "PUT", data: payload }),
  deleteAssignment: (id) =>
    request(`/courses/assign/${id}`, { method: "DELETE" }),
  getStudentAssignments: () => request("/student/assigned-courses"),
  getInstructorDashboardStats: () => request("/instructor/dashboard-stats"),
  getInstructorAssignments: () => request("/instructor/assigned-courses"),
  getPeerEvaluations: () => request("/instructor/peer-evaluations"),
  getPeerTargets: () => request("/evaluations/peer-targets"),
  preparePeerTarget: (targetUserId) =>
    request(`/evaluations/peer-targets/${targetUserId}/assignment`, {
      method: "POST",
    }),
};
