import { BrowserRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "./i18n/i18n";
import { Layout } from "./components/Layout/Layout";
import { HomePage } from "./pages/HomePage";
import { StubPage } from "./pages/StubPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { STUB_ROUTES } from "./data/nav";

export default function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            {STUB_ROUTES.map((path) => (
              <Route key={path} path={path} element={<StubPage />} />
            ))}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  );
}
