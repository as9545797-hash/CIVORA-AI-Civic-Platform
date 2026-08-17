import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { initialIssues } from "../data/mockIssues";
import {
  fetchComplaints,
  submitComplaint,
  toggleUpvoteApi,
  assignDepartmentApi,
  updateStatusApi,
  uploadResolutionProofApi,
  verifyResolutionApi,
  loginUser,
  registerUser,
  getMe,
  fetchNotificationsApi,
  markNotificationReadApi
} from "../services/api";

const CivicContext = createContext();

export function CivicProvider({ children }) {
  const [issues, setIssues] = useState(initialIssues);
  const [notifications, setNotifications] = useState([]);
  const [userRole, setUserRole] = useState(() => localStorage.getItem("civora_role") || "citizen"); // 'citizen' | 'admin'
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem("civora_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [upvotedIds, setUpvotedIds] = useState(new Set(["CIV-108"]));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [backendOnline, setBackendOnline] = useState(true);

  // Load complaints & notifications from Backend API
  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      const realComplaints = await fetchComplaints();
      if (Array.isArray(realComplaints) && realComplaints.length > 0) {
        setIssues(realComplaints);
      }
      setBackendOnline(true);
      setError(null);
    } catch (err) {
      console.warn("Backend server offline or unreachable. Falling back to local data:", err.message);
      setBackendOnline(false);
      setError("Unable to connect to backend server (http://localhost:8000). Showing cached / fallback civic data.");
    } finally {
      setLoading(false);
    }

    // Try fetching notifications if backend online
    try {
      const notifs = await fetchNotificationsApi();
      if (Array.isArray(notifs)) {
        setNotifications(notifs);
      }
    } catch (e) {
      // Ignore notification load errors when backend offline
    }
  }, []);

  // Initial load
  useEffect(() => {
    refreshData();
    // Validate stored token user profile
    const token = localStorage.getItem("civora_token");
    if (token) {
      getMe().then((u) => {
        if (u) {
          setCurrentUser(u);
          setUserRole(u.role || "citizen");
          localStorage.setItem("civora_role", u.role || "citizen");
          localStorage.setItem("civora_user", JSON.stringify(u));
        }
      });
    }
  }, [refreshData]);

  // Auth: Login
  const login = async (email, password) => {
    try {
      const data = await loginUser({ email, password });
      localStorage.setItem("civora_token", data.access_token);
      localStorage.setItem("civora_user", JSON.stringify(data.user));
      localStorage.setItem("civora_role", data.user.role);
      setCurrentUser(data.user);
      setUserRole(data.user.role);
      await refreshData();
      return data;
    } catch (err) {
      throw err;
    }
  };

  // Auth: Register
  const register = async (userData) => {
    try {
      const data = await registerUser(userData);
      localStorage.setItem("civora_token", data.access_token);
      localStorage.setItem("civora_user", JSON.stringify(data.user));
      localStorage.setItem("civora_role", data.user.role);
      setCurrentUser(data.user);
      setUserRole(data.user.role);
      await refreshData();
      return data;
    } catch (err) {
      throw err;
    }
  };

  // Auth: Logout
  const logout = () => {
    localStorage.removeItem("civora_token");
    localStorage.removeItem("civora_user");
    localStorage.removeItem("civora_role");
    setCurrentUser(null);
    setUserRole("citizen");
  };

  // Add a new citizen report to backend
  const addIssue = async (newIssueData) => {
    let formData = null;

    if (newIssueData instanceof FormData) {
      formData = newIssueData;
    } else {
      formData = new FormData();
      if (newIssueData.title) formData.append("title", newIssueData.title);
      if (newIssueData.description) formData.append("description", newIssueData.description);
      if (newIssueData.category) formData.append("category", newIssueData.category);
      if (newIssueData.district) formData.append("district", newIssueData.district);
      if (newIssueData.ward) formData.append("ward", newIssueData.ward || "Ward 1");
      if (newIssueData.location) formData.append("location", newIssueData.location);
      if (newIssueData.latitude) formData.append("latitude", newIssueData.latitude);
      if (newIssueData.longitude) formData.append("longitude", newIssueData.longitude);

      if (newIssueData.image_file instanceof File) {
        formData.append("image_file", newIssueData.image_file);
      }
    }

    try {
      const createdIssue = await submitComplaint(formData);
      setIssues((prev) => [createdIssue, ...prev]);
      return createdIssue;
    } catch (err) {
      console.error("Backend error submitting complaint, adding to local state fallback:", err);
      // Local state fallback if backend fails
      const newId = `CIV-${Math.floor(100 + Math.random() * 900)}`;
      const fallbackIssue = {
        id: newId,
        title: newIssueData.title || "Reported Civic Issue",
        description: newIssueData.description || "Issue reported by citizen.",
        category: newIssueData.category || "other",
        categoryLabel: newIssueData.categoryLabel || "📌 Other Issue",
        district: newIssueData.district || "Ranchi",
        ward: newIssueData.ward || "Ward 1",
        locationName: newIssueData.location || "Ranchi, Jharkhand",
        lat: 23.3441 + (Math.random() - 0.5) * 0.05,
        lng: 85.3096 + (Math.random() - 0.5) * 0.05,
        priority: newIssueData.priority || "Medium",
        status: "Reported",
        upvotes: 1,
        reportedBy: currentUser ? currentUser.full_name : "You (Citizen)",
        createdAt: new Date().toISOString().split("T")[0],
        assignedDepartment: newIssueData.department || "General Municipal Department",
        aiConfidence: newIssueData.confidence || "94%",
        aiClusterCount: 1,
        beforeImage: newIssueData.image || "https://images.unsplash.com/photo-1541888946425-d0fbb186a5b7?auto=format&fit=crop&w=800&q=80",
        afterImage: null,
        timeline: [
          { step: "Reported", date: "Just now", completed: true, details: "Submitted by citizen" },
          { step: "AI Analyzed", date: "Just now", completed: true, details: `AI Classified as ${newIssueData.title || "Civic Issue"}` },
          { step: "Verified", date: "Pending", completed: false, details: "Awaiting municipal inspector" },
          { step: "Assigned", date: "Pending", completed: false, details: "Not assigned yet" },
          { step: "In Progress", date: "Pending", completed: false, details: "Work queued" },
          { step: "Pending Verification", date: "Pending", completed: false, details: "Completion photo pending" },
          { step: "Resolved", date: "Pending", completed: false, details: "Awaiting citizen verification" }
        ]
      };
      setIssues((prev) => [fallbackIssue, ...prev]);
      return fallbackIssue;
    }
  };

  // Toggle upvote
  const toggleUpvote = async (issueId) => {
    try {
      await toggleUpvoteApi(issueId);
    } catch (e) {
      // Fallback local toggle
    }

    setIssues((prev) =>
      prev.map((item) => {
        if (item.id === issueId) {
          const isUpvoted = upvotedIds.has(issueId);
          return {
            ...item,
            upvotes: isUpvoted ? item.upvotes - 1 : item.upvotes + 1
          };
        }
        return item;
      })
    );

    setUpvotedIds((prev) => {
      const next = new Set(prev);
      if (next.has(issueId)) next.delete(issueId);
      else next.add(issueId);
      return next;
    });
  };

  // Assign department
  const assignIssue = async (issueId, departmentName) => {
    try {
      const updated = await assignDepartmentApi(issueId, departmentName);
      setIssues((prev) => prev.map((item) => (item.id === issueId ? updated : item)));
      return updated;
    } catch (err) {
      console.warn("Assign department backend call failed, updating local state:", err);
      setIssues((prev) =>
        prev.map((item) => {
          if (item.id === issueId) {
            const updatedTimeline = item.timeline.map((t) => {
              if (t.step === "Verified" || t.step === "Assigned") return { ...t, completed: true, date: "Just now" };
              if (t.step === "In Progress") return { ...t, completed: true, date: "Just now", details: `Assigned to ${departmentName}` };
              return t;
            });
            return { ...item, assignedDepartment: departmentName, status: "In Progress", timeline: updatedTimeline };
          }
          return item;
        })
      );
    }
  };

  // Update status
  const updateIssueStatus = async (issueId, newStatus) => {
    try {
      const updated = await updateStatusApi(issueId, newStatus);
      setIssues((prev) => prev.map((item) => (item.id === issueId ? updated : item)));
      return updated;
    } catch (err) {
      setIssues((prev) => prev.map((item) => (item.id === issueId ? { ...item, status: newStatus } : item)));
    }
  };

  // Upload resolution proof photo (Government contractor)
  const uploadResolutionProof = async (issueId, proofFileOrUrl) => {
    try {
      const updated = await uploadResolutionProofApi(issueId, proofFileOrUrl);
      setIssues((prev) => prev.map((item) => (item.id === issueId ? updated : item)));
      return updated;
    } catch (err) {
      console.warn("Upload resolution proof failed, applying fallback:", err);
      const proofUrl = typeof proofFileOrUrl === "string" ? proofFileOrUrl : "https://images.unsplash.com/photo-1584467735871-8e85353a8413?auto=format&fit=crop&w=800&q=80";
      setIssues((prev) =>
        prev.map((item) => (item.id === issueId ? { ...item, afterImage: proofUrl, status: "Pending Verification" } : item))
      );
    }
  };

  // Verify resolution (Citizen sign-off / reopen)
  const verifyIssueResolution = async (issueId, approved, rating = 5, feedback = "") => {
    try {
      const updated = await verifyResolutionApi(issueId, approved, rating, feedback);
      setIssues((prev) => prev.map((item) => (item.id === issueId ? updated : item)));
      return updated;
    } catch (err) {
      console.warn("Verify resolution API call failed, applying fallback:", err);
      setIssues((prev) =>
        prev.map((item) => {
          if (item.id === issueId) {
            if (approved) {
              const updatedTimeline = item.timeline.map((t) => ({ ...t, completed: true }));
              return {
                ...item,
                status: "Resolved",
                verificationFeedback: feedback || "Verified and approved by citizen.",
                timeline: updatedTimeline
              };
            } else {
              const updatedTimeline = item.timeline.map((t) => {
                if (t.step === "Pending Verification" || t.step === "Resolved") return { ...t, completed: false };
                return t;
              });
              return {
                ...item,
                status: "In Progress",
                verificationFeedback: `Re-opened by citizen: ${feedback}`,
                timeline: updatedTimeline
              };
            }
          }
          return item;
        })
      );
    }
  };

  // Mark notification read
  const markNotificationRead = async (notifId) => {
    try {
      await markNotificationReadApi(notifId);
    } catch (e) {}
    setNotifications((prev) => prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n)));
  };

  return (
    <CivicContext.Provider
      value={{
        issues,
        notifications,
        userRole,
        setUserRole: (role) => {
          setUserRole(role);
          localStorage.setItem("civora_role", role);
        },
        currentUser,
        loading,
        error,
        backendOnline,
        upvotedIds,
        login,
        register,
        logout,
        addIssue,
        toggleUpvote,
        assignIssue,
        updateIssueStatus,
        uploadResolutionProof,
        verifyIssueResolution,
        markNotificationRead,
        refreshData
      }}
    >
      {children}
    </CivicContext.Provider>
  );
}

export function useCivic() {
  return useContext(CivicContext);
}
