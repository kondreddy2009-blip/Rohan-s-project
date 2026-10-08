import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import "@/App.css";

import { AuthProvider } from "@/lib/auth-context";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Layout } from "@/components/Layout";
import { AdminGuard, AdminPartnerFormRoute } from "@/components/AdminGuard";
import { PartnerFormProvider } from "@/components/PartnerFormModal";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Discover from "@/pages/Discover";
import VenueDetail from "@/pages/VenueDetail";
import RestaurantPage from "@/pages/RestaurantPage";
import Events from "@/pages/Events";
import CheckIn from "@/pages/CheckIn";
import Scan from "@/pages/Scan";
import Wallet from "@/pages/Wallet";
import Redeem from "@/pages/Redeem";
import Profile from "@/pages/Profile";
import StaffDashboard from "@/pages/StaffDashboard";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />

      <Route
        path="/discover"
        element={
          <ProtectedRoute>
            <Layout>
              <Discover />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/restaurant/:slug"
        element={
          <ProtectedRoute>
            <Layout>
              <RestaurantPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/events"
        element={
          <ProtectedRoute>
            <Layout>
              <Events />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/venues/:id"
        element={
          <ProtectedRoute>
            <VenueDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/partners/new"
        element={
          <ProtectedRoute>
            <AdminGuard>
              <AdminPartnerFormRoute />
            </AdminGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/partners/:slug/edit"
        element={
          <ProtectedRoute>
            <AdminGuard>
              <AdminPartnerFormRoute />
            </AdminGuard>
          </ProtectedRoute>
        }
      />
      <Route path="/admin/*" element={<Navigate to="/discover" replace />} />
      <Route
        path="/checkin/:id"
        element={
          <ProtectedRoute>
            <Layout single>
              <CheckIn />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/scan"
        element={
          <ProtectedRoute>
            <Layout single>
              <Scan />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/wallet"
        element={
          <ProtectedRoute>
            <Layout single>
              <Wallet />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/redeem"
        element={
          <ProtectedRoute>
            <Layout single>
              <Redeem />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Layout single>
              <Profile />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/staff"
        element={
          <ProtectedRoute staff>
            <Layout single>
              <StaffDashboard />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <PartnerFormProvider>
            <AppRoutes />
          </PartnerFormProvider>
          <Toaster
            theme="dark"
            position="top-center"
            toastOptions={{
              style: {
                background: "#1B1917",
                border: "1px solid #262321",
                color: "#F2EDE7",
                fontFamily: "Schibsted Grotesk, sans-serif",
                fontSize: "0.85rem",
                letterSpacing: "0",
                borderRadius: "16px",
              },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
