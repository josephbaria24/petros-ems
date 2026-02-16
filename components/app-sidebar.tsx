"use client"

import * as React from "react"
import {
  LayoutDashboard,
  Calendar,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CalendarCheckIcon,
  LucideAward,
  MapPin,
  BadgePercent,
  ShieldCheck,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const menuItems = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
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
      {
        title: "Training Reports",
        href: "training-reports",
      },
      {
        title: "Directory of Trainees",
        href: "/directory-of-trainees",
      },
    ],
  },
  {
    title: "Courses",
    icon: BookOpen,
    href: "/courses",
  },
  {
    type: "separator",
    title: "Certificates & IDs",
  },


  {
    title: "Certs & ID Management",
    icon: LucideAward,
    href: "/certificate-id-management",
  },
  {
    title: "Certificate Tracker",
    icon: MapPin,
    href: "/cert-tracker",
  },
  {
    title: "Certificate Verifier",
    icon: ShieldCheck,
    href: "/certificate-verifier",
  },
  {
    type: "separator",
    title: "Voucher Manager",
  },
  {
    title: "Voucher Manager",
    icon: BadgePercent,
    href: "/voucher-manager",
  },

  // 🌟 Separator
  {
    type: "separator",
    title: "External",
  },

  {
    title: "Event Management",
    icon: CalendarCheckIcon,
    href: "https://ems.petros-global.com/",
  },
]

export function AppSidebar() {
  const [collapsed, setCollapsed] = React.useState(false)
  const [openDropdown, setOpenDropdown] = React.useState<string | null>("Trainings")

  const pathname = usePathname()

  const handleDropdownToggle = (title: string) => {
    setOpenDropdown((prev) => (prev === title ? null : title))
  }

  return (
    <div
      className={cn(
        "relative flex h-screen flex-col border-0 shadow-lg bg-background dark:bg-card transition-all duration-300 ease-in-out",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      {/* <div className="flex h-16 items-center px-4">
        {!collapsed ? (
          <>
            
            <img
              src="/trans-logo-dark.png"
              alt="Petrosphere Training Manager"
              className="h-8 w-auto dark:hidden"
            />

       
            <img
              src="/trans-logo.png" 
              alt="Petrosphere Training Manager"
              className="h-8 w-auto hidden dark:block"
            />
          </>
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-950">
            <img src="/logo.png" alt="P" className="h-6" />
          </div>
        )}
      </div> */}

      {/* Header / Logo */}
      <div className="p-4 flex flex-col items-center">
        {collapsed ? (
          <span className="font-bold text-xl">TMS</span>
        ) : (
          <>
            <span className="font-bold text-2xl">Training</span>
            <span className="font-light text-sm">Management System</span>
          </>
        )}
      </div>


      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon

          // 🌟 Render separator
          if (item.type === "separator") {
            return (
              <div
                key={item.title}
                className={cn(
                  "px-3 mt-4 mb-2 text-xs font-semibold text-muted-foreground",
                  collapsed && "hidden"
                )}
              >
                {item.title}
                <div className="mt-2 h-px bg-muted"></div>
              </div>
            )
          }

          const isActive =
            item.href === pathname ||
            item.children?.some((child) => child.href === pathname)

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
                    {Icon && <Icon className="h-5 w-5" />}
                    {!collapsed && item.title}
                  </span>

                  {!collapsed && (
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 ml-auto transition-transform",
                        isDropdownOpen ? "rotate-90" : "rotate-0"
                      )}
                    />
                  )}
                </button>

                {/* Dropdown */}
                <div
                  className={cn(
                    "overflow-hidden transition-all ml-6",
                    collapsed ? "max-h-0" : isDropdownOpen ? "max-h-40" : "max-h-0"
                  )}
                >
                  <div className="mt-1 space-y-1 rounded-md border border-border bg-muted p-1">
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
                </div>
              </div>
            )
          }

          // Regular link
          if (!item.href) return null

          return (
            <Link
              key={item.href}
              href={item.href}
              {...(item.title === "Event Management"
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-primary text-white"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                collapsed && "justify-center"
              )}
            >
              {Icon && <Icon className="h-5 w-5" />}
              {!collapsed && item.title}
            </Link>
          )
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center cursor-pointer"
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
