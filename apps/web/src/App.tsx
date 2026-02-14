import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { LandingPage } from "@/pages/landing";
import { ProjectsPage } from "@/pages/projects";
import { JobsPage } from "@/pages/jobs";
import { JobDetailPage } from "@/pages/job-detail";
import { NewJobPage } from "@/pages/new-job";
import { ProfilePage } from "@/pages/profile";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { PublicProfilePage } from "@/pages/public-profile";
import { PublicPacketPage } from "@/pages/public-packet";
import { SecurityPage } from "@/pages/security";
import { ExamplePacketPage } from "@/pages/example-packet";

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <LandingPage /> },
      {
        path: "projects",
        element: (
          <ProtectedRoute>
            <ProjectsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "jobs",
        element: (
          <ProtectedRoute>
            <JobsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "jobs/new",
        element: (
          <ProtectedRoute>
            <NewJobPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "jobs/:id",
        element: (
          <ProtectedRoute>
            <JobDetailPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "profile",
        element: (
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    path: "/example-packet",
    element: <ExamplePacketPage />,
  },
  {
    path: "/u/:handle",
    element: <PublicProfilePage />,
  },
  {
    path: "/u/:handle/:packetSlug",
    element: <PublicPacketPage />,
  },
  {
    path: "/p/:token",
    element: <PublicPacketPage />,
  },
  {
    path: "/onboarding",
    element: <Navigate to="/projects" replace />,
  },
  {
    path: "/security",
    element: <SecurityPage />,
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
