import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "./i18n/i18n";
import { SiteContentProvider } from "./content/SiteContentProvider";
import { Layout } from "./components/Layout/Layout";
import { HomePage } from "./pages/HomePage";
import { StubPage } from "./pages/StubPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { STUB_ROUTES } from "./data/nav";

const AdminApp = lazy(() => import("./admin/AdminApp"));

export default function App() {
  return (
    <I18nProvider>
      <SiteContentProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
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
