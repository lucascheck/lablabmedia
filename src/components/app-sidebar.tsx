import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Instagram, Wand2, LogOut, MessageCircle, Flame, Newspaper, FileImage, Quote, Shield, LayoutTemplate, FileEdit, FolderOpen, Copy, KanbanSquare, SplitSquareVertical, Sparkles } from "lucide-react";
import { useProfile } from "@/lib/use-profile";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

const mainItems = [{ title: "Início", url: "/", icon: Home }];

const toolGroups = [
  {
    label: "Carrossel",
    items: [
      { title: "Carrossel Creator", url: "/tools/carousel-creator", icon: Wand2 },
      { title: "Carrossel Creator IA", url: "/tools/carousel-creator-ia", icon: Sparkles },
      { title: "Carrossel Creator 2", url: "/tools/carousel-creator-2", icon: SplitSquareVertical },
      { title: "Carrossel Preview", url: "/tools/carousel-preview", icon: Instagram },
    ],
  },
  {
    label: "Posts & Impressões",
    items: [
      { title: "Print WhatsApp", url: "/tools/whatsapp-print", icon: MessageCircle },
      { title: "Print Viral", url: "/tools/print-viral", icon: Flame },
      { title: "Post Notícia", url: "/tools/post-noticia", icon: Newspaper },
      { title: "Post Simples", url: "/tools/post-simples", icon: FileImage },
      { title: "Post Frase", url: "/tools/post-frase", icon: Quote },
    ],
  },
  {
    label: "Planejamento",
    items: [
      { title: "Roteiros", url: "/tools/roteiros", icon: FileEdit },
      { title: "Copy's Títulos Vídeos", url: "/tools/copy-titulos-videos", icon: Copy },
      { title: "Tarefas", url: "/tools/tarefas", icon: KanbanSquare },
    ],
  },
  {
    label: "Utilitários",
    items: [
      { title: "Wireframe", url: "/tools/wireframe", icon: LayoutTemplate },
      { title: "Google Drive", url: "/tools/google-drive", icon: FolderOpen },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut } = useAuth();
  const { profile } = useProfile();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/" className="flex items-center gap-2 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-starbucks to-brand-accent flex items-center justify-center flex-shrink-0">
            <Instagram className="h-4 w-4 text-white" />
          </div>
          {!collapsed && <span className="font-semibold text-sm tracking-[-0.01em] truncate">LabMedia</span>}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Geral</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => {
                const active = pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {toolGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = pathname === item.url || pathname.startsWith(`${item.url}/`);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                        <Link to={item.url} className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          {!collapsed && <span>{item.title}</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {profile?.isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administração</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith("/admin")} tooltip="Admin">
                    <Link to="/admin" className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      {!collapsed && <span>Admin</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {user && (
        <SidebarFooter>
          {!collapsed && (
            <div className="px-2 text-xs text-muted-foreground truncate">{user.email}</div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut()}
            className="justify-start rounded-md"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="ml-2">Sair</span>}
          </Button>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
