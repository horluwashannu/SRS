"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Sparkles, TrendingUp, Shield, Zap } from "lucide-react"

export function WelcomeModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // Show welcome modal on first visit
    const hasVisited = localStorage.getItem("hasVisited")
    if (!hasVisited) {
      setTimeout(() => setOpen(true), 500)
      localStorage.setItem("hasVisited", "true")
    }
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className="h-6 w-6 text-primary" />
            Welcome to Smart Reconciliation System
          </DialogTitle>
          <DialogDescription className="space-y-4 pt-4">
            <p className="text-base">Your all-in-one solution for financial reconciliation and teller management.</p>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold">Smart Reconciliation</h4>
                  <p className="text-sm text-muted-foreground">Automated matching and error detection</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-accent/10 p-2">
                  <Zap className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h4 className="font-semibold">Teller Tools</h4>
                  <p className="text-sm text-muted-foreground">Calculator, proof checking, and reports</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-chart-3/10 p-2">
                  <Shield className="h-5 w-5 text-chart-3" />
                </div>
                <div>
                  <h4 className="font-semibold">Role-Based Access</h4>
                  <p className="text-sm text-muted-foreground">Secure admin and user permissions</p>
                </div>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-4">
          <Button onClick={() => setOpen(false)} className="bg-gradient-to-r from-primary to-accent">
            Get Started
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
