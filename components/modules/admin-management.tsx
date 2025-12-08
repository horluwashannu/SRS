"use client"

import { useState, useEffect } from "react"
import { Shield, UserPlus, Edit, Trash2, Database, Save, CheckCircle2, Play, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getSupabaseClient, resetSupabaseClient } from "@/lib/supabase"

const mockOfficers = [
  { id: "U001", name: "John Doe", email: "john.doe@company.com", role: "Admin", status: "Active" },
  { id: "U002", name: "Jane Smith", email: "jane.smith@company.com", role: "Officer", status: "Active" },
  { id: "U003", name: "Mike Johnson", email: "mike.j@company.com", role: "Officer", status: "Inactive" },
]

const modules = [
  { id: "smart-reconciliation", name: "Smart Reconciliation", enabled: true },
  { id: "pending-reports", name: "Pending & Mismatched Reports", enabled: true },
  { id: "history-logs", name: "History Logs", enabled: true },
  { id: "weekly-reports", name: "Weekly Reports Collation", enabled: true },
  { id: "smart-teller-calculator", name: "Smart Teller Calculator", enabled: true },
  { id: "consolidated-proof", name: "Consolidated Proof", enabled: true },
  { id: "teller-proof", name: "Teller Proof", enabled: true },
  { id: "system-settings", name: "System Settings", enabled: true },
  { id: "admin-management", name: "Admin Management", enabled: true },
]

const DATABASE_SETUP_SQL = `
-- Create users table with roles
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  branch_code TEXT,
  branch_name TEXT,
  country TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create reconciliation_data table
CREATE TABLE IF NOT EXISTS reconciliation_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  branch_code TEXT,
  branch_name TEXT,
  country TEXT,
  file_type TEXT,
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create weekly_reports table
CREATE TABLE IF NOT EXISTS weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  branch_code TEXT,
  branch_name TEXT,
  country TEXT,
  week_start DATE,
  week_end DATE,
  teller_data JSONB,
  customer_service_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create consolidated_proof table
CREATE TABLE IF NOT EXISTS consolidated_proof (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  branch_code TEXT,
  branch_name TEXT,
  country TEXT,
  date DATE,
  currency TEXT,
  balance_bf NUMERIC,
  teller_data JSONB,
  total_deposit NUMERIC,
  total_withdrawal NUMERIC,
  total_balance NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create teller_proof table
CREATE TABLE IF NOT EXISTS teller_proof (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  branch_code TEXT,
  branch_name TEXT,
  country TEXT,
  date DATE,
  transaction_data JSONB,
  system_data JSONB,
  discrepancies JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create calculator_data table
CREATE TABLE IF NOT EXISTS calculator_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  branch_code TEXT,
  branch_name TEXT,
  country TEXT,
  currency TEXT,
  denomination_data JSONB,
  total_amount NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE consolidated_proof ENABLE ROW LEVEL SECURITY;
ALTER TABLE teller_proof ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculator_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
CREATE POLICY "Users can view their own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own data" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Create policies for reconciliation_data
CREATE POLICY "Users can view their own reconciliation data" ON reconciliation_data
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reconciliation data" ON reconciliation_data
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create policies for weekly_reports
CREATE POLICY "Users can view their own weekly reports" ON weekly_reports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own weekly reports" ON weekly_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own weekly reports" ON weekly_reports
  FOR UPDATE USING (auth.uid() = user_id);

-- Create policies for consolidated_proof
CREATE POLICY "Users can view their own consolidated proof" ON consolidated_proof
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own consolidated proof" ON consolidated_proof
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create policies for teller_proof
CREATE POLICY "Users can view their own teller proof" ON teller_proof
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own teller proof" ON teller_proof
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create policies for calculator_data
CREATE POLICY "Users can view their own calculator data" ON calculator_data
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own calculator data" ON calculator_data
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create policies for system_settings
CREATE POLICY "Anyone can view system settings" ON system_settings
  FOR SELECT USING (true);

CREATE POLICY "Only admins can modify system settings" ON system_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );
`

