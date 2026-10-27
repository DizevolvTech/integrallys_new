'use client'

import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  ArrowLeftRight,
  BarChart2,
  BarChart3,
  Box,
  Boxes,
  Building,
  Building2,
  Calendar,
  CheckSquare,
  Clock,
  CreditCard,
  DollarSign,
  FileCheck,
  RotateCcw,
  FileText,
  History,
  Home,
  LayoutDashboard,
  MessageSquare,
  Package,
  Pill,
  Search,
  Settings,
  Shield,
  ShoppingCart,
  Stethoscope,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  X,
  ClipboardList,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SidebarItem } from '@/types/auth'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  items: SidebarItem[]
}

const ICON_MAP: Record<string, LucideIcon> = {
  Home,
  Calendar,
  Users,
  Shield,
  Building,
  FileText,
  CreditCard,
  History,
  Settings,
  CheckSquare,
  LayoutDashboard,
  MessageSquare,
  Search,
  Clock,
  ShoppingCart,
  Package,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  BarChart2,
  Wallet,
  Stethoscope,
  Pill,
  ClipboardList,
  Box,
  Boxes,
  BarChart3,
  Activity,
  Building2,
  FileCheck,
  RotateCcw,
}

export function Sidebar({ isOpen, onClose, items }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const currentPath = pathname ?? '/'
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  const flattenItems = (entryList: SidebarItem[]) =>
    entryList.flatMap((item) => (item.type === 'group' ? item.children ?? [] : item))

  const activeHref = flattenItems(items)
    .filter((item) => item.href)
    .map((item) => item.href as string)
    .filter((href) => currentPath === href || (href !== '/' && href !== '/portal' && currentPath.startsWith(`${href}/`)))
    .sort((a, b) => b.length - a.length)[0]
  const activeItemId = flattenItems(items).find((item) => item.href === activeHref)?.id

  return (
    <>
      {/* Overlay mobile não é renderizado aqui — `ShellLayout` é o único
          consumidor de `<Sidebar>` (verificado em busca global) e provê o
          overlay com fade. Deduplicado via TAREFA-CR-UI-02. */}
      <aside
        className={`
        fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col transition-all duration-300 ease-in-out
        bg-white dark:bg-app-bg-dark
        border-r border-app-border dark:border-app-border-dark
        lg:relative lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-app-border px-6 dark:border-app-border-dark">
          <div className="flex items-center">
            <Image src="/images/Integrallys-Logo.png" alt="Integrallys" width={120} height={32} className="h-8 w-auto" />
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="relative flex items-center justify-center text-app-text-secondary hover:bg-app-bg-secondary dark:text-white/60 dark:hover:bg-app-hover lg:hidden"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="custom-scrollbar flex-1 overflow-y-auto p-4">
          <ul className="space-y-1">
            {items.map((item, index) => {
              const Icon = ICON_MAP[item.icon] ?? Home
              const isActive = item.href ? item.id === activeItemId : currentPath === `/${item.id}`
              const isCategory = item.type === 'category'
              const isGroup = item.type === 'group'

              if (isCategory) {
                return (
                  <li key={item.id} className={index > 0 ? 'pt-5' : ''}>
                    <div className="px-3 pb-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-app-text-muted/80 dark:text-white/40">
                        {item.label}
                      </span>
                    </div>
                  </li>
                )
              }

              if (isGroup) {
                const childItems = item.children ?? []
                const hasActiveChild = childItems.some((child) => child.id === activeItemId)
                const isOpen = expandedGroups[item.id] ?? hasActiveChild

                return (
                  <li key={item.id} className="space-y-1">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedGroups((current) => ({
                          ...current,
                          [item.id]: !isOpen,
                        }))
                      }
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-all duration-200 ${
                        hasActiveChild
                          ? 'bg-app-bg-secondary text-app-text-primary dark:bg-app-hover dark:text-white'
                          : 'text-app-text-secondary hover:bg-app-bg-secondary hover:text-app-text-primary dark:text-white/60 dark:hover:bg-app-hover dark:hover:text-white'
                      }`}
                    >
                      <span className="flex items-center space-x-3">
                        <Icon className={`h-5 w-5 shrink-0 ${hasActiveChild ? 'text-app-primary dark:text-white' : 'text-app-text-secondary dark:text-white/60'}`} />
                        <span className="text-sm font-normal">{item.label}</span>
                      </span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isOpen && (
                      <ul className="ml-[19px] space-y-0.5 border-l border-app-border/60 pl-3 dark:border-app-border-dark">
                        {childItems.map((child) => {
                          const childActive = child.id === activeItemId

                          return (
                            <li key={child.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  router.push(child.href ?? `/${child.id}`)
                                  if (window.innerWidth < 1024) {
                                    onClose()
                                  }
                                }}
                                className={`w-full px-3 py-2 rounded-lg text-left text-sm font-normal transition-all duration-200 ${
                                  childActive
                                    ? 'bg-app-primary/10 text-app-primary dark:bg-white/10 dark:text-white'
                                    : 'text-app-text-secondary hover:bg-app-bg-secondary hover:text-app-text-primary dark:text-white/60 dark:hover:bg-app-hover dark:hover:text-white'
                                }`}
                              >
                                {child.label}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </li>
                )
              }

              return (
                <li key={item.id}>
                  <button
                    onClick={() => {
                      router.push(item.href ?? `/${item.id}`)
                      if (window.innerWidth < 1024) {
                        onClose()
                      }
                    }}
                    className={`
                      w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg
                      text-left transition-all duration-200 group
                      ${
                        isActive
                          ? 'bg-app-primary text-white shadow-md shadow-[var(--app-primary)]/20'
                          : 'text-app-text-secondary hover:bg-app-bg-secondary hover:text-app-text-primary dark:text-white/60 dark:hover:bg-app-hover dark:hover:text-white'
                      }
                    `}
                  >
                    <Icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-white' : 'text-app-text-secondary dark:text-white/60'}`} />
                    <span className="text-sm font-normal">{item.label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

      </aside>
    </>
  )
}
