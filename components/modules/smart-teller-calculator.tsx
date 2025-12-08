"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calculator, DollarSign, Trash2, Save, Banknote } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BranchInfo } from "@/components/branch-info";
import { getSupabase } from "@/lib/supabase";

interface DenominationRow {
  value: number;
  label: string;
  bundles: number;
  pieces: number;
  packs: number;
}

type Currency = "naira" | "dollar" | "gbp" | "euro";

interface SmartTellerCalculatorProps {
  userId?: string;
}

const initialNairaDenominations: DenominationRow[] = [
  { value: 1000, label: "₦1000", bundles: 0, pieces: 0, packs: 0 },
  { value: 500, label: "₦500", bundles: 0, pieces: 0, packs: 0 },
  { value: 200, label: "₦200", bundles: 0, pieces: 0, packs: 0 },
  { value: 100, label: "₦100", bundles: 0, pieces: 0, packs: 0 },
  { value: 50, label: "₦50", bundles: 0, pieces: 0, packs: 0 },
  { value: 20, label: "₦20", bundles: 0, pieces: 0, packs: 0 },
  { value: 10, label: "₦10", bundles: 0, pieces: 0, packs: 0 },
  { value: 5, label: "₦5", bundles: 0, pieces: 0, packs: 0 },
];

const initialDollarDenominations: DenominationRow[] = [
  { value: 100, label: "$100", bundles: 0, pieces: 0, packs: 0 },
  { value: 50, label: "$50", bundles: 0, pieces: 0, packs: 0 },
  { value: 20, label: "$20", bundles: 0, pieces: 0, packs: 0 },
  { value: 10, label: "$10", bundles: 0, pieces: 0, packs: 0 },
  { value: 5, label: "$5", bundles: 0, pieces: 0, packs: 0 },
  { value: 1, label: "$1", bundles: 0, pieces: 0, packs: 0 },
];

const initialGBPDenominations: DenominationRow[] = [
  { value: 50, label: "£50", bundles: 0, pieces: 0, packs: 0 },
  { value: 20, label: "£20", bundles: 0, pieces: 0, packs: 0 },
  { value: 10, label: "£10", bundles: 0, pieces: 0, packs: 0 },
  { value: 5, label: "£5", bundles: 0, pieces: 0, packs: 0 },
];

const initialEuroDenominations: DenominationRow[] = [
  { value: 500, label: "€500", bundles: 0, pieces: 0, packs: 0 },
  { value: 200, label: "€200", bundles: 0, pieces: 0, packs: 0 },
  { value: 100, label: "€100", bundles: 0, pieces: 0, packs: 0 },
  { value: 50, label: "€50", bundles: 0, pieces: 0, packs: 0 },
  { value: 20, label: "€20", bundles: 0, pieces: 0, packs: 0 },
  { value: 10, label: "€10", bundles: 0, pieces: 0, packs: 0 },
  { value: 5, label: "€5", bundles: 0, pieces: 0, packs: 0 },
];

