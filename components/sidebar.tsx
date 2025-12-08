"use client"

import { useState } from "react"
import {
  FileSpreadsheet,
  Settings,
  Shield,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FileBarChart,
  Calculator,
  FileCheck,
  AlertTriangle,
  PhoneCall,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface SidebarProps {
  activeModule: string
  setActiveModule: (module: string) => void
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
  userRole: "admin" | "user"
}

// 🧠 All user modules (including new Smart Call Over)
const modules = [
  {
    id: "smart-reconciliation",
    name: "Smart Reconciliation",
    icon: FileSpreadsheet,
  },
  {
    id: "weekly-reports-collation",
    name: "Weekly Reports Collation",
    icon: FileBarChart,
  },
  {
    id: "smart-teller-calculator",
    name: "Smart Teller Calculator",
    icon: Calculator,
  },
  {
    id: "smart-call-over",
    name: "Smart Call Over",
    icon: PhoneCall, // ✅ Added
  },
  {
    id: "consolidated-proof",
    name: "Consolidated Proof",
    icon: FileCheck,
  },
  {
    id: "teller-proof",
    name: "Teller Proof",
    icon: AlertTriangle,
  },
]

// ⚙️ Admin-only modules
const adminModules = [
  {
    id: "system-settings",
    name: "System Settings",
    icon: Settings,
  },
  {
    id: "admin-management",
    name: "Admin Management",
    icon: Shield,
  },
]

export function Sidebar({
  activeModule,
  setActiveModule,
  collapsed,
  setCollapsed,
  userRole,
}: SidebarProps) {
  const [expandedMenus, setExpandedMenus] = useState<string[]>(["smart-reconciliation"])

  const toggleMenu = (menuId: string) => {
    setExpandedMenus((prev) =>
      prev.includes(menuId) ? prev.filter((id) => id !== menuId) : [...prev, menuId],
    )
  }

  return (
    <aside
      className={cn(
        "relative z-20 flex flex-col border-r border-sidebar-border bg-sidebar/95 backdrop-blur-xl transition-all duration-300",
        collapsed ? "w-16" : "w-72",
      )}
    >
      {/* Sidebar Header */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        {!collapsed && <h1 className="text-lg font-bold text-sidebar-foreground">Bank Smart Systems</h1>}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {modules.map((module) => {
          const Icon = module.icon
          const isActive = activeModule === module.id

          return (
            <button
              key={module.id}
              onClick={() => setActiveModule(module.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-lg shadow-primary/20"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
              title={collapsed ? module.name : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="flex-1 text-left">{module.name}</span>}
            </button>
          )
        })}

        {/* Admin Modules */}
        {userRole === "admin" && (
          <>
            <div className="my-4 border-t border-sidebar-border" />
            {!collapsed && (
              <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Admin Only
              </div>
            )}
            {adminModules.map((module) => {
              const Icon = module.icon
              const isActive = activeModule === module.id

              return (
                <button
                  key={module.id}
                  onClick={() => setActiveModule(module.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-lg shadow-primary/20"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                  title={collapsed ? module.name : undefined}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span>{module.name}</span>}
                </button>
              )
            })}
          </>
        )}
      </nav>
    </aside>
  )
}
