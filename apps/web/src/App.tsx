import { createBrowserRouter, RouterProvider } from "react-router-dom";
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
    path: "/users/:handle",
    element: <PublicProfilePage />,
  },
  {
    path: "/users/:handle/:packetSlug",
    element: <PublicPacketPage />,
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