export function SmartTellerCalculator({ userId }: SmartTellerCalculatorProps) {
  const [nairaDenominations, setNairaDenominations] = useState(initialNairaDenominations);
  const [dollarDenominations, setDollarDenominations] = useState(initialDollarDenominations);
  const [gbpDenominations, setGBPDenominations] = useState(initialGBPDenominations);
  const [euroDenominations, setEuroDenominations] = useState(initialEuroDenominations);
  const [branchCode, setBranchCode] = useState("");
  const [branchName, setBranchName] = useState("");
  const [country, setCountry] = useState("");

  const updateDenomination = (
    currency: Currency,
    index: number,
    field: "bundles" | "pieces" | "packs",
    value: string
  ) => {
    const numValue = parseInt(value) || 0;

    const setters = {
      naira: setNairaDenominations,
      dollar: setDollarDenominations,
      gbp: setGBPDenominations,
      euro: setEuroDenominations,
    };

    const maps = {
      naira: nairaDenominations,
      dollar: dollarDenominations,
      gbp: gbpDenominations,
      euro: euroDenominations,
    };

    const newDenominations = [...maps[currency]];
    newDenominations[index] = { ...newDenominations[index], [field]: numValue };
    setters[currency](newDenominations);
  };

  const calculateRowTotal = (row: DenominationRow) => {
    const totalPieces = row.packs * 100 + row.bundles * 500 + row.pieces;
    return row.value * totalPieces;
  };

  const calculateCurrencyTotal = (denominations: DenominationRow[]) =>
    denominations.reduce((sum, row) => sum + calculateRowTotal(row), 0);

  const clearCurrency = (currency: Currency) => {
    const setters = {
      naira: setNairaDenominations,
      dollar: setDollarDenominations,
      gbp: setGBPDenominations,
      euro: setEuroDenominations,
    };

    const initials = {
      naira: initialNairaDenominations,
      dollar: initialDollarDenominations,
      gbp: initialGBPDenominations,
      euro: initialEuroDenominations,
    };

    setters[currency](initials[currency].map((d) => ({ ...d, bundles: 0, pieces: 0, packs: 0 })));
  };

  const handleSave = async (currency: Currency, denominations: DenominationRow[], symbol: string) => {
    const calculatorData = {
      currency,
      denomination_data: denominations,
      total_amount: calculateCurrencyTotal(denominations),
    };

    try {
      const supabase = getSupabase();
      const { error } = await supabase.from("calculator_data").insert({
        user_id: userId,
        branch_code: branchCode,
        branch_name: branchName,
        country,
        currency,
        denomination_data: denominations,
        total_amount: calculateCurrencyTotal(denominations),
      });

      if (error) throw error;
      alert(`${currency.toUpperCase()} calculation saved successfully!`);
    } catch {
      localStorage.setItem(`calculator_${currency}`, JSON.stringify(calculatorData));
      alert(`${currency.toUpperCase()} calculation saved to local storage`);
    }
  };

  const renderCurrencyTable = (currency: Currency, denominations: DenominationRow[], symbol: string) => (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-left font-semibold text-foreground">Denomination</th>
              <th className="p-3 text-center font-semibold text-foreground">Packs (×100)</th>
              <th className="p-3 text-center font-semibold text-foreground">Bundles (×500)</th>
              <th className="p-3 text-center font-semibold text-foreground">Pieces</th>
              <th className="p-3 text-right font-semibold text-foreground">Total</th>
            </tr>
          </thead>
          <tbody>
            {denominations.map((row, index) => (
              <tr key={row.label} className="border-t border-border hover:bg-muted/30">
                <td className="p-3 font-semibold text-foreground">{row.label}</td>
                <td className="p-3">
                  <Input
                    type="number"
                    min="0"
                    value={row.packs || ""}
                    onChange={(e) => updateDenomination(currency, index, "packs", e.target.value)}
                    placeholder="0"
                    className="text-center"
                  />
                </td>
                <td className="p-3">
                  <Input
                    type="number"
                    min="0"
                    value={row.bundles || ""}
                    onChange={(e) => updateDenomination(currency, index, "bundles", e.target.value)}
                    placeholder="0"
                    className="text-center"
                  />
                </td>
                <td className="p-3">
                  <Input
                    type="number"
                    min="0"
                    value={row.pieces || ""}
                    onChange={(e) => updateDenomination(currency, index, "pieces", e.target.value)}
                    placeholder="0"
                    className="text-center"
                  />
                </td>
                <td className="p-3 text-right font-mono font-semibold text-foreground">
                  {symbol} {calculateRowTotal(row).toLocaleString()}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-primary bg-primary/5">
              <td colSpan={4} className="p-3 text-right font-bold text-foreground">
                Total:
              </td>
              <td className="p-3 text-right font-mono text-lg font-bold text-primary">
                {symbol} {calculateCurrencyTotal(denominations).toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => clearCurrency(currency)}>
          <Trash2 className="mr-2 h-4 w-4" /> Clear {currency.toUpperCase()}
        </Button>
        <Button
          className="bg-gradient-to-r from-primary to-accent"
          onClick={() => handleSave(currency, denominations, symbol)}
        >
          <Save className="mr-2 h-4 w-4" /> Save Calculation
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Smart Teller Calculator</h1>
        <p className="text-muted-foreground">
          Calculate cash totals by denomination with bundles, pieces, and packs
        </p>
      </div>

      <BranchInfo
        branchCode={branchCode}
        branchName={branchName}
        country={country}
        onBranchCodeChange={setBranchCode}
        onBranchNameChange={setBranchName}
        onCountryChange={setCountry}
      />

      <div className="grid gap-6 lg:grid-cols-4">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-accent/10 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-card-foreground">
              <Banknote className="h-4 w-4" /> Naira Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">
              ₦{calculateCurrencyTotal(nairaDenominations).toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-card-foreground">
              <DollarSign className="h-4 w-4" /> Dollar Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              ${calculateCurrencyTotal(dollarDenominations).toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-card-foreground">
              <Banknote className="h-4 w-4" /> GBP Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              £{calculateCurrencyTotal(gbpDenominations).toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-gradient-to-br from-orange-500/10 to-red-500/10 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-card-foreground">
              <Banknote className="h-4 w-4" /> Euro Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              €{calculateCurrencyTotal(euroDenominations).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/20 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-card-foreground">
            <Calculator className="h-5 w-5" /> Cash Denominations Calculator
          </CardTitle>
          <CardDescription>
            Enter counts in packs (100 pieces), bundles (500 pieces), or individual pieces
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="naira" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="naira">Naira (₦)</TabsTrigger>
              <TabsTrigger value="dollar">Dollar ($)</TabsTrigger>
              <TabsTrigger value="gbp">GBP (£)</TabsTrigger>
              <TabsTrigger value="euro">Euro (€)</TabsTrigger>
            </TabsList>

            <TabsContent value="naira" className="mt-6">
              {renderCurrencyTable("naira", nairaDenominations, "₦")}
            </TabsContent>
            <TabsContent value="dollar" className="mt-6">
              {renderCurrencyTable("dollar", dollarDenominations, "$")}
            </TabsContent>
            <TabsContent value="gbp" className="mt-6">
              {renderCurrencyTable("gbp", gbpDenominations, "£")}
            </TabsContent>
            <TabsContent value="euro" className="mt-6">
              {renderCurrencyTable("euro", euroDenominations, "€")}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
