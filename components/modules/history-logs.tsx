"use client"
import { useState, useEffect } from "react"
import { AlertCircle, Download, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getSupabase } from "@/lib/supabase"
import * as XLSX from "xlsx"

interface PendingTransaction {
  id: string
  date: string
  narration: string
  signed_amount: number
  side: "debit" | "credit"
  status: "pending"
  helper_key1: string
  helper_key2: string
}

interface PendingReportsProps {
  userId: string | null
}

export function PendingReports({ userId }: PendingReportsProps) {
  const [creditReports, setCreditReports] = useState<PendingTransaction[]>([])
  const [debitReports, setDebitReports] = useState<PendingTransaction[]>([])
  const [loading, setLoading] = useState(false)

  const fetchPendingReports = async () => {
    setLoading(true)
    try {
      const supabase = getSupabase()
      if (supabase) {
        const { data, error } = await supabase
          .from("reconciliation_results")
          .select("*")
          .eq("status", "pending")
          .order("date", { ascending: false })

        if (data && !error) {
          const credits = data.filter((r: any) => r.side === "credit")
          const debits = data.filter((r: any) => r.side === "debit")
          setCreditReports(credits)
          setDebitReports(debits)
          console.log("[v0] Fetched pending reports from Supabase:", { credits: credits.length, debits: debits.length })
        } else if (error) {
          console.error("[v0] Error fetching from Supabase:", error)
        }
      } else {
        // Fallback to localStorage
        const reconResults = localStorage.getItem("recon_results_temp")
        if (reconResults) {
          const parsed = JSON.parse(reconResults)
          const pending = parsed.filter((r: any) => r.status === "pending")
          const credits = pending.filter((r: any) => r.side === "credit")
          const debits = pending.filter((r: any) => r.side === "debit")
          setCreditReports(credits)
          setDebitReports(debits)
          console.log("[v0] Fetched pending reports from localStorage:", {
            credits: credits.length,
            debits: debits.length,
          })
        }
      }
    } catch (error) {
      console.error("[v0] Error fetching pending reports:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPendingReports()
  }, [userId])

  const handleExport = () => {
    const allReports = [...creditReports, ...debitReports]
    const ws = XLSX.utils.json_to_sheet(
      allReports.map((r) => ({
        Date: r.date,
        Narration: r.narration,
        Amount: r.signed_amount,
        Side: r.side,
        Status: r.status,
        HelperKey1: r.helper_key1,
        HelperKey2: r.helper_key2,
      })),
    )
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Pending Reports")
    XLSX.writeFile(wb, `pending-reports-${new Date().toISOString().split("T")[0]}.xlsx`)
  }

  const totalPending = creditReports.length + debitReports.length
  const totalCreditAmount = creditReports.reduce((sum, r) => sum + Math.abs(r.signed_amount), 0)
  const totalDebitAmount = debitReports.reduce((sum, r) => sum + Math.abs(r.signed_amount), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Pending & Mismatched Reports</h1>
          <p className="text-muted-foreground">Review transactions requiring attention from reconciliation</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchPendingReports} variant="outline" className="gap-2 bg-transparent" disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={handleExport} className="gap-2" disabled={totalPending === 0}>
            <Download className="h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Pending</CardDescription>
            <CardTitle className="text-3xl text-foreground">{totalPending}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Pending Credits</CardDescription>
            <CardTitle className="text-3xl text-foreground">{creditReports.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Pending Debits</CardDescription>
            <CardTitle className="text-3xl text-foreground">{debitReports.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Credit Transactions */}
        <Card className="border-chart-3/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <AlertCircle className="h-5 w-5 text-chart-3" />
              Credit Transactions
            </CardTitle>
            <CardDescription>
              {creditReports.length} credit entries (₦{totalCreditAmount.toLocaleString()})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-foreground">Date</TableHead>
                    <TableHead className="text-foreground">Narration</TableHead>
                    <TableHead className="text-right text-foreground">Amount (₦)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creditReports.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No pending credit transactions
                      </TableCell>
                    </TableRow>
                  ) : (
                    creditReports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="text-foreground">{report.date}</TableCell>
                        <TableCell className="text-foreground max-w-xs truncate">{report.narration}</TableCell>
                        <TableCell className="text-right font-mono text-foreground">
                          ₦{Math.abs(report.signed_amount).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Debit Transactions */}
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Debit Transactions
            </CardTitle>
            <CardDescription>
              {debitReports.length} debit entries (₦{totalDebitAmount.toLocaleString()})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-foreground">Date</TableHead>
                    <TableHead className="text-foreground">Narration</TableHead>
                    <TableHead className="text-right text-foreground">Amount (₦)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {debitReports.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No pending debit transactions
                      </TableCell>
                    </TableRow>
                  ) : (
                    debitReports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="text-foreground">{report.date}</TableCell>
                        <TableCell className="text-foreground max-w-xs truncate">{report.narration}</TableCell>
                        <TableCell className="text-right font-mono text-foreground">
                          ₦{Math.abs(report.signed_amount).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
