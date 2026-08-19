const API_BASE = "https://civora-backend-omxf.onrender.com";
const API_URL = `${API_BASE}/api`;

// Helper for Authorization Headers
function getAuthHeaders(extraHeaders = {}) {
  const token = localStorage.getItem("civora_token");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders
  };
}

// Helper to format image URLs (prefix relative backend /uploads with https://civora-backend-omxf.onrender.com)
export function formatImageUrl(url) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:")) {
    return url;
  }
  return `${API_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
}

// Format raw backend complaint object for React components
export function formatComplaintFromBackend(c) {
  if (!c) return null;
  return {
    id: c.id,
    title: c.title || "Civic Issue",
    description: c.description || "",
    category: c.category || "other",
    categoryLabel: c.categoryLabel || "📌 Other Issue",
    district: c.district || "Ranchi",
    ward: c.ward || "Ward 1",
    locationName: c.locationName || `${c.district || "Ranchi"}, Jharkhand`,
    lat: c.lat || 23.3441,
    lng: c.lng || 85.3096,
    priority: c.priority || "Medium",
    status: c.status || "Reported",
    upvotes: c.upvotes || 1,
    reportedBy: c.reportedBy || "Citizen",
    createdAt: c.createdAt || new Date().toISOString().split("T")[0],
    assignedDepartment: c.assignedDepartment || "General Municipal Department",
    aiConfidence: c.aiConfidence || "95%",
    aiClusterCount: c.aiClusterCount || 1,
    duplicateGroup: c.duplicateGroup || null,
    beforeImage: formatImageUrl(c.beforeImage) || "https://images.unsplash.com/photo-1541888946425-d0fbb186a5b7?auto=format&fit=crop&w=800&q=80",
    afterImage: formatImageUrl(c.afterImage) || null,
    verificationFeedback: c.verificationFeedback || null,
    timeline: (c.timeline || []).map((t) => ({
      step: t.step,
      date: t.date,
      completed: t.completed,
      details: t.details
    }))
  };
}

// ================= AUTH APIs =================

export async function registerUser(userData) {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userData)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: "Registration failed" }));
    throw new Error(errorData.detail || "Registration failed");
  }
  return res.json();
}

export async function loginUser(credentials) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: "Login failed" }));
    throw new Error(errorData.detail || "Invalid email or password");
  }
  return res.json();
}

export async function getMe() {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) return null;
  return res.json();
}

// ================= AI PREDICTION API =================

export async function predictAIVision(imageFile) {
  const formData = new FormData();
  formData.append("file", imageFile);

  const res = await fetch(`${API_URL}/predict`, {
    method: "POST",
    body: formData
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: "AI Prediction failed" }));
    throw new Error(errorData.detail || "AI Prediction failed");
  }
  return res.json();
}

// ================= COMPLAINT APIs =================

export async function fetchComplaints(filters = {}) {
  const query = new URLSearchParams();
  if (filters.category && filters.category !== "all") query.append("category", filters.category);
  if (filters.district && filters.district !== "all") query.append("district", filters.district);
  if (filters.status && filters.status !== "all") query.append("status_filter", filters.status);
  if (filters.search) query.append("search", filters.search);

  const res = await fetch(`${API_URL}/complaints${query.toString() ? `?${query.toString()}` : ""}`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    throw new Error("Unable to fetch complaints from backend");
  }
  const rawList = await res.json();
  return rawList.map(formatComplaintFromBackend);
}

export async function submitComplaint(formData) {
  const res = await fetch(`${API_URL}/complaints`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: "Failed to submit complaint" }));
    throw new Error(errorData.detail || "Failed to submit complaint");
  }
  const rawData = await res.json();
  return formatComplaintFromBackend(rawData);
}

export async function toggleUpvoteApi(complaintId) {
  const res = await fetch(`${API_URL}/complaints/${complaintId}/upvote`, {
    method: "POST",
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error("Upvote action failed");
  return res.json();
}

export async function assignDepartmentApi(complaintId, department) {
  const res = await fetch(`${API_URL}/complaints/${complaintId}/assign`, {
    method: "PUT",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ department })
  });
  if (!res.ok) throw new Error("Department assignment failed");
  const rawData = await res.json();
  return formatComplaintFromBackend(rawData);
}

export async function updateStatusApi(complaintId, status) {
  const res = await fetch(`${API_URL}/complaints/${complaintId}/status`, {
    method: "PUT",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ status })
  });
  if (!res.ok) throw new Error("Status update failed");
  const rawData = await res.json();
  return formatComplaintFromBackend(rawData);
}

export async function uploadResolutionProofApi(complaintId, proofFileOrUrl) {
  const formData = new FormData();
  if (proofFileOrUrl instanceof File) {
    formData.append("proof_image", proofFileOrUrl);
  } else if (typeof proofFileOrUrl === "string") {
    formData.append("proof_url", proofFileOrUrl);
  }

  const res = await fetch(`${API_URL}/complaints/${complaintId}/resolution-proof`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData
  });
  if (!res.ok) throw new Error("Resolution proof upload failed");
  const rawData = await res.json();
  return formatComplaintFromBackend(rawData);
}

export async function verifyResolutionApi(complaintId, approved, rating = 5, feedback = "") {
  const res = await fetch(`${API_URL}/complaints/${complaintId}/verify`, {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ approved, rating, feedback })
  });
  if (!res.ok) throw new Error("Citizen verification action failed");
  const rawData = await res.json();
  return formatComplaintFromBackend(rawData);
}

// ================= NOTIFICATION APIs =================

export async function fetchNotificationsApi() {
  const res = await fetch(`${API_URL}/notifications`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) return [];
  return res.json();
}

export async function markNotificationReadApi(notificationId) {
  const res = await fetch(`${API_URL}/notifications/${notificationId}/read`, {
    method: "PUT",
    headers: getAuthHeaders()
  });
  if (!res.ok) return null;
  return res.json();
}
