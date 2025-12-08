import { Settings, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

export function SystemSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">System Settings</h1>
        <p className="text-muted-foreground">Configure system preferences and options</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Reconciliation Settings
            </CardTitle>
            <CardDescription>Configure reconciliation parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="match-threshold">Match Threshold (%)</Label>
              <Input id="match-threshold" type="number" defaultValue="95" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="narration-chars">Narration Characters to Match</Label>
              <Input id="narration-chars" type="number" defaultValue="15" />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-reconcile">Auto-reconcile on upload</Label>
              <Switch id="auto-reconcile" />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="email-notifications">Email notifications</Label>
              <Switch id="email-notifications" defaultChecked />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>File Upload Settings</CardTitle>
            <CardDescription>Configure file upload preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="max-file-size">Max File Size (MB)</Label>
              <Input id="max-file-size" type="number" defaultValue="50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-format">Date Format</Label>
              <Input id="date-format" defaultValue="YYYY-MM-DD" />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="validate-upload">Validate on upload</Label>
              <Switch id="validate-upload" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="backup-files">Backup uploaded files</Label>
              <Switch id="backup-files" defaultChecked />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Information</CardTitle>
          <CardDescription>Current system status and information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">System Version</p>
              <p className="text-lg font-semibold">v2.1.0</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Last Backup</p>
              <p className="text-lg font-semibold">2024-01-20</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Database Status</p>
              <p className="text-lg font-semibold text-primary">Connected</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" className="gap-2">
          <Save className="h-4 w-4" />
          Save Settings
        </Button>
      </div>
    </div>
  )
}
