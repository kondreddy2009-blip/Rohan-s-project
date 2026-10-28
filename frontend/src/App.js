import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import "@/App.css";

import { AuthProvider } from "@/lib/auth-context";
import { FavoritesProvider } from "@/lib/favorites-context";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Layout } from "@/components/Layout";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Discover from "@/pages/Discover";
import VenueDetail from "@/pages/VenueDetail";
import CheckIn from "@/pages/CheckIn";
import Wallet from "@/pages/Wallet";
import Redeem from "@/pages/Redeem";
import Profile from "@/pages/Profile";
import Bookings from "@/pages/Bookings";
import Info from "@/pages/Info";
import Events from "@/pages/Events";

// Heavy, role-specific pages are split out of the main bundle.
const Scan = lazy(() => import("@/pages/Scan"));
const StaffDashboard = lazy(() => import("@/pages/StaffDashboard"));

const INFO_SLUGS = ["about", "faq", "terms", "privacy", "refunds", "pricing", "shipping", "contact"];

const PageFallback = () => (
  <div className="flex min-h-[60vh] items-center justify-center bg-[#0B0A0A]" data-testid="page-loading">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#CE6A4A]" />
  </div>
);

function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login key="member" />} />
      <Route path="/restaurant-login" element={<Login key="restaurant" staff />} />
      {INFO_SLUGS.map((slug) => (
        <Route key={slug} path={`/${slug}`} element={<Info slug={slug} />} />
      ))}

      <Route path="/home" element={<Navigate to="/discover" replace />} />
      <Route
        path="/discover"
        element={
          <Layout>
            <Discover />
          </Layout>
        }
      />
      <Route
        path="/events"
        element={
          <Layout>
            <Events />
          </Layout>
        }
      />
      <Route
        path="/venues/:id"
        element={
          <Layout>
            <VenueDetail />
          </Layout>
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
        path="/bookings"
        element={
          <ProtectedRoute>
            <Layout>
              <Bookings />
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
    </Suspense>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <FavoritesProvider>
            <AppRoutes />
          </FavoritesProvider>
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
