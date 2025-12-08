"use client"

import { Bell, User, LogOut, Settings, Shield, Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"

interface TopBarProps {
  userRole: "admin" | "user"
  setUserRole: (role: "admin" | "user") => void
  darkMode: boolean
  setDarkMode: (darkMode: boolean) => void
}

export function TopBar({ userRole, setUserRole, darkMode, setDarkMode }: TopBarProps) {
  // Placeholder function for logout
  const handleLogout = () => {
    console.log("Logout clicked")
  }

  return (
    <header className="relative z-10 flex h-16 items-center justify-between border-b border-border bg-card/80 backdrop-blur-xl px-6">
      <div className="flex items-center gap-4">
        <h2 className="bg-gradient-to-r from-primary to-accent bg-clip-text text-xl font-semibold text-transparent">
          Dashboard
        </h2>
        <Badge variant={userRole === "admin" ? "default" : "secondary"} className="gap-1">
          {userRole === "admin" && <Shield className="h-3 w-3" />}
          {userRole === "admin" ? "Admin" : "User"}
        </Badge>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setDarkMode(!darkMode)} className="hover:bg-primary/10">
          {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        <Button variant="ghost" size="icon" className="relative hover:bg-primary/10">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1 top-1 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/10">
              <User className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">John Doe</p>
                <p className="text-xs text-muted-foreground">olakintunde@ecobank.com</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setUserRole(userRole === "admin" ? "user" : "admin")}>
              <Shield className="mr-2 h-4 w-4" />
              Switch to {userRole === "admin" ? "User" : "Admin"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
