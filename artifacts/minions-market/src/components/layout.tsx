import { useLocation, Link } from "wouter";
import { Home, Search, PlusCircle, MessageCircle, User } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { useGetChats, getGetChatsQueryKey } from "@workspace/api-client-react";
import type { ReactNode } from "react";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { isAuthenticated } = useAuth();
  const { t } = useLang();

  const { data: chats } = useGetChats({ query: { enabled: isAuthenticated, queryKey: getGetChatsQueryKey() } });
  const unreadTotal = chats?.reduce((sum, c) => sum + (c.unreadCount || 0), 0) || 0;

  const isActive = (path: string) => location === path || location.startsWith(path + "/");

  const navItems = [
    { path: "/", icon: Home, label: t("home"), exact: true },
    { path: "/catalog", icon: Search, label: t("catalog") },
    { path: "/sell", icon: PlusCircle, label: t("sell") },
    { path: "/messages", icon: MessageCircle, label: t("messages"), badge: unreadTotal },
    { path: "/profile", icon: User, label: t("profile") },
  ];

  const hideNav = location === "/auth";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 pb-16 max-w-lg mx-auto w-full">
        {children}
      </main>
      {!hideNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-border/50" data-testid="bottom-nav">
          <div className="max-w-lg mx-auto flex items-center justify-around h-14 px-2">
            {navItems.map((item) => {
              const active = item.exact ? location === item.path : isActive(item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors relative ${
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`nav-${item.path.replace("/", "") || "home"}`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                  {item.badge && item.badge > 0 ? (
                    <span className="absolute -top-0.5 right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] flex items-center justify-center font-bold">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
