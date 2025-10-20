"use client"

import * as React from "react"
import {
  LayoutDashboard,
  Calendar,
  BookOpen,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const menuItems = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    href: "/",
  },
  {
    title: "Trainings",
    icon: Calendar,
    children: [
      {
        title: "Schedules",
        href: "/training-schedules",
      },
      {
        title: "Calendar",
        href: "/training-calendar",
      },
    ],
  },
  {
    title: "Courses",
    icon: BookOpen,
    href: "/courses",
  },
  {
    title: "Submissions",
    icon: FileText,
    href: "/submissions",
  },
]

export function AppSidebar() {
  const [collapsed, setCollapsed] = React.useState(false)
  const [openDropdown, setOpenDropdown] = React.useState<string | null>(null)
  const pathname = usePathname()

  const handleDropdownToggle = (title: string) => {
    setOpenDropdown((prev) => (prev === title ? null : title))
  }

  return (
    <div
      className={cn(
        "relative flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-sidebar-border px-4">
        {!collapsed && <h1 className="text-lg font-semibold text-sidebar-foreground">Petrosphere Training Manager</h1>}
        {collapsed && (
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
            T
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive =
            item.href === pathname || item.children?.some((child) => child.href === pathname)
          const isDropdownOpen = openDropdown === item.title

          // Item with submenu
          if (item.children) {
            return (
              <div key={item.title} className="space-y-1">
                <button
                  onClick={() => handleDropdownToggle(item.title)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    collapsed && "justify-center"
                  )}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-5 w-5 shrink-0" />
                    {!collapsed && <span>{item.title}</span>}
                  </span>
                  {!collapsed && <ChevronDown className="h-4 w-4 ml-auto" />}
                </button>

                {!collapsed && isDropdownOpen && (
                  <div className="ml-7 mt-1 space-y-1 rounded-md border border-border bg-muted p-1">
                    {item.children.map((sub) => {
                      const isSubActive = pathname === sub.href
                      return (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          className={cn(
                            "block rounded px-2 py-1 text-sm font-medium transition-colors",
                            isSubActive
                              ? "bg-sidebar-primary text-white"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent"
                          )}
                        >
                          {sub.title}
                        </Link>

                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          // Regular menu item
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                ? "bg-sidebar-primary text-white"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                collapsed && "justify-center"
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0", isActive && "text")} />
              {!collapsed && <span>{item.title}</span>}
            </Link>

          )
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn("w-full", collapsed && "justify-center")}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-2" />
              <span>Collapse</span>
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
