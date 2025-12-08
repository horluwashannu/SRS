"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Download, Save, Plus, Trash2 } from "lucide-react"
import { BranchInfo } from "@/components/branch-info"
import { getSupabase } from "@/lib/supabase"
import * as XLSX from "xlsx"

const NAIRA_DENOMINATIONS = [1000, 500, 200, 100, 50, 20, 10, 5]
const DOLLAR_DENOMINATIONS = [100, 50, 20, 10, 5, 1]
const POUNDS_DENOMINATIONS = [50, 20, 10, 5, 1]
const EURO_DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5]

interface TellerData {
  id: string
  name: string
  // these maps now hold exact amounts (not counts)
  buy: { [key: number]: number }
  sell: { [key: number]: number }
}

interface ConsolidatedProofProps {
  userId?: string
}

export function ConsolidatedProof({ userId }: ConsolidatedProofProps) {
  const [currency, setCurrency] = useState<"naira" | "dollar" | "pounds" | "euro">("naira")
  const [tellers, setTellers] = useState<TellerData[]>([
    { id: "T001", name: "Teller 01", buy: {}, sell: {} },
    { id: "T002", name: "Teller 02", buy: {}, sell: {} },
  ])

  const [branchCode, setBranchCode] = useState("")
  const [branchName, setBranchName] = useState("")
  const [country, setCountry] = useState("")

  // Balance B/F holds exact amounts keyed by denomination (if you use them)
  const [balanceBF, setBalanceBF] = useState<{ [key: number]: number }>({})

  const getDenominations = () => {
    switch (currency) {
      case "naira":
        return NAIRA_DENOMINATIONS
      case "dollar":
        return DOLLAR_DENOMINATIONS
      case "pounds":
        return POUNDS_DENOMINATIONS
      case "euro":
        return EURO_DENOMINATIONS
      default:
        return NAIRA_DENOMINATIONS
    }
  }

  const getCurrencySymbol = () => {
    switch (currency) {
      case "naira":
        return "₦"
      case "dollar":
        return "$"
      case "pounds":
        return "£"
      case "euro":
        return "€"
      default:
        return "₦"
    }
  }

  const addTeller = () => {
    const newId = `T${String(tellers.length + 1).padStart(3, "0")}`
    setTellers([...tellers, { id: newId, name: `Teller ${tellers.length + 1}`, buy: {}, sell: {} }])
  }

  const removeTeller = (id: string) => {
    setTellers(tellers.filter((t) => t.id !== id))
  }

  const updateTellerName = (tellerId: string, name: string) => {
    setTellers(tellers.map((t) => (t.id === tellerId ? { ...t, name } : t)))
  }

  // NOTE: these update functions now store the value the user typed (exact amount)
  const updateTellerBuy = (tellerId: string, denomination: number, value: number) => {
    setTellers((prev) =>
      prev.map((t) => (t.id === tellerId ? { ...t, buy: { ...t.buy, [denomination]: value } } : t)),
    )
  }

  const updateTellerSell = (tellerId: string, denomination: number, value: number) => {
    setTellers((prev) =>
      prev.map((t) => (t.id === tellerId ? { ...t, sell: { ...t.sell, [denomination]: value } } : t)),
    )
  }

  // Totals are direct sums of the entered amounts (no multiplication by denomination)
  const calculateTotalDeposit = (denomination: number) => {
    return tellers.reduce((sum, teller) => sum + (teller.buy[denomination] || 0), 0)
  }

  const calculateTotalWithdrawal = (denomination: number) => {
    return tellers.reduce((sum, teller) => sum + (teller.sell[denomination] || 0), 0)
  }

  // Balance per denom is BF + deposit - withdrawal (all exact amounts)
  const calculateTotalBalance = (denomination: number) => {
    const bf = balanceBF[denomination] || 0
    const deposit = calculateTotalDeposit(denomination)
    const withdrawal = calculateTotalWithdrawal(denomination)
    return bf + deposit - withdrawal
  }

  // Grand totals sum the per-denomination amounts directly (not multiplying by denom)
  const calculateGrandTotal = (type: "bf" | "deposit" | "withdrawal" | "balance") => {
    const denominations = getDenominations()
    return denominations.reduce((sum, denom) => {
      switch (type) {
        case "bf":
          return sum + (balanceBF[denom] || 0)
        case "deposit":
          return sum + calculateTotalDeposit(denom)
        case "withdrawal":
          return sum + calculateTotalWithdrawal(denom)
        case "balance":
          return sum + calculateTotalBalance(denom)
        default:
          return sum
      }
    }, 0)
  }

  useEffect(() => {
    const dailyTotal = {
      date: new Date().toISOString().split("T")[0],
      currency,
      totalBalance: calculateGrandTotal("balance"),
      totalDeposit: calculateGrandTotal("deposit"),
      totalWithdrawal: calculateGrandTotal("withdrawal"),
      branchCode,
      branchName,
      country,
    }
    localStorage.setItem("consolidatedProofDaily", JSON.stringify(dailyTotal))
  }, [tellers, balanceBF, currency, branchCode, branchName, country])

  const handleSave = async () => {
    const proofData = {
      currency,
      balance_bf: balanceBF,
      teller_data: tellers,
      total_deposit: calculateGrandTotal("deposit"),
      total_withdrawal: calculateGrandTotal("withdrawal"),
      total_balance: calculateGrandTotal("balance"),
    }

    try {
      const supabase = getSupabase()
      const { error } = await supabase.from("consolidated_proof").insert({
        user_id: userId,
        branch_code: branchCode,
        branch_name: branchName,
        country,
        date: new Date().toISOString().split("T")[0],
        currency,
        balance_bf: calculateGrandTotal("bf"),
        teller_data: tellers,
        total_deposit: calculateGrandTotal("deposit"),
        total_withdrawal: calculateGrandTotal("withdrawal"),
        total_balance: calculateGrandTotal("balance"),
      })

      if (error) throw error
      alert("✅ Consolidated proof saved successfully to Supabase!")
    } catch (error) {
      localStorage.setItem("consolidatedProof", JSON.stringify(proofData))
      alert("⚠️ Saved locally (Supabase unavailable).")
    }
  }

  // Export exact entered amounts into Excel (Summary + Teller Breakdown)
  const handleExport = () => {
    const date = new Date().toISOString().split("T")[0]

    const summaryHeader = [
      ["Branch Name", branchName],
      ["Branch Code", branchCode],
      ["Country", country],
      ["Currency", currency.toUpperCase()],
      ["Date", date],
      [],
    ]

    const sheet1Body = [
      ["Denomination", "Balance B/F (exact)", "Total Deposit (exact)", "Total Withdrawal (exact)", "Total Balance (exact)"],
      ...getDenominations().map((denom) => [
        `${getCurrencySymbol()}${denom}`,
        balanceBF[denom] || 0,
        calculateTotalDeposit(denom),
        calculateTotalWithdrawal(denom),
        calculateTotalBalance(denom),
      ]),
      [],
      ["TOTALS (exact)", calculateGrandTotal("bf"), calculateGrandTotal("deposit"), calculateGrandTotal("withdrawal"), calculateGrandTotal("balance")],
    ]

    const sheet1Data = [...summaryHeader, ...sheet1Body]

    const sheet2Header = [["Teller ID", "Teller Name", "Denomination", "Buy (exact)", "Sell (exact)"]]
    const sheet2Body: any[] = []
    tellers.forEach((teller) => {
      getDenominations().forEach((denom) => {
        sheet2Body.push([teller.id, teller.name, `${getCurrencySymbol()}${denom}`, teller.buy[denom] || 0, teller.sell[denom] || 0])
      })
    })

    const wb = XLSX.utils.book_new()
    const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data)
    const ws2 = XLSX.utils.aoa_to_sheet([...sheet2Header, ...sheet2Body])

    XLSX.utils.book_append_sheet(wb, ws1, "Summary")
    XLSX.utils.book_append_sheet(wb, ws2, "Teller Breakdown")

    XLSX.writeFile(wb, `Consolidated_Proof_Report_${date}.xlsx`)
    alert("✅ Excel report exported successfully!")
  }

  const formatNumber = (num: number | undefined) => {
    if (num === undefined || num === null) return "0"
    return num.toLocaleString(undefined, { minimumFractionDigits: 0 })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Consolidated Proof</h1>
          <p className="text-muted-foreground">Track currency denominations and teller buy/sell transactions</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} className="bg-gradient-to-r from-primary to-accent gap-2">
            <Save className="h-4 w-4" /> Save
          </Button>
          <Button onClick={handleExport} variant="outline" className="gap-2 bg-transparent">
            <Download className="h-4 w-4" /> Export Excel
          </Button>
        </div>
      </div>

      <BranchInfo
        branchCode={branchCode}
        branchName={branchName}
        country={country}
        onBranchCodeChange={setBranchCode}
        onBranchNameChange={setBranchName}
        onCountryChange={setCountry}
      />

      <Tabs value={currency} onValueChange={(v) => setCurrency(v as any)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="naira">Naira (₦)</TabsTrigger>
          <TabsTrigger value="dollar">Dollar ($)</TabsTrigger>
          <TabsTrigger value="pounds">Pounds (£)</TabsTrigger>
          <TabsTrigger value="euro">Euro (€)</TabsTrigger>
        </TabsList>

        <TabsContent value={currency} className="space-y-4">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-primary/20 bg-card/50 backdrop-blur">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-card-foreground">Balance B/F</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-card-foreground">
                  {getCurrencySymbol()}
                  {formatNumber(calculateGrandTotal("bf"))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-card/50 backdrop-blur">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-card-foreground">Total Deposit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-chart-3">
                  {getCurrencySymbol()}
                  {formatNumber(calculateGrandTotal("deposit"))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Auto-calculated from teller buys</p>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-card/50 backdrop-blur">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-card-foreground">Total Withdrawal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {getCurrencySymbol()}
                  {formatNumber(calculateGrandTotal("withdrawal"))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Auto-calculated from teller sells</p>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-card/50 backdrop-blur">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-card-foreground">Total Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {getCurrencySymbol()}
                  {formatNumber(calculateGrandTotal("balance"))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">BF + Deposit - Withdrawal</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Denomination Table */}
          <Card className="border-primary/20 bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-card-foreground">Denomination Breakdown</CardTitle>
              <CardDescription>
                Balance B/F is editable. Deposit and Withdrawal auto-update from teller entries.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="pb-3 text-left font-semibold text-foreground">Denomination</th>
                      <th className="pb-3 text-right font-semibold text-foreground">Balance B/F</th>
                      <th className="pb-3 text-right font-semibold text-foreground">Total Deposit</th>
                      <th className="pb-3 text-right font-semibold text-foreground">Total Withdrawal</th>
                      <th className="pb-3 text-right font-semibold text-foreground">Total Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getDenominations().map((denom) => (
                      <tr key={denom} className="border-b border-border/50">
                        <td className="py-3 font-medium text-foreground">
                          {getCurrencySymbol()}
                          {denom}
                        </td>
                        <td className="py-3 text-right">
                          <Input
                            type="number"
                            className="w-28 text-right"
                            value={balanceBF[denom] ?? ""}
                            onChange={(e) =>
                              setBalanceBF({ ...balanceBF, [denom]: Number.parseFloat(e.target.value) || 0 })
                            }
                            placeholder="0"
                          />
                        </td>
                        <td className="py-3 text-right font-mono text-chart-3 font-semibold">
                          {formatNumber(calculateTotalDeposit(denom))}
                        </td>
                        <td className="py-3 text-right font-mono text-destructive font-semibold">
                          {formatNumber(calculateTotalWithdrawal(denom))}
                        </td>
                        <td className="py-3 text-right font-mono text-primary font-semibold">
                          {formatNumber(calculateTotalBalance(denom))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Teller Section */}
          <Card className="border-primary/20 bg-card/50 backdrop-blur">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-card-foreground">Teller Buy & Sell</CardTitle>
                  <CardDescription>Each teller's figures automatically reflect in the totals.</CardDescription>
                </div>
                <Button onClick={addTeller} variant="outline" size="sm" className="gap-2 bg-transparent">
                  <Plus className="h-4 w-4" /> Add Teller
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {tellers.map((teller) => (
                <div key={teller.id} className="space-y-3 rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 flex-1">
                      <Label htmlFor={`teller-name-${teller.id}`} className="text-sm font-medium text-foreground">
                        Teller Name:
                      </Label>
                      <Input
                        id={`teller-name-${teller.id}`}
                        value={teller.name}
                        onChange={(e) => updateTellerName(teller.id, e.target.value)}
                        className="max-w-xs"
                        placeholder="Enter teller name"
                      />
                      <span className="text-sm text-muted-foreground">({teller.id})</span>
                    </div>
                    <Button
                      onClick={() => removeTeller(teller.id)}
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="pb-2 text-left text-sm font-medium text-foreground">Denomination</th>
                          <th className="pb-2 text-right text-sm font-medium text-foreground">Buy (Deposit)</th>
                          <th className="pb-2 text-right text-sm font-medium text-foreground">Sell (Withdrawal)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getDenominations().map((denom) => (
                          <tr key={denom} className="border-b border-border/30">
                            <td className="py-2 text-sm text-foreground">
                              {getCurrencySymbol()}
                              {denom}
                            </td>
                            <td className="py-2 text-right">
                              <Input
                                type="number"
                                className="h-8 w-24 text-right text-sm"
                                value={teller.buy[denom] ?? ""}
                                onChange={(e) =>
                                  updateTellerBuy(teller.id, denom, Number.parseFloat(e.target.value) || 0)
                                }
                                placeholder="0"
                              />
                            </td>
                            <td className="py-2 text-right">
                              <Input
                                type="number"
                                className="h-8 w-24 text-right text-sm"
                                value={teller.sell[denom] ?? ""}
                                onChange={(e) =>
                                  updateTellerSell(teller.id, denom, Number.parseFloat(e.target.value) || 0)
                                }
                                placeholder="0"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
