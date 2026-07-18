import { Navigate, Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout";
import { useAuth } from "./auth/AuthContext";
import { AppsPage } from "./pages/Apps";
import { AuditPage } from "./pages/Audit";
import { DashboardPage } from "./pages/Dashboard";
import { LoginPage } from "./pages/Login";
import { LogsPage } from "./pages/Logs";
import { SessionsPage } from "./pages/Sessions";
import { UsersPage } from "./pages/Users";

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">Loading…</div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/apps" element={<AppsPage />} />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="/sessions" element={<SessionsPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
