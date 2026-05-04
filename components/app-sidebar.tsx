"use client"

import * as React from "react"
import {
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

const DashboardIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      fill="currentColor"
      d="M15.21 2H8.75A6.76 6.76 0 0 0 2 8.75v6.5A6.76 6.76 0 0 0 8.75 22h6.5A6.76 6.76 0 0 0 22 15.25v-6.5A6.76 6.76 0 0 0 15.21 2M8.43 16.23a.8.8 0 1 1-1.6 0v-5.1a.8.8 0 0 1 1.6 0zm4.45 0a.8.8 0 1 1-1.6 0V7.78a.8.8 0 0 1 1.6 0zm4.21 0a.8.8 0 1 1-1.6 0V9.82a.8.8 0 0 1 1.6 0z"
    />
  </svg>
)

const TrainingsIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      fill="currentColor"
      d="M19 4h-1V3c0-.6-.4-1-1-1s-1 .4-1 1v1H8V3c0-.6-.4-1-1-1s-1 .4-1 1v1H5C3.3 4 2 5.3 2 7v1h20V7c0-1.7-1.3-3-3-3M2 19c0 1.7 1.3 3 3 3h14c1.7 0 3-1.3 3-3v-9H2zm15-7c.6 0 1 .4 1 1s-.4 1-1 1s-1-.4-1-1s.4-1 1-1m0 4c.6 0 1 .4 1 1s-.4 1-1 1s-1-.4-1-1s.4-1 1-1m-5-4c.6 0 1 .4 1 1s-.4 1-1 1s-1-.4-1-1s.4-1 1-1m0 4c.6 0 1 .4 1 1s-.4 1-1 1s-1-.4-1-1s.4-1 1-1m-5-4c.6 0 1 .4 1 1s-.4 1-1 1s-1-.4-1-1s.4-1 1-1m0 4c.6 0 1 .4 1 1s-.4 1-1 1s-1-.4-1-1s.4-1 1-1"
    />
  </svg>
)

const CoursesIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    {...props}
  >
    <g fill="none" fillRule="evenodd">
      <path d="m12.593 23.258l-.011.002l-.071.035l-.02.004l-.014-.004l-.071-.035q-.016-.005-.024.005l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427q-.004-.016-.017-.018m.265-.113l-.013.002l-.185.093l-.01.01l-.003.011l.018.43l.005.012l.008.007l.201.093q.019.005.029-.008l.004-.014l-.034-.614q-.005-.018-.02-.022m-.715.002a.02.02 0 0 0-.027.006l-.006.014l-.034.614q.001.018.017.024l.015-.002l.201-.093l.01-.008l.004-.011l.017-.43l-.003-.012l-.01-.01z" />
      <path
        fill="currentColor"
        d="M4 5a3 3 0 0 1 3-3h11a2 2 0 0 1 2 2v12.99c0 .168-.038.322-.113.472l-.545 1.09a1 1 0 0 0 0 .895l.543 1.088A1 1 0 0 1 19 22H7a3 3 0 0 1-3-3zm3 13h10.408a3 3 0 0 0 0 2H7a1 1 0 1 1 0-2m3-11a1 1 0 0 0 0 2h4a1 1 0 1 0 0-2z"
      />
    </g>
  </svg>
)

const menuItems = [
  {
    title: "Dashboard",
    icon: DashboardIcon,
    href: "/dashboard",
  },
  {
    title: "Trainings",
    icon: TrainingsIcon,
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
      {
        title: "Trainer Repository",
        href: "/trainer-repository",
      },
    ],
  },
  {
    title: "Courses",
    icon: CoursesIcon,
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
                    collapsed ? "max-h-0" : isDropdownOpen ? "max-h-96" : "max-h-0"
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
