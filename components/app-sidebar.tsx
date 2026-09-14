"use client"

import * as React from "react"
import {
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useTheme } from "next-themes"

function OutlineIcon({ className, children, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {children}
    </svg>
  )
}

const DashboardIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <OutlineIcon {...props}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </OutlineIcon>
)

const TrainingsIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <OutlineIcon {...props}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M3 10h18" />
  </OutlineIcon>
)

const CoursesIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <OutlineIcon {...props}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <path d="M8 7h8" />
  </OutlineIcon>
)

const CertificateManagementIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <OutlineIcon {...props}>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6" />
    <path d="M8 8h8M8 12h4" />
    <circle cx="17" cy="16" r="3" />
    <path d="M15.2 20.2 14 22l3-1.2L20 22l-1.2-1.8" />
  </OutlineIcon>
)

const CertificateTrackerIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <OutlineIcon {...props}>
    <path d="M4 4v4M4 20v-4M4 12h.01" />
    <path d="M10 6h10v12H10l-2-2 2-2V6z" />
    <path d="M12 10h7M12 14h5" />
  </OutlineIcon>
)

const CertificateVerifierIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <OutlineIcon {...props}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" />
    <path d="M14 3v5h5" />
    <path d="M15 16.5 16.5 18 20 14.5" />
  </OutlineIcon>
)

const VoucherManagerIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <OutlineIcon {...props}>
    <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" />
    <path d="M9 9.5 15 15.5M9 12.2h.01M15 14.8h.01" />
  </OutlineIcon>
)

const EventManagementIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <OutlineIcon {...props}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M3 10h18M14 14h5v5h-5z" />
  </OutlineIcon>
)

const DirectoryIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <OutlineIcon {...props}>
    <path d="M3 7.5A2 2 0 0 1 5 5.5h4l2 2h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M12 12h6" />
  </OutlineIcon>
)

const PeopleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <OutlineIcon {...props}>
    <circle cx="9" cy="8" r="3" />
    <circle cx="17" cy="9" r="2.25" />
    <path d="M3.5 19c.6-2.6 2.8-4 5.5-4s4.9 1.4 5.5 4" />
    <path d="M15 15.2c1.4-.4 2.8-.2 4 .8" />
  </OutlineIcon>
)

const ReportsIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <OutlineIcon {...props}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M8 13h8M8 17h5" />
  </OutlineIcon>
)

const SunIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <OutlineIcon {...props}>
    <circle cx="12" cy="12" r="3.5" />
    <path d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </OutlineIcon>
)

const MoonIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <OutlineIcon {...props}>
    <path d="M16.5 14.5A6.5 6.5 0 0 1 9.5 7.5 6.5 6.5 0 1 0 16.5 14.5z" />
  </OutlineIcon>
)

const EmailStatusIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <OutlineIcon {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m4 7 8 6 8-6" />
  </OutlineIcon>
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
        icon: TrainingsIcon,
      },
      {
        title: "Calendar",
        href: "/training-calendar",
        icon: EventManagementIcon,
      },
      {
        title: "Training Reports",
        href: "training-reports",
        icon: ReportsIcon,
      },
      {
        title: "Directory of Trainees",
        href: "/directory-of-trainees",
        icon: DirectoryIcon,
      },
      {
        title: "Trainer Repository",
        href: "/trainer-repository",
        icon: PeopleIcon,
      },
      {
        title: "Facilitator Materials",
        href: "/training-facilitator",
        icon: PeopleIcon,
      },
    ],
  },
  {
    title: "Courses",
    icon: CoursesIcon,
    href: "/courses",
  },
  {
    title: "Certificates & IDs",
    icon: CertificateManagementIcon,
    children: [
      {
        title: "Certs & ID Management",
        href: "/certificate-id-management",
        icon: CertificateManagementIcon,
      },
      {
        title: "Certificate Tracker",
        href: "/cert-tracker",
        icon: CertificateTrackerIcon,
      },
      {
        title: "Certificate Verifier",
        href: "/certificate-verifier",
        icon: CertificateVerifierIcon,
      },
    ],
  },
  {
    type: "separator",
    title: "Voucher Manager",
  },
  {
    title: "Voucher Manager",
    icon: VoucherManagerIcon,
    href: "/voucher-manager",
  },
  {
    type: "separator",
    title: "Admin",
  },
  {
    title: "Email Status",
    icon: EmailStatusIcon,
    href: "/admin/email-status",
  },

  // 🌟 Separator
  {
    type: "separator",
    title: "External",
  },

  {
    title: "Event Management",
    icon: EventManagementIcon,
    href: "https://ems.petros-global.com/",
  },
]

