import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { LandingPage } from "@/pages/landing";
import { ProjectsPage } from "@/pages/projects";
import { JobsPage } from "@/pages/jobs";
import { JobDetailPage } from "@/pages/job-detail";
import { NewJobPage } from "@/pages/new-job";
import { ProtectedRoute } from "@/components/auth/protected-route";

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
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
