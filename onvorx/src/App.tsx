import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { I18nProvider } from "./i18n/i18n";
import { SiteContentProvider } from "./content/SiteContentProvider";
import { Layout } from "./components/Layout/Layout";
import { HomePage } from "./pages/HomePage";
import { ServicesPage } from "./pages/ServicesPage";
import { StubPage } from "./pages/StubPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { STUB_ROUTES } from "./data/nav";
import { SERVICE_REDIRECTS } from "./data/servicesPage";

const AdminApp = lazy(() => import("./admin/AdminApp"));

export default function App() {
  return (
    <I18nProvider>
      <SiteContentProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="/services" element={<ServicesPage />} />
              {Object.entries(SERVICE_REDIRECTS).map(([from, to]) => (
                <Route key={from} path={from} element={<Navigate to={to} replace />} />
              ))}
              {STUB_ROUTES.map((path) => (
                <Route key={path} path={path} element={<StubPage />} />
              ))}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
            <Route
              path="/admin/*"
              element={
                <Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}>
                  <AdminApp />
                </Suspense>
              }
            />
          </Routes>
        </BrowserRouter>
      </SiteContentProvider>
    </I18nProvider>
  );
}
