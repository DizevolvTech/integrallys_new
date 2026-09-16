"use client";

import { useRouter } from "next/navigation";
import {
  Bell,
  Building2,
  ChevronDown,
  LogOut,
  Menu,
  Moon,
  Sun,
  UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDarkMode } from "@/hooks/use-dark-mode";
import type { AuthUser } from "@/types/auth";

interface HeaderProps {
  user: AuthUser | null;
  settingsHref?: string;
  toggleSidebar: () => void;
  unreadNotifications: number;
  onNotificationsClick: () => void;
  onLogout: () => void;
}

export function Header({
  user,
  settingsHref = "/configuracoes",
  toggleSidebar,
  unreadNotifications,
  onNotificationsClick,
  onLogout,
}: HeaderProps) {
  const router = useRouter();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const initials = user?.name
    ?.split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-app-border bg-app-card/95 px-4 backdrop-blur-md transition-all duration-300 dark:border-app-border-dark dark:bg-app-card-dark/95 lg:px-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={toggleSidebar}
          className="-ml-1 rounded-xl p-2 text-app-text-secondary transition-colors hover:bg-app-bg-secondary dark:text-white/60 dark:hover:bg-app-hover lg:hidden"
          aria-label="Abrir menu"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      <div className="flex items-center gap-1 sm:gap-3">
        {user?.unidadeNome && (
          <span
            className="hidden md:flex items-center gap-1.5 rounded-lg border border-app-border px-2 py-1 text-xs text-app-text-secondary dark:border-app-border-dark dark:text-white/60"
            title="Unidade ativa"
          >
            <Building2 className="h-3 w-3" />
            {user.unidadeNome}
          </span>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={onNotificationsClick}
          className="relative flex h-10 w-10 items-center justify-center rounded-xl text-app-text-secondary transition-colors hover:bg-app-bg-secondary dark:text-white/60 dark:hover:bg-app-hover"
          title="Notificações"
        >
          <Bell className="h-[22px] w-[22px]" />
          {unreadNotifications > 0 && (
            <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full border-2 border-app-card bg-[var(--app-danger-text)] dark:border-app-card-dark" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleDarkMode}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-app-text-secondary transition-colors hover:bg-app-bg-secondary dark:text-white/60 dark:hover:bg-app-hover"
          title={isDarkMode ? "Ativar Modo Claro" : "Ativar Modo Escuro"}
        >
          {isDarkMode ? (
            <Sun className="h-[22px] w-[22px]" />
          ) : (
            <Moon className="h-[22px] w-[22px]" />
          )}
        </Button>

        <div className="mx-1 hidden h-6 w-px bg-app-border dark:bg-app-border-darkStrong sm:block" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="group flex cursor-pointer items-center gap-3 rounded-xl p-1 outline-none transition-all hover:bg-app-bg-secondary dark:hover:bg-app-hover">
              {user?.avatarUrl ? (
                <div className="h-9 w-9 overflow-hidden rounded-full border border-app-border shadow-sm dark:border-app-border-dark">
                  <img
                    src={user.avatarUrl}
                    alt={user.name ?? "Usuário"}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-app-primary text-white shadow-sm">
                  <span className="text-xs font-bold">{initials ?? "US"}</span>
                </div>
              )}

              <div className="mr-1 hidden text-left text-sm md:block">
                <p className="font-semibold leading-tight text-app-text-primary dark:text-white">
                  {user?.name ?? "Usuário"}
                </p>
                <p className="text-xs font-medium text-app-text-secondary dark:text-white/60">
                  {user?.role ?? "-"}
                </p>
              </div>

              <ChevronDown className="h-4 w-4 text-app-text-secondary transition-colors group-hover:text-app-text-primary dark:text-white/60 dark:group-hover:text-white" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            className="mt-2 w-52 border-app-border bg-app-card p-2 shadow-xl dark:border-app-border-dark dark:bg-app-card-dark"
          >
            <DropdownMenuItem
              onClick={() => router.push(settingsHref)}
              className="cursor-pointer gap-2 rounded-lg py-2.5 text-app-text-primary dark:text-white"
            >
              <UserCog className="h-4 w-4 text-app-text-secondary dark:text-white/60" />
              <span className="font-medium">Configurações</span>
            </DropdownMenuItem>
            <div className="my-1 border-t border-app-border dark:border-app-border-dark" />
            <DropdownMenuItem
              onClick={onLogout}
              className="cursor-pointer gap-2 rounded-lg py-2.5 text-[var(--app-danger-text)] focus:bg-app-danger-bg/60 dark:text-[var(--app-danger-text)] dark:focus:bg-app-danger-bg/60"
            >
              <LogOut className="h-4 w-4" />
              <span className="font-medium">Sair do sistema</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