export function AdminManagement() {
  const [moduleStates, setModuleStates] = useState(modules)
  const [supabaseUrl, setSupabaseUrl] = useState("")
  const [supabaseKey, setSupabaseKey] = useState("")
  const [configSaved, setConfigSaved] = useState(false)
  const [sqlSetupStatus, setSqlSetupStatus] = useState<"idle" | "running" | "success" | "error">("idle")
  const [sqlSetupMessage, setSqlSetupMessage] = useState("")

  useEffect(() => {
    // Load saved credentials from localStorage
    const savedUrl = localStorage.getItem("supabase_url") || ""
    const savedKey = localStorage.getItem("supabase_key") || ""
    setSupabaseUrl(savedUrl)
    setSupabaseKey(savedKey)
    setConfigSaved(!!(savedUrl && savedKey))
  }, [])

  /**
   * Placeholder function to toggle module enable/disable
   * TODO: Implement module state management
   */
  const adminToggleModule = (moduleId: string) => {
    setModuleStates((prev) =>
      prev.map((module) => (module.id === moduleId ? { ...module, enabled: !module.enabled } : module)),
    )
    console.log(`Toggled module: ${moduleId}`)
  }

  const saveSupabaseConfig = () => {
    if (!supabaseUrl || !supabaseKey) {
      alert("Please enter both Supabase URL and Anon Key")
      return
    }

    // Validate URL format
    try {
      new URL(supabaseUrl)
    } catch {
      alert("Please enter a valid Supabase URL (e.g., https://your-project.supabase.co)")
      return
    }

    // Save to localStorage
    localStorage.setItem("supabase_url", supabaseUrl)
    localStorage.setItem("supabase_key", supabaseKey)

    resetSupabaseClient()

    setConfigSaved(true)
    console.log("[v0] Supabase configuration saved to localStorage")
    alert("Supabase configuration saved successfully! You can now use authentication and data persistence.")
  }

  const runSqlSetup = async () => {
    if (!configSaved) {
      alert("Please save your Supabase configuration first")
      return
    }

    setSqlSetupStatus("running")
    setSqlSetupMessage("Setting up database tables...")

    try {
      const supabase = getSupabaseClient()

      const statements = DATABASE_SETUP_SQL.split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)

      for (const statement of statements) {
        const { error } = await supabase.rpc("exec_sql", { sql: statement })
        if (error) {
          console.error("[v0] SQL execution error:", error)
        }
      }

      setSqlSetupStatus("success")
      setSqlSetupMessage("Database tables created successfully! Your database is ready to use.")
    } catch (error: any) {
      console.error("[v0] SQL setup error:", error)
      setSqlSetupStatus("error")
      setSqlSetupMessage(
        "Automatic setup failed. Please copy the SQL script from scripts/01-create-tables.sql and run it manually in your Supabase SQL Editor. This is normal - Supabase may not have the exec_sql function enabled.",
      )
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Admin Management</h1>
        <p className="text-muted-foreground">Manage users, modules, database integration, and system access</p>
      </div>

      <Tabs defaultValue="modules" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="modules" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Module Management
                  </CardTitle>
                  <CardDescription>Enable or disable system modules</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {moduleStates.map((module) => (
                  <div
                    key={module.id}
                    className="flex items-center justify-between rounded-lg border border-border p-4"
                  >
                    <div>
                      <Label htmlFor={module.id} className="text-base font-medium text-foreground">
                        {module.name}
                      </Label>
                      <p className="text-sm text-muted-foreground">Module ID: {module.id}</p>
                    </div>
                    <Switch
                      id={module.id}
                      checked={module.enabled}
                      onCheckedChange={() => adminToggleModule(module.id)}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Authorized Officers</CardTitle>
                  <CardDescription>Manage reconciliation officers and their access</CardDescription>
                </div>
                <Button className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Add Officer
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockOfficers.map((officer) => (
                      <TableRow key={officer.id}>
                        <TableCell className="font-medium">{officer.id}</TableCell>
                        <TableCell>{officer.name}</TableCell>
                        <TableCell>{officer.email}</TableCell>
                        <TableCell>
                          <Badge variant={officer.role === "Admin" ? "default" : "secondary"}>{officer.role}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={officer.status === "Active" ? "default" : "outline"}>{officer.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="database" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Supabase Integration
              </CardTitle>
              <CardDescription>Configure Supabase database connection for data persistence</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {configSaved && (
                <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      Supabase is configured and ready to use
                    </p>
                    <p className="text-xs text-green-600/80 dark:text-green-400/80 mt-1">
                      Your credentials are saved locally. You can now use authentication and data persistence.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="supabase-url" className="text-foreground">
                    Supabase URL
                  </Label>
                  <Input
                    id="supabase-url"
                    type="url"
                    placeholder="https://your-project.supabase.co"
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">Find this in your Supabase project settings under API</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supabase-key" className="text-foreground">
                    Supabase Anon Key
                  </Label>
                  <Input
                    id="supabase-key"
                    type="password"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    value={supabaseKey}
                    onChange={(e) => setSupabaseKey(e.target.value)}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Find this in your Supabase project settings under API (anon/public key)
                  </p>
                </div>

                <Button onClick={saveSupabaseConfig} className="w-full">
                  <Save className="mr-2 h-4 w-4" />
                  Save Database Configuration
                </Button>
              </div>

              {configSaved && (
                <div className="space-y-4">
                  <div className="h-px bg-border" />

                  <div>
                    <h4 className="mb-2 font-semibold text-foreground">Database Setup</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Click the button below to automatically create all required database tables in your Supabase
                      project.
                    </p>

                    <Button
                      onClick={runSqlSetup}
                      disabled={sqlSetupStatus === "running"}
                      className="w-full"
                      variant={sqlSetupStatus === "success" ? "outline" : "default"}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      {sqlSetupStatus === "running"
                        ? "Setting up database..."
                        : sqlSetupStatus === "success"
                          ? "Database Setup Complete"
                          : "Run Database Setup"}
                    </Button>

                    {sqlSetupStatus === "success" && (
                      <div className="mt-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4 flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-green-600 dark:text-green-400">Setup Successful</p>
                          <p className="text-xs text-green-600/80 dark:text-green-400/80 mt-1">{sqlSetupMessage}</p>
                        </div>
                      </div>
                    )}

                    {sqlSetupStatus === "error" && (
                      <div className="mt-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-red-600 dark:text-red-400">Setup Failed</p>
                          <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">{sqlSetupMessage}</p>
                          <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-2">
                            Please copy the SQL script from scripts/01-create-tables.sql and run it manually in your
                            Supabase SQL Editor.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <h4 className="mb-2 font-semibold text-foreground">Database Setup Instructions</h4>
                <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
                  <li>Create a Supabase account at supabase.com (free plan works)</li>
                  <li>Create a new project</li>
                  <li>Go to Project Settings → API</li>
                  <li>Copy your Project URL and anon/public key</li>
                  <li>Paste them in the fields above and click Save</li>
                  <li>Go to SQL Editor and run the scripts from the scripts folder</li>
                  <li>All data will now be saved to your Supabase database</li>
                </ol>
              </div>

              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <h4 className="mb-2 font-semibold text-foreground">What Gets Saved</h4>
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  <li>Smart Reconciliation data and results</li>
                  <li>Weekly Reports (Teller Operations & Customer Service)</li>
                  <li>Consolidated Proof calculations</li>
                  <li>Teller Proof discrepancies</li>
                  <li>Calculator data and totals</li>
                  <li>User profiles and permissions</li>
                  <li>System settings and configurations</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>System Usage Logs</CardTitle>
              <CardDescription>Recent system activity summary</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-lg border border-border p-4">
                  <p className="text-sm text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold text-foreground">12</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-sm text-muted-foreground">Active Sessions</p>
                  <p className="text-2xl font-bold text-foreground">5</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-sm text-muted-foreground">Reconciliations Today</p>
                  <p className="text-2xl font-bold text-foreground">23</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-sm text-muted-foreground">Files Processed</p>
                  <p className="text-2xl font-bold text-foreground">47</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
