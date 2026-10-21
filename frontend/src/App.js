import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import "@/App.css";

import { AuthProvider } from "@/lib/auth-context";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Layout } from "@/components/Layout";

import Login from "@/pages/Login";
import Discover from "@/pages/Discover";
import VenueDetail from "@/pages/VenueDetail";
import CheckIn from "@/pages/CheckIn";
import Scan from "@/pages/Scan";
import Wallet from "@/pages/Wallet";
import Redeem from "@/pages/Redeem";
import Profile from "@/pages/Profile";
import StaffDashboard from "@/pages/StaffDashboard";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login key="member" />} />
      <Route path="/restaurant-login" element={<Login key="restaurant" staff />} />

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
        path="/venues/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <VenueDetail />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/checkin/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <CheckIn />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/scan"
        element={
          <ProtectedRoute>
            <Layout>
              <Scan />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/wallet"
        element={
          <ProtectedRoute>
            <Layout>
              <Wallet />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/redeem"
        element={
          <ProtectedRoute>
            <Layout>
              <Redeem />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Layout>
              <Profile />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/staff/:tab?"
        element={
          <ProtectedRoute staff>
            <Layout>
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
          <AppRoutes />
          <Toaster
            theme="dark"
            position="top-center"
            toastOptions={{
              style: {
                background: "#1F1D1B",
                border: "1px solid #3A3733",
                color: "#F4F1EC",
                fontFamily: "Inter, sans-serif",
                fontSize: "0.85rem",
                letterSpacing: "0.02em",
                borderRadius: "2px",
              },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
