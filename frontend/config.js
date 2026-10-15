// Environment configuration
export const API_URL =
  import.meta.env.VITE_API_URL || "/api";
export const resolveApiAssetUrl = (value) => {
  if (!value || /^(https?:|data:|blob:)/i.test(value)) return value || "";
  const origin = new URL(
    API_URL,
    typeof window === "undefined" ? "http://localhost" : window.location.origin,
  ).origin;
  return new URL(value, `${origin}/`).toString();
};
export const APP_NAME = "Instructor Performance Evaluation System";
export const UNIVERSITY_NAME = "Mekdela Amba University";

export const EVALUATION_CONFIG = {
  maxRating: 5,
  minRating: 1,
  categories: [
    "Teaching Methodology",
    "Subject Knowledge",
    "Communication Skills",
    "Student Engagement",
    "Assessment & Feedback",
  ],
};

export const ROUTES = {
  home: "/",
  about: "/about",
  contact: "/contact",
  login: "/login",
  studentDashboard: "/student-dashboard",
  adminDashboard: "/admin-dashboard",
};