export function AppSidebar() {
  const [collapsed, setCollapsed] = React.useState(false)
  const [openDropdown, setOpenDropdown] = React.useState<string | null>("Trainings")
  const [flyout, setFlyout] = React.useState<string | null>(null)
  const [mounted, setMounted] = React.useState(false)
  const { resolvedTheme, setTheme } = useTheme()

  const pathname = usePathname()
  const isDark = mounted && resolvedTheme === "dark"

  React.useEffect(() => {
    setMounted(true)
    const saved = window.localStorage.getItem("tms-sidebar-collapsed")
    if (saved === "1") setCollapsed(true)

    const onChange = (event: Event) => {
      const next = (event as CustomEvent<boolean>).detail
      setCollapsed(next)
      if (next) setFlyout(null)
    }
    window.addEventListener("tms-sidebar-collapsed", onChange)
    return () => window.removeEventListener("tms-sidebar-collapsed", onChange)
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      window.localStorage.setItem("tms-sidebar-collapsed", next ? "1" : "0")
      window.dispatchEvent(new CustomEvent("tms-sidebar-collapsed", { detail: next }))
      if (next) setFlyout(null)
      return next
    })
  }

  const handleDropdownToggle = (title: string) => {
    setOpenDropdown((prev) => (prev === title ? null : title))
  }

  return (
    <div
      className={cn(
        "relative z-50 flex h-screen shrink-0 flex-col border-r transition-all duration-300 ease-in-out",
        "bg-[#f4f5f8] text-[#3c3e4a] border-[#e6e7ee]",
        "dark:bg-[#1b1d26] dark:text-[#d7d8e0] dark:border-[#2a2c36]",
        collapsed ? "w-[4.5rem]" : "w-64"
      )}
    >
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute -right-3.5 top-4 z-[60] flex h-7 w-7 items-center justify-center rounded-full border border-[#e6e7ee] bg-white text-[#5c5e6c] shadow-md hover:bg-[#f3f4f8]"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
      <div className={cn("relative flex items-center px-3 pt-4 pb-3", collapsed ? "justify-center" : "gap-3")}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-black/5 dark:bg-white">
          <img src="/logo.png" alt="Petrosphere" className="h-7 w-7 object-contain" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#1c1e28] dark:text-white">Training</p>
            <p className="truncate text-[11px] text-[#7b7d8c] dark:text-[#9b9dad]">Management System</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
        {menuItems.map((item) => {
          const Icon = item.icon

          // 🌟 Render separator
          if (item.type === "separator") {
            if (collapsed) return null
            return (
              <div
                key={item.title}
                className="px-3 pb-1 pt-4 text-[11px] font-medium tracking-wide text-[#8a8c9a] dark:text-[#8d8f9e]"
              >
                {item.title}
              </div>
            )
          }

          const isActive =
            item.href === pathname ||
            item.children?.some((child) => child.href === pathname)

          const isDropdownOpen = openDropdown === item.title
          const itemClass = cn(
            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
            isActive
              ? "bg-[#e7e9f0] text-[#1c1e28] dark:bg-[#2c2f3a] dark:text-white"
              : "text-[#4a4d5c] hover:bg-[#e7e9f0] hover:text-[#1c1e28] dark:text-[#c8c9d4] dark:hover:bg-[#2c2f3a] dark:hover:text-white",
            collapsed && "justify-center px-0"
          )

          if (item.children) {
            return (
              <div
                key={item.title}
                className="relative"
                onMouseEnter={() => collapsed && setFlyout(item.title)}
                onMouseLeave={() => collapsed && setFlyout(null)}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (collapsed) setFlyout((prev) => (prev === item.title ? null : item.title))
                    else handleDropdownToggle(item.title)
                  }}
                  className={itemClass}
                >
                  {Icon && <Icon className="h-[18px] w-[18px] shrink-0" />}
                  {!collapsed && <span className="flex-1 truncate text-left">{item.title}</span>}
                  {!collapsed && (
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 shrink-0 text-[#8a8c9a] transition-transform",
                        isDropdownOpen ? "rotate-90" : "rotate-0"
                      )}
                    />
                  )}
                </button>

                {!collapsed && (
                  <div
                    className={cn(
                      "grid transition-[grid-template-rows] duration-200 ease-out",
                      isDropdownOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="ml-5 mt-1 space-y-0.5 border-l border-[#d7d9e2] py-1 pl-3 dark:border-[#3a3d4a]">
                        {item.children.map((sub) => {
                          const isSubActive = pathname === sub.href
                          return (
                            <Link
                              key={sub.href}
                              href={sub.href}
                              className={cn(
                                "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                                isSubActive
                                  ? "bg-[#e7e9f0] font-medium text-[#1c1e28] dark:bg-[#2c2f3a] dark:text-white"
                                  : "text-[#6b6e7c] hover:bg-[#e7e9f0] hover:text-[#1c1e28] dark:text-[#b7b9c6] dark:hover:bg-[#2c2f3a] dark:hover:text-white"
                              )}
                            >
                              <span className="truncate">{sub.title}</span>
                              {isSubActive && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {collapsed && flyout === item.title && (
                  <div className="absolute left-full top-0 z-30 ml-3 w-52 rounded-xl border border-[#e6e7ee] bg-white p-1.5 shadow-xl dark:border-[#3a3d4a] dark:bg-[#242733]">
                    <p className="px-2 py-1.5 text-xs font-medium text-[#8a8c9a] dark:text-[#9b9dad]">{item.title}</p>
                    {item.children.map((sub) => {
                      const isSubActive = pathname === sub.href
                      return (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          className={cn(
                            "flex items-center justify-between rounded-lg px-2.5 py-2 text-sm",
                            isSubActive
                              ? "bg-[#e7e9f0] font-medium text-[#1c1e28] dark:bg-[#2c2f3a] dark:text-white"
                              : "text-[#4a4d5c] hover:bg-[#f1f2f6] dark:text-[#d7d8e0] dark:hover:bg-[#2c2f3a]"
                          )}
                        >
                          <span className="truncate">{sub.title}</span>
                          {isSubActive && <ChevronRight className="h-3.5 w-3.5" />}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          if (!item.href) return null

          return (
            <div
              key={item.href}
              className="relative"
              onMouseEnter={() => collapsed && setFlyout(item.title)}
              onMouseLeave={() => collapsed && setFlyout(null)}
            >
              <Link
                href={item.href}
                {...(item.title === "Event Management"
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
                className={itemClass}
              >
                {Icon && <Icon className="h-[18px] w-[18px] shrink-0" />}
                {!collapsed && <span className="truncate">{item.title}</span>}
              </Link>
              {collapsed && flyout === item.title && (
                <div className="pointer-events-none absolute left-full top-1/2 z-30 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg border border-[#e6e7ee] bg-white px-2.5 py-1.5 text-xs font-medium text-[#1c1e28] shadow-lg dark:border-[#3a3d4a] dark:bg-[#242733] dark:text-white">
                  {item.title}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      <div className="p-3">
        <div
          className={cn(
            "flex items-center rounded-full bg-[#e7e9f0] p-1 dark:bg-[#121318]",
            collapsed ? "flex-col gap-1" : "gap-1"
          )}
        >
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-medium transition-colors",
              !isDark
                ? "bg-white text-[#1c1e28] shadow-sm"
                : "text-[#8a8c9a] hover:text-white"
            )}
          >
            <SunIcon className="h-3.5 w-3.5" />
            {!collapsed && "Light"}
          </button>
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-medium transition-colors",
              isDark
                ? "bg-[#2c2f3a] text-white"
                : "text-[#6b6e7c] hover:text-[#1c1e28]"
            )}
          >
            <MoonIcon className="h-3.5 w-3.5" />
            {!collapsed && "Dark"}
          </button>
        </div>
      </div>
    </div>
  )
}
