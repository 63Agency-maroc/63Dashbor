"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { AdminWhatsappDashboard } from "@/components/dashboard/AdminWhatsappDashboard";
import { AdminDashboard } from "@/components/dashboard/AdminDashboard";

function DefaultHomePlaceholder() {
  return (
    <div className="container-fluid">
      <div className="app-page-head d-flex align-items-center justify-content-between">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item">
              <a href="/">
                <i className="fi fi-rr-home" /> Home
              </a>
            </li>
            <li className="breadcrumb-item active" aria-current="page">
              Dashboard
            </li>
          </ol>
        </nav>
      </div>

      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-body py-5 text-center">
              <h1 className="h3 mb-2">Dashboard</h1>
              <p className="text-muted mb-0">
                Bienvenue sur le dashboard 63 Agency. Contenu métier à brancher ensuite.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardHomePage() {
  const { user, isLoading } = useAuth();
  const role = typeof user?.role === "string" ? user.role : "";

  if (isLoading) {
    return (
      <div className="container-fluid py-5 text-center text-muted">
        <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden />
        Chargement…
      </div>
    );
  }

  if (role === "admin") {
    return <AdminDashboard />;
  }

  if (role === "admin_whatsapp") {
    return <AdminWhatsappDashboard />;
  }

  return <DefaultHomePlaceholder />;
}
