"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TrendingUp, DollarSign, Users, Save, RefreshCw, AlertCircle } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { BranchInfo } from "@/components/branch-info"
import { getSupabase } from "@/lib/supabase"

interface WeeklyReportsCollationProps {
  userId?: string
}

export function WeeklyReportsCollation({ userId }: WeeklyReportsCollationProps) {
  const [selectedWeek, setSelectedWeek] = useState("2024-W15")
  const [showSuccessModal, setShowSuccessModal] = useState(false)

  // Teller Operations State
  const [dailyWithdrawal, setDailyWithdrawal] = useState("")
  const [dailyDeposit, setDailyDeposit] = useState("")
  const [largeSumCMC, setLargeSumCMC] = useState("")
  const [largeSumBW, setLargeSumBW] = useState("")
  const [tellerCount, setTellerCount] = useState("")
  const [tellerTickets, setTellerTickets] = useState("")

  // Customer Service State
  const [accountsOpened, setAccountsOpened] = useState("")
  const [accountsOnboarded, setAccountsOnboarded] = useState("")
  const [exceptionAmount, setExceptionAmount] = useState("")

  // Branch Information State
  const [branchCode, setBranchCode] = useState("")
  const [branchName, setBranchName] = useState("")
  const [country, setCountry] = useState("")

  // Consolidated Proof State
  const [consolidatedProofData, setConsolidatedProofData] = useState<any>(null)

  useEffect(() => {
    const loadConsolidatedData = () => {
      const data = localStorage.getItem("consolidatedProofDaily")
      if (data) {
        const parsed = JSON.parse(data)
        setConsolidatedProofData(parsed)
        // Auto-populate daily deposit and withdrawal from consolidated proof
        setDailyDeposit(parsed.totalDeposit.toString())
        setDailyWithdrawal(parsed.totalWithdrawal.toString())
      }
    }
    loadConsolidatedData()
    // Poll for updates every 5 seconds
    const interval = setInterval(loadConsolidatedData, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleSubmitTellerData = async () => {
    const tellerData = {
      dailyWithdrawal,
      dailyDeposit,
      largeSumCMC,
      largeSumBW,
      tellerCount,
      tellerTickets,
      consolidatedProofData,
    }

    try {
      const supabase = getSupabase()
      const { error } = await supabase.from("weekly_reports").insert({
        user_id: userId,
        branch_code: branchCode,
        branch_name: branchName,
        country,
        week_start: selectedWeek,
        week_end: selectedWeek,
        teller_data: tellerData,
        customer_service_data: null,
      })

      if (error) throw error
      console.log("[v0] Teller data saved to Supabase")
    } catch (error) {
      console.log("[v0] Supabase not configured, saving to localStorage")
      localStorage.setItem("weeklyReportsTeller", JSON.stringify(tellerData))
    }

    setShowSuccessModal(true)
  }

  const handleSubmitCustomerService = async () => {
    const customerServiceData = {
      accountsOpened,
      accountsOnboarded,
      exceptionAmount,
    }

    try {
      const supabase = getSupabase()
      const { error } = await supabase.from("weekly_reports").insert({
        user_id: userId,
        branch_code: branchCode,
        branch_name: branchName,
        country,
        week_start: selectedWeek,
        week_end: selectedWeek,
        teller_data: null,
        customer_service_data: customerServiceData,
      })

      if (error) throw error
      console.log("[v0] Customer service data saved to Supabase")
    } catch (error) {
      console.log("[v0] Supabase not configured, saving to localStorage")
      localStorage.setItem("weeklyReportsCustomerService", JSON.stringify(customerServiceData))
    }

    setShowSuccessModal(true)
  }

  const handleFetchWeeklyData = async () => {
    try {
      const supabase = getSupabase()
      const { data, error } = await supabase
        .from("weekly_reports")
        .select("*")
        .eq("week_start", selectedWeek)
        .eq("user_id", userId)

      if (error) throw error
      if (data && data.length > 0) {
        console.log("[v0] Fetched weekly data from Supabase:", data)
        // TODO: Populate form fields with fetched data
      }
    } catch (error) {
      console.log("[v0] Supabase not configured, checking localStorage")
      const tellerData = localStorage.getItem("weeklyReportsTeller")
      const customerServiceData = localStorage.getItem("weeklyReportsCustomerService")
      if (tellerData || customerServiceData) {
        console.log("[v0] Found data in localStorage")
      }
    }
  }

  const weeklyStats = [
    { label: "Total Transactions", value: "1,234", change: "+12%", trend: "up" },
    { label: "Avg Per Teller", value: "₦245K", change: "+8%", trend: "up" },
    { label: "Accounts Opened", value: "54", change: "+15%", trend: "up" },
    { label: "Exception Rate", value: "2.4%", change: "-2%", trend: "down" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Weekly Reports Collation</h1>
          <p className="text-muted-foreground">Manage daily operations and generate weekly reports</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="week"
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="rounded-lg border border-input bg-background text-foreground px-4 py-2"
          />
          <Button onClick={handleFetchWeeklyData} variant="outline" className="gap-2 bg-transparent">
            <RefreshCw className="h-4 w-4" />
            Fetch Data
          </Button>
        </div>
      </div>

      {/* Branch Information Section */}
      <BranchInfo
        branchCode={branchCode}
        branchName={branchName}
        country={country}
        onBranchCodeChange={setBranchCode}
        onBranchNameChange={setBranchName}
        onCountryChange={setCountry}
      />

      {/* Consolidated Proof Data Indicator */}
      {consolidatedProofData && (
        <Card className="border-chart-3/20 bg-chart-3/5 backdrop-blur">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-chart-3 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-foreground">Consolidated Proof Data Loaded</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Daily totals from Consolidated Proof have been automatically loaded. Total Balance:{" "}
                  <span className="font-mono font-semibold text-foreground">
                    ₦{consolidatedProofData.totalBalance.toLocaleString()}
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {weeklyStats.map((stat) => (
          <Card key={stat.label} className="border-primary/20 bg-card/50 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              <TrendingUp className={`h-4 w-4 ${stat.trend === "up" ? "text-chart-3" : "text-destructive"}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className={`text-xs ${stat.trend === "up" ? "text-chart-3" : "text-destructive"}`}>
                {stat.change} from last week
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="teller-operations" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="teller-operations">Teller Operations</TabsTrigger>
          <TabsTrigger value="customer-service">Customer Service</TabsTrigger>
        </TabsList>

        <TabsContent value="teller-operations" className="space-y-4">
          <Card className="border-primary/20 bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-card-foreground">
                <DollarSign className="h-5 w-5" />
                Daily Cash Operations
              </CardTitle>
              <CardDescription>
                Daily totals are auto-populated from Consolidated Proof. Add CMC/BW large sums separately.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dailyWithdrawal" className="text-foreground">
                    Daily Cash Withdrawal (₦)
                  </Label>
                  <Input
                    id="dailyWithdrawal"
                    type="number"
                    placeholder="Auto-loaded from Consolidated Proof"
                    value={dailyWithdrawal}
                    onChange={(e) => setDailyWithdrawal(e.target.value)}
                    className="bg-muted/50"
                  />
                  {consolidatedProofData && (
                    <p className="text-xs text-muted-foreground">
                      From Consolidated Proof: ₦{consolidatedProofData.totalWithdrawal.toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dailyDeposit" className="text-foreground">
                    Daily Cash Deposit (₦)
                  </Label>
                  <Input
                    id="dailyDeposit"
                    type="number"
                    placeholder="Auto-loaded from Consolidated Proof"
                    value={dailyDeposit}
                    onChange={(e) => setDailyDeposit(e.target.value)}
                    className="bg-muted/50"
                  />
                  {consolidatedProofData && (
                    <p className="text-xs text-muted-foreground">
                      From Consolidated Proof: ₦{consolidatedProofData.totalDeposit.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="largeSumCMC">Large Sum Deposited/Shipped by CMC (₦)</Label>
                  <Input
                    id="largeSumCMC"
                    type="number"
                    placeholder="Enter amount"
                    value={largeSumCMC}
                    onChange={(e) => setLargeSumCMC(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="largeSumBW">Large Sum Deposited/Shipped by BW (₦)</Label>
                  <Input
                    id="largeSumBW"
                    type="number"
                    placeholder="Enter amount"
                    value={largeSumBW}
                    onChange={(e) => setLargeSumBW(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Daily Teller Tickets Posting
              </CardTitle>
              <CardDescription>Record number of tellers and transaction amounts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tellerCount">Number of Tellers</Label>
                  <Input
                    id="tellerCount"
                    type="number"
                    placeholder="Enter number of tellers"
                    value={tellerCount}
                    onChange={(e) => setTellerCount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tellerTickets">Total Tickets Amount (₦)</Label>
                  <Input
                    id="tellerTickets"
                    type="number"
                    placeholder="Enter total amount"
                    value={tellerTickets}
                    onChange={(e) => setTellerTickets(e.target.value)}
                  />
                </div>
              </div>

              {tellerCount && tellerTickets && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm font-medium">Average per Teller</p>
                  <p className="text-2xl font-bold text-primary">
                    ₦
                    {(Number.parseFloat(tellerTickets) / Number.parseFloat(tellerCount)).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
              )}

              <Button onClick={handleSubmitTellerData} className="w-full bg-gradient-to-r from-primary to-accent">
                <Save className="mr-2 h-4 w-4" />
                Submit Teller Data
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customer-service" className="space-y-4">
          <Card className="border-primary/20 bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Customer Service Unit - Weekly Report
              </CardTitle>
              <CardDescription>Record weekly account activities and exceptions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="accountsOpened">Accounts Opened (Weekly)</Label>
                  <Input
                    id="accountsOpened"
                    type="number"
                    placeholder="Enter count"
                    value={accountsOpened}
                    onChange={(e) => setAccountsOpened(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountsOnboarded">Accounts Onboarded (Weekly)</Label>
                  <Input
                    id="accountsOnboarded"
                    type="number"
                    placeholder="Enter count"
                    value={accountsOnboarded}
                    onChange={(e) => setAccountsOnboarded(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exceptionAmount">Exception Amount (₦)</Label>
                  <Input
                    id="exceptionAmount"
                    type="number"
                    placeholder="Enter amount"
                    value={exceptionAmount}
                    onChange={(e) => setExceptionAmount(e.target.value)}
                  />
                </div>
              </div>

              <Button onClick={handleSubmitCustomerService} className="w-full bg-gradient-to-r from-primary to-accent">
                <Save className="mr-2 h-4 w-4" />
                Submit Customer Service Data
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-chart-3">
              <TrendingUp className="h-5 w-5" />
              Data Submitted Successfully
            </DialogTitle>
            <DialogDescription>
              Your weekly report data has been saved. You can view and export the complete report at the end of the
              week.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => setShowSuccessModal(false)} className="bg-gradient-to-r from-primary to-accent">
            Close
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
