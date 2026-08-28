import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { LoginPage } from "@/pages/LoginPage";
import { OverviewPage } from "@/pages/CasesPage";
import { CasesPage } from "@/pages/CasesListPage";
import { CaseDetailPage } from "@/pages/CaseDetailPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { MockPortalsHubPage } from "@/pages/MockPortalsHubPage";
import {
  AgencyInboxPage,
  AgencyOverviewPage,
  AgencyTicketPage,
} from "@/pages/MockPages";
import { AgencyLoginPage } from "@/pages/AgencyLoginPage";
import { getToken } from "@/lib/api";

function RequireAuth({ children }: { children: ReactNode }) {
  if (!getToken()) return <Navigate to="/admin/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/admin/login" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="cases" element={<CasesPage />} />
        <Route path="cases/:ref" element={<CaseDetailPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="mock-portals" element={<MockPortalsHubPage />} />
        <Route path="portals" element={<MockPortalsHubPage />} />
      </Route>
      <Route path="/mock" element={<Navigate to="/admin/portals" replace />} />
      <Route path="/portals" element={<Navigate to="/admin/portals" replace />} />
      <Route path="/portals/:agencyId/login" element={<AgencyLoginPage />} />
      <Route path="/mock/:agencyId/login" element={<AgencyLoginPage />} />
      <Route path="/portals/:agencyId" element={<AgencyOverviewPage />} />
      <Route path="/portals/:agencyId/inbox" element={<AgencyInboxPage />} />
      <Route
        path="/portals/:agencyId/:externalRef"
        element={<AgencyTicketPage />}
      />
      <Route path="/mock/:agencyId" element={<AgencyOverviewPage />} />
      <Route path="/mock/:agencyId/inbox" element={<AgencyInboxPage />} />
      <Route
        path="/mock/:agencyId/:externalRef"
        element={<AgencyTicketPage />}
      />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
