import { Outlet, Link, createRootRouteWithContext, HeadContent, Scripts, useRouterState } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useProfile } from "@/lib/use-profile";
import { PendingApproval } from "@/components/pending-approval";
import { NotificationBell } from "@/components/notification-bell";
import { Loader2 } from "lucide-react";

import appCss from "../styles.css?url";

interface RouterContext {
  queryClient: QueryClient;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "LabMedia — Simulador de carrossel do Instagram" },
      { name: "description", content: "Suba suas imagens e veja como ficaria o carrossel do Instagram em tempo real." },
      { property: "og:title", content: "LabMedia — Simulador de carrossel do Instagram" },
      { name: "twitter:title", content: "LabMedia — Simulador de carrossel do Instagram" },
      { property: "og:description", content: "Suba suas imagens e veja como ficaria o carrossel do Instagram em tempo real." },
      { name: "twitter:description", content: "Suba suas imagens e veja como ficaria o carrossel do Instagram em tempo real." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e1b2390e-4446-4a23-859d-4ec1e994b621/id-preview-fbafadbc--5fcf5aa0-0dc6-46c4-aadc-9bc7d74f5862.lovable.app-1777473791382.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e1b2390e-4446-4a23-859d-4ec1e994b621/id-preview-fbafadbc--5fcf5aa0-0dc6-46c4-aadc-9bc7d74f5862.lovable.app-1777473791382.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Raleway:wght@200;300;400;600;700;800;900&family=Inter:wght@200;300;400;600;700;800;900&family=Poppins:wght@200;300;400;600;700;800;900&family=Montserrat:wght@200;300;400;600;700;800;900&family=Playfair+Display:ital,wght@0,400;0,700;0,800;0,900;1,400;1,700&family=Bebas+Neue&family=Sora:wght@200;300;400;600;700;800&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,400&family=DM+Serif+Display:ital@0;1&family=Oswald:wght@200;300;400;500;600;700&family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=Merriweather:ital,wght@0,300;0,400;0,700;0,900;1,400&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Source+Serif+4:ital,wght@0,200;0,300;0,400;0,600;0,700;0,900&family=Crimson+Text:ital,wght@0,400;0,600;0,700;1,400&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppLayout />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();

  // Routes without app sidebar (auth + public viewers)
  const isPublicViewerRoute =
    pathname === "/auth" ||
    pathname.startsWith("/c/") ||
    pathname.startsWith("/r/") ||
    pathname.startsWith("/w/") ||
    pathname.startsWith("/p/");
  // Routes that anyone can access, but logged-in users still get the sidebar shell
  const isAnonAllowedRoute = pathname === "/tools/roteiros";

  if (isPublicViewerRoute) return <Outlet />;
  if (loading) return <Outlet />;
  if (!user) {
    if (isAnonAllowedRoute) return <Outlet />;
    return <Outlet />;
  }

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (profile && !profile.approved && !isAnonAllowedRoute) return <PendingApproval />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center justify-between border-b bg-background sticky top-0 z-20 px-2">
            <SidebarTrigger />
            <NotificationBell />
          </header>
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
