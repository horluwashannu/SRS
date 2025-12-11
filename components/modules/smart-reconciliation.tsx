"use client";
import React, { useEffect, useRef, useState, useMemo } from "react";
import * as XLSX from "xlsx";

import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle,
  AlertCircle,
  X,
  Trash2,
  Lock,
  Unlock,
  RefreshCcw,
  Undo2,
  Eye,
  Sun,
  Moon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

import { getSupabaseClient } from "@/lib/supabase";
function uid(): string { return Math.random().toString(36).slice(2, 9); }

/* Types */
type Side = "debit" | "credit";
type Status = "matched" | "pending" | "auto";

interface TransactionRow {
  Date: string;
  Narration: string;
  OriginalAmount: string;
  SignedAmount: number;
  IsNegative: boolean;
  AmountAbs: number;
  AmountType: "debit" | "credit";

  Age?: string | number;
  First15: string;
  Last15: string;
  HelperKey1: string;
  HelperKey2: string;
  BranchCode?: string;
  BranchName?: string;
  AccountName?: string;
  AccountNo?: string;
  Currency?: string;
  ProofTotal?: number;
  SystemBalance?: number;
  Maker?: string;
  Checker?: string;
  Rico?: string;
  Clco?: string;
  side?: Side;
  status?: Status;
  __id?: string;
  SheetName?: string;
}

interface ReconciliationSummary {
  matchedCount: number;
  pendingDebitCount: number;
  pendingCreditCount: number;
}

interface Props {
  userId: string | null;
}

/* Utilities (short names) */

/* Utilities (short names) */
function robustParseNumber(input: any): { value: number; isNegative: boolean; original: string } {
  if (input === undefined || input === null) {
    return { value: 0, isNegative: false, original: "" };
  }

  if (typeof input === "number") {
    return { value: input, isNegative: input < 0, original: String(input) };
  }

  const original = String(input).trim();
  // allow digits, signs, parentheses, comma, dot
  let s = original.replace(/[^0-9\-\(\)\.,+]/g, "").trim();

  let isNegative = false;
  if (s.startsWith("(") && s.endsWith(")")) {
    isNegative = true;
    s = "-" + s.slice(1, -1);
  }

  // remove grouping commas
  s = s.replace(/,/g, "");
  if (s === "" || s === "-" || s === "-.") {
    return { value: 0, isNegative: false, original };
  }

  const num = Number.parseFloat(s);
  if (Number.isNaN(num)) {
    return { value: 0, isNegative, original };
  }

  return { value: num, isNegative: isNegative || num < 0, original };
}

/* Absolute value helper */
function amountAbsOf(x: any): number {
  const parsed = robustParseNumber(x);
  return Math.abs(parsed.value);
}

function excelDateToJS(value: any): string {
  if (value === undefined || value === null || value === "") return "";
  if (value instanceof Date && !isNaN(value.getTime())) {
    const d = value;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()];
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }
  if (typeof value === "number") {
    try {
      const SSF = (XLSX as any).SSF;
      const dt = SSF && SSF.parse_date_code ? SSF.parse_date_code(value) : null;
      if (dt) {
        const dd = String(dt.d).padStart(2, "0");
        const mm = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][dt.m - 1];
        const yyyy = dt.y;
        return `${dd}-${mm}-${yyyy}`;
      }
      const epoch = new Date(Date.UTC(1899, 11, 30));
      const d = new Date(epoch.getTime() + value * 24 * 60 * 60 * 1000);
      if (!isNaN(d.getTime())) {
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()];
        const yyyy = d.getFullYear();
        return `${dd}-${mm}-${yyyy}`;
      }
    } catch (e) {
      // ignore
    }
  }
  return String(value).trim();
}

function formatDisplayNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return "0.00";
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizeLabel(s: string) {
  return s.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

const META_KEY_MAP: Record<string, string> = {
  branchcode: "BranchCode",
  "branch code": "BranchCode",
  branchname: "BranchName",
  "branch name": "BranchName",
  accountname: "AccountName",
  "account name": "AccountName",
  accountno: "AccountNo",
  "account no": "AccountNo",
  currency: "Currency",
  prooftotal: "ProofTotal",
  "proof total": "ProofTotal",
  systembalance: "SystemBalance",
  "system balance": "SystemBalance",
  maker: "Maker",
  checker: "Checker",
  rico: "Rico",
  clco: "Clco",
};

/* Component */
export function SmartReconciliation({ userId }: Props) {
  /* theme */
  const [darkMode, setDarkMode] = useState<boolean>(false);

  /* files */
  const [prevFile, setPrevFile] = useState<File | null>(null);
  const [currFile, setCurrFile] = useState<File | null>(null);
  const [allFile, setAllFile] = useState<File | null>(null);
  const fileInputPrevRef = useRef<HTMLInputElement | null>(null);
  const fileInputCurrRef = useRef<HTMLInputElement | null>(null);
  const fileInputAllRef = useRef<HTMLInputElement | null>(null);

  /* mode: 'multi' | 'one' | 'all' */
  const [mode, setMode] = useState<'multi' | 'one' | 'all'>('multi');

  /* stored uploads (multi) */
  const [uploadedPrevMulti, setUploadedPrevMulti] = useState<Array<{ sheet: string; rows: TransactionRow[]; proofTotal: number; meta: any; fileName?: string }>>([]);
  const [uploadedCurrMulti, setUploadedCurrMulti] = useState<Array<{ sheet: string; rows: TransactionRow[]; proofTotal: number; meta: any; fileName?: string }>>([]);

  /* legacy single-sheet arrays  */
  const [uploadedPrev, setUploadedPrev] = useState<TransactionRow[]>([]);
  const [uploadedCurr, setUploadedCurr] = useState<TransactionRow[]>([]);
  const [uploadedCurrRemaining, setUploadedCurrRemaining] = useState<TransactionRow[]>([]);
  const [autoKnockedOffCurr, setAutoKnockedOffCurr] = useState<TransactionRow[]>([]);

  /* all-in-one arrays */
  const [uploadedAll, setUploadedAll] = useState<TransactionRow[]>([]);
  const [uploadedAllDebits, setUploadedAllDebits] = useState<TransactionRow[]>([]);
  const [uploadedAllCredits, setUploadedAllCredits] = useState<TransactionRow[]>([]);

  /* parsing + logs */
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [lastParseLog, setLastParseLog] = useState<string>("");

  /* active sheets */
  const [activePrevSheet, setActivePrevSheet] = useState<string | null>(null);
  const [activeCurrSheet, setActiveCurrSheet] = useState<string | null>(null);

  /* sheet modal */
  const [sheetSelectionModalOpen, setSheetSelectionModalOpen] = useState(false);
  const [sheetCandidates, setSheetCandidates] = useState<Array<{ name: string; preview: any[]; fileName?: string }>>([]);
  const [sheetSelectionFor, setSheetSelectionFor] = useState<"previous" | "current" | null>(null);
  const [selectedPrevSheets, setSelectedPrevSheets] = useState<string[]>([]);
  const [selectedCurrSheets, setSelectedCurrSheets] = useState<string[]>([]);

  /* sheet expand */
  const [sheetExpanded, setSheetExpanded] = useState<Record<string, boolean>>({});

  /* results + UI */
  const [resultRows, setResultRows] = useState<TransactionRow[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [summary, setSummary] = useState<ReconciliationSummary>({ matchedCount: 0, pendingDebitCount: 0, pendingCreditCount: 0 });

  /* header/meta */
  const [branchCode, setBranchCode] = useState<string>("");
  const [branchName, setBranchName] = useState<string>("");
  const [accountName, setAccountName] = useState<string>("");
  const [accountNo, setAccountNo] = useState<string>("");
  const [currency, setCurrency] = useState<string>("NGN");
  const [maker, setMaker] = useState<string>("");
  const [checker, setChecker] = useState<string>("");
  const [rico, setRico] = useState<string>("");
  const [clco, setClco] = useState<string>("");

  const [systemBalanceInput, setSystemBalanceInput] = useState<string>("");
  const [systemBalance, setSystemBalance] = useState<number | null>(null);
  const [systemBalanceLocked, setSystemBalanceLocked] = useState<boolean>(false);

  const [sheetSystemBalances, setSheetSystemBalances] = useState<Record<string, number | null>>({});
  const [sheetProofs, setSheetProofs] = useState<Record<string, { matchedSum: number; itemCount: number; status: "pending" | "submitted" }>>({});

  /* manual match */
  const [manualAmount, setManualAmount] = useState<number | "">("");
  const [manualNarration, setManualNarration] = useState<string>("");
  const [amountFilter, setAmountFilter] = useState<number | "all">("all");

  /* selection */
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  /* undo */
  const [undoStack, setUndoStack] = useState<Array<{ resultRows: TransactionRow[]; summary: ReconciliationSummary; prevProofTotal: number; currProofTotal: number }>>([]);

  /* eye modal */
  const [eyePreviewModal, setEyePreviewModal] = useState<{ open: boolean; sheet?: string }>({ open: false });

  const [showMatchedSummary, setShowMatchedSummary] = useState<boolean>(false);

  /* restore session */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.uploadedPrevMulti) setUploadedPrevMulti(parsed.uploadedPrevMulti);
        if (parsed.uploadedCurrMulti) setUploadedCurrMulti(parsed.uploadedCurrMulti);
        if (parsed.uploadedAll) setUploadedAll(parsed.uploadedAll);
        if (parsed.uploadedAllDebits) setUploadedAllDebits(parsed.uploadedAllDebits);
        if (parsed.uploadedAllCredits) setUploadedAllCredits(parsed.uploadedAllCredits);
        if (parsed.resultRows) {
          setResultRows(parsed.resultRows);
          setShowResults(true);
        }
        if (parsed.summary) setSummary(parsed.summary);
        if (parsed.sheetSystemBalances) setSheetSystemBalances(parsed.sheetSystemBalances);
        if (parsed.sheetProofs) setSheetProofs(parsed.sheetProofs);
        if (parsed.activePrevSheet) setActivePrevSheet(parsed.activePrevSheet);
        if (parsed.activeCurrSheet) setActiveCurrSheet(parsed.activeCurrSheet);
        if (parsed.branchCode) setBranchCode(parsed.branchCode);
        if (parsed.branchName) setBranchName(parsed.branchName);
        if (parsed.accountName) setAccountName(parsed.accountName);
        if (parsed.accountNo) setAccountNo(parsed.accountNo);
        if (parsed.currency) setCurrency(parsed.currency);
        if (parsed.maker) setMaker(parsed.maker);
        if (parsed.checker) setChecker(parsed.checker);
        if (parsed.rico) setRico(parsed.rico);
        if (parsed.clco) setClco(parsed.clco);
        if (parsed.systemBalance !== undefined) setSystemBalance(parsed.systemBalance);
        if (parsed.systemBalanceInput) setSystemBalanceInput(parsed.systemBalanceInput);
        if (parsed.systemBalanceLocked) setSystemBalanceLocked(parsed.systemBalanceLocked);
        if (parsed.sheetExpanded) setSheetExpanded(parsed.sheetExpanded);
      }
    } catch (e) {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* persist snapshot */
  useEffect(() => {
    try {
      const snapshot = {
        uploadedPrevMulti,
        uploadedCurrMulti,
        uploadedAll,
        uploadedAllDebits,
        uploadedAllCredits,
        resultRows,
        summary,
        sheetSystemBalances,
        sheetProofs,
        activePrevSheet,
        activeCurrSheet,
        branchCode,
        branchName,
        accountName,
        accountNo,
        currency,
        maker,
        checker,
        rico,
        clco,
        systemBalance,
        systemBalanceInput,
        systemBalanceLocked,
        sheetExpanded,
      };
      localStorage.setItem(LS_KEY, JSON.stringify(snapshot));
    } catch (e) {
      // ignore
    }
  }, [
    uploadedPrevMulti,
    uploadedCurrMulti,
    uploadedAll,
    uploadedAllDebits,
    uploadedAllCredits,
    resultRows,
    summary,
    sheetSystemBalances,
    sheetProofs,
    activePrevSheet,
    activeCurrSheet,
    branchCode,
    branchName,
    accountName,
    accountNo,
    currency,
    maker,
    checker,
    rico,
    clco,
    systemBalance,
    systemBalanceInput,
    systemBalanceLocked,
    sheetExpanded,
  ]);

  /* Parsing single sheet with meta (kept mostly) */
  async function parseUploadedSheetWithMetadata(file: File) {
    const logLines: string[] = [];
    setUploadProgress(5);
    const arrayBuffer = await file.arrayBuffer();
    setUploadProgress(15);

    const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true, raw: true, defval: "" });
    setUploadProgress(25);

    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error("No sheets");
    }
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const sheetRef = sheet && sheet["!ref"] ? sheet["!ref"] : undefined;
    const readOptions: any = { header: 1, defval: "", blankrows: true };
    if (sheetRef) readOptions.range = sheetRef;

    const allRows: any[] = XLSX.utils.sheet_to_json(sheet, readOptions);
    setUploadProgress(40);
    logLines.push(`Rows: ${allRows.length}`);

    const meta: any = {};
    for (let r = 0; r < Math.min(allRows.length, 50); r++) {
      const row = allRows[r] || [];
      for (let c = 0; c < row.length; c++) {
        const cellRaw = row[c];
        if (cellRaw === null || cellRaw === undefined) continue;
        const cellText = String(cellRaw).trim();
        if (!cellText) continue;
        const norm = normalizeLabel(cellText);
        for (const mk of Object.keys(META_KEY_MAP)) {
          const mkNorm = normalizeLabel(mk);
          if (norm === mkNorm || norm.includes(mkNorm) || mkNorm.includes(norm)) {
            const valueCandidate = row[c + 1] ?? row[c + 2] ?? "";
            const field = META_KEY_MAP[mkNorm] ?? META_KEY_MAP[mk];
            if (field) {
              meta[field] = (valueCandidate === null || valueCandidate === undefined) ? "" : String(valueCandidate).trim();
              logLines.push(`meta '${mk}' -> '${meta[field]}' at r${r + 1}`);
            }
          }
        }
      }
    }

    let headerRowIndex: number | null = null;
    let headerCols: { dateIdx: number; narrationIdx: number; amountIdx: number; ageIdx: number } | null = null;
    for (let r = 0; r < Math.min(allRows.length, 40); r++) {
      const row = allRows[r] || [];
      const rowText = row.map((c: any) => String(c ?? "").toLowerCase()).join("|");
      if (rowText.includes("tran") && (rowText.includes("narr") || rowText.includes("narration")) && rowText.includes("amount")) {
        headerRowIndex = r;
        const lower = (row || []).map((c: any) => String(c ?? "").toLowerCase());
        const dateIdx = lower.findIndex((h: string) => h.includes("tran_date") || h.includes("tran date") || h.includes("transaction date") || h === "date" || h.includes("tran"));
        const narrationIdx = lower.findIndex((h: string) => h.includes("narr") || h.includes("description") || h.includes("narration") || h.includes("narrative"));
        const amountIdx = lower.findIndex((h: string) => h.includes("amount") || h.includes("amt"));
        const ageIdx = lower.findIndex((h: string) => h.includes("age") || h.includes("days"));
        headerCols = {
          dateIdx: dateIdx >= 0 ? dateIdx : 0,
          narrationIdx: narrationIdx >= 0 ? narrationIdx : 1,
          amountIdx: amountIdx >= 0 ? amountIdx : 2,
          ageIdx: ageIdx >= 0 ? ageIdx : 3,
        };
        logLines.push(`header r${r + 1} => ${JSON.stringify(headerCols)}`);
        break;
      }
    }

    let dataStartRow = 8;
    let mappingByHeader = false;
    if (headerRowIndex !== null && headerCols !== null) {
      dataStartRow = headerRowIndex + 1;
      mappingByHeader = true;
    } else {
      if (allRows.length < 9) dataStartRow = 0;
      logLines.push("no header; default start row 9");
    }

    const parsedRows: TransactionRow[] = [];
    let runningProofTotal = 0;
    let parsedCount = 0;
    let skippedCount = 0;

    for (let r = dataStartRow; r < allRows.length; r++) {
      const row = allRows[r] || [];
      const joinedUpper = row.map((c: any) => String(c ?? "").trim()).join(" ").toUpperCase();

      if (joinedUpper.includes("PROOF TOTAL")) {
        continue;
      }

      if (joinedUpper.includes("SYSTEM BALANCE")) {
        let sysIndex = -1;
        for (let c = 0; c < row.length; c++) {
          const cellText = String(row[c] ?? "").toUpperCase();
          if (cellText.includes("SYSTEM") && cellText.includes("BALANCE")) {
            sysIndex = c;
            break;
          }
        }
        if (sysIndex >= 0) {
          const candidate = row[sysIndex + 1];
          if (candidate !== undefined && candidate !== null && String(candidate).trim() !== "") {
            const parsed = robustParseNumber(candidate);
            meta.SystemBalance = parsed.value;
            logLines.push(`system balance ${parsed.value}`);
          } else {
            let fallbackVal: any = null;
            for (let c = sysIndex + 1; c < row.length; c++) {
              const tryCell = row[c];
              const parsedTry = robustParseNumber(tryCell);
              if (parsedTry && Number.isFinite(parsedTry.value) && parsedTry.original.trim() !== "") {
                fallbackVal = parsedTry.value;
                meta.SystemBalance = parsedTry.value;
                logLines.push(`system balance fallback ${parsedTry.value}`);
                break;
              }
            }
            if (fallbackVal === null) {
              // no value
            }
          }
        } else {
          let foundNum: number | null = null;
          for (let c = row.length - 1; c >= 0; c--) {
            const parsedTry = robustParseNumber(row[c]);
            if (parsedTry && Number.isFinite(parsedTry.value) && parsedTry.original.trim() !== "") {
              foundNum = parsedTry.value;
              meta.SystemBalance = parsedTry.value;
              logLines.push(`system balance found ${parsedTry.value}`);
              break;
            }
          }
        }
        break;
      }

      let rawDateCandidate: any = "";
      let rawNarrationCandidate: any = "";
      let rawAmountCandidate: any = "";
      let rawAgeCandidate: any = "";
      if (mappingByHeader && headerCols) {
        rawDateCandidate = row[headerCols.dateIdx] ?? "";
        rawNarrationCandidate = row[headerCols.narrationIdx] ?? "";
        rawAmountCandidate = row[headerCols.amountIdx] ?? "";
        rawAgeCandidate = row[headerCols.ageIdx] ?? "";
      } else {
        rawDateCandidate = row[0] ?? "";
        rawNarrationCandidate = row[1] ?? "";
        rawAmountCandidate = row[2] ?? "";
        rawAgeCandidate = row[3] ?? "";
      }

      const isRowEmpty = [rawDateCandidate, rawNarrationCandidate, rawAmountCandidate].every((v) => (v === "" || v === null || v === undefined));
      if (isRowEmpty) {
        skippedCount++;
        continue;
      }
      const parsedAmount = robustParseNumber(rawAmountCandidate);
      const numericAmount = parsedAmount.value;
      if (numericAmount === 0 && (!String(rawNarrationCandidate || "").trim()) && !rawDateCandidate) {
        skippedCount++;
        continue;
      }
      const dateStr = excelDateToJS(rawDateCandidate);
      const narrationClean = String(rawNarrationCandidate ?? "").replace(/\s+/g, " ").trim();
      const first15 = narrationClean.substring(0, 15).toUpperCase().trim();
      const last15 = narrationClean.slice(-15).toUpperCase().trim();
      const absAmount = Math.abs(numericAmount);
      const helper1 = `${first15}_${absAmount}`;
      const helper2 = `${last15}_${absAmount}`;
      const newRow: TransactionRow = {
        Date: dateStr || "",
        Narration: String(rawNarrationCandidate ?? ""),
        OriginalAmount: parsedAmount.original,
        SignedAmount: numericAmount,
        IsNegative: parsedAmount.isNegative,
        AmountAbs: Math.abs(numericAmount),
        AmountType: (numericAmount < 0 ? "debit" : "credit"),
        Age: rawAgeCandidate ?? undefined,
        First15: first15,
        Last15: last15,
        HelperKey1: helper1,
        HelperKey2: helper2,
        __id: uid(),
      };
      parsedRows.push(newRow);
      runningProofTotal += numericAmount;
      parsedCount++;
    }

    logLines.push(`parsed ${parsedCount}; skipped ${skippedCount}`);
    logLines.push(`running proof ${runningProofTotal}`);

    return {
      rows: parsedRows,
      meta,
      proofTotal: runningProofTotal,
      log: logLines.join("\n"),
    };
  }

  async function parseSpecificSheetFromWorkbookBuffer(buffer: ArrayBuffer, sheetName: string, fileNameHint = "sheet_extract.xlsx") {
    const wb: XLSX.WorkBook = XLSX.read(buffer, { type: "array", cellDates: true, raw: true, defval: "" });
    if (!wb.Sheets || !wb.Sheets[sheetName]) {
      throw new Error("Sheet not found");
    }
    const newWb: XLSX.WorkBook = { SheetNames: [sheetName], Sheets: { [sheetName]: wb.Sheets[sheetName] } };
    const outBuffer = XLSX.write(newWb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([outBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const file = new File([blob], fileNameHint, { type: blob.type });
    return parseUploadedSheetWithMetadata(file);
  }

  /* For All-in-One: parse sheet and split debit/credit */
  

  /* auto knock */
  function autoKnockOffWithinCurrent(rows: TransactionRow[]) {
    const used = new Set<number>();
    const knockedOff: TransactionRow[] = [];
    for (let i = 0; i < rows.length; i++) {
      if (used.has(i)) continue;
      const a = rows[i];
      const aAbs = amountAbsOf(a);
      for (let j = i + 1; j < rows.length; j++) {
        if (used.has(j)) continue;
        const b = rows[j];
        const bAbs = amountAbsOf(b);
        if (aAbs !== bAbs) continue;
        if ((a.SignedAmount ?? 0) * (b.SignedAmount ?? 0) >= 0) continue;
        const aKey1 = `${a.HelperKey1}_${aAbs}`;
        const aKey2 = `${a.HelperKey2}_${aAbs}`;
        const bKey1 = `${b.HelperKey1}_${bAbs}`;
        const bKey2 = `${b.HelperKey2}_${bAbs}`;
        const match =
          aKey1 === bKey1 ||
          aKey1 === bKey2 ||
          aKey2 === bKey1 ||
          aKey2 === bKey2;
        if (match) {
          used.add(i);
          used.add(j);
          const aCopy = { ...a, status: "auto" as Status };
          const bCopy = { ...b, status: "auto" as Status };
          knockedOff.push(aCopy);
          knockedOff.push(bCopy);
          break;
        }
      }
    }
    const remaining: TransactionRow[] = rows.filter((_, idx) => !used.has(idx));
    return { remaining, knockedOff };
  }

  /* match pairs */
  function matchPairs(
    debits: TransactionRow[],
    credits: TransactionRow[]
  ): {
    matchedPairs: { debit: TransactionRow; credit: TransactionRow }[];
    pendingDebits: TransactionRow[];
    pendingCredits: TransactionRow[];
  } {
    const creditIndex = new Map<string, number[]>();
    credits.forEach((c, idx) => {
      const k1 = `${c.HelperKey1}_${amountAbsOf(c)}`;
      const k2 = `${c.HelperKey2}_${amountAbsOf(c)}`;
      if (!creditIndex.has(k1)) creditIndex.set(k1, []);
      if (!creditIndex.has(k2)) creditIndex.set(k2, []);
      creditIndex.get(k1)!.push(idx);
      creditIndex.get(k2)!.push(idx);
    });
    const matchedPairs: { debit: TransactionRow; credit: TransactionRow }[] = [];
    const pendingDebits: TransactionRow[] = [];
    const usedCreditIdx = new Set<number>();
    for (const d of debits) {
      let foundIdx: number | null = null;
      const keysToTry = [
        `${d.HelperKey1}_${amountAbsOf(d)}`,
        `${d.HelperKey2}_${amountAbsOf(d)}`
      ];
      for (const k of keysToTry) {
        const arr = creditIndex.get(k);
        if (arr && arr.length) {
          const idx = arr.find((i) => !usedCreditIdx.has(i));
          if (idx !== undefined) {
            foundIdx = idx;
            break;
          }
        }
      }
      if (foundIdx !== null) {
        usedCreditIdx.add(foundIdx);
        matchedPairs.push({ debit: d, credit: credits[foundIdx] });
      } else {
        pendingDebits.push(d);
      }
    }
    const pendingCredits = credits.filter((_, i) => !usedCreditIdx.has(i));
    return { matchedPairs, pendingDebits, pendingCredits };
  }

  /* handle uploads (previous/current/all) */
  const handleFileUpload = async (file: File, fileType: "previous" | "current" | "all") => {
    try {
      setUploadProgress(2);
      if (!file.name.match(/.(xlsx|xls)$/i)) {
        alert("Please upload xlsx/.xls");
        return;
      }

      if (mode === "all" && fileType === "all") {
        // parse all-in-one
        const { rows, debits, credits, sheetName } = await parseAllInOne(file);
        setUploadedAll(rows);
        setUploadedAllDebits(debits);
        setUploadedAllCredits(credits);
        setAllFile(file);
        setLastParseLog(`${new Date().toISOString()} - ${file.name}\nAll-in-one parsed. Debits: ${debits.length}, Credits: ${credits.length}`);
        alert(`All-in-one parsed: D ${debits.length} • C ${credits.length}`);
        return;
      }

      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true, raw: true, defval: "" });

      if (mode === "multi" && workbook.SheetNames && workbook.SheetNames.length > 1) {
        const candidates = workbook.SheetNames.map((s) => {
          const sheet = workbook.Sheets[s];
          const preview = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false }).slice(0, 5);
          return { name: s, preview, fileName: file.name };
        });
        setSheetCandidates(candidates);
        setSheetSelectionFor(fileType === "previous" ? "previous" : "current");
        setSheetSelectionModalOpen(true);
        if (fileType === "previous") {
          (window as any).__smart_recon_last_prev_buffer = arrayBuffer;
          setPrevFile(file);
        } else {
          (window as any).__smart_recon_last_curr_buffer = arrayBuffer;
          setCurrFile(file);
        }
        setUploadProgress(0);
        alert(`Detected ${workbook.SheetNames.length} sheets — pick in modal.`);
        return;
      }

      const { rows, meta, proofTotal, log } = await parseUploadedSheetWithMetadata(file);

      if (meta.BranchCode && !branchCode) setBranchCode(String(meta.BranchCode));
      if (meta.BranchName && !branchName) setBranchName(String(meta.BranchName));
      if (meta.AccountName && !accountName) setAccountName(String(meta.AccountName));
      if (meta.AccountNo && !accountNo) setAccountNo(String(meta.AccountNo));
      if (meta.Currency && !currency) setCurrency(String(meta.Currency));
      if (meta.Maker && !maker) setMaker(String(meta.Maker));
      if (meta.Checker && !checker) setChecker(String(meta.Checker));
      if (meta.Rico && !rico) setRico(String(meta.Rico));
      if (meta.Clco && !clco) setClco(String(meta.Clco));
      if (meta.SystemBalance && !systemBalanceLocked) {
        const s = robustParseNumber(meta.SystemBalance);
        if (!isNaN(s.value) && s.value !== 0) {
          setSystemBalanceInput(String(s.value));
          setSystemBalance(s.value);
        }
      }

      if (fileType === "previous") {
        setUploadedPrev(rows);
        setPrevFile(file);
        setSheetProofs(prev => ({ ...prev, [accountName || file.name]: { matchedSum: 0, itemCount: rows.length, status: "pending" } }));
      } else {
        setUploadedCurr(rows);
        setCurrFile(file);
        const { remaining, knockedOff } = autoKnockOffWithinCurrent(rows);
        setUploadedCurrRemaining(remaining);
        setAutoKnockedOffCurr(knockedOff);
        setSheetProofs(prev => ({ ...prev, [accountName || file.name]: { matchedSum: 0, itemCount: rows.length, status: "pending" } }));
      }

      setLastParseLog(`${new Date().toISOString()} - ${file.name}\n${log}`);
      alert(`${fileType === "previous" ? "Prev" : "Curr"} parsed (${rows.length} rows).`);
    } catch (err: any) {
      console.error("Upload/parse error:", err);
      alert("Parse error");
      setLastParseLog(String(err?.message ?? err));
    } finally {
      setUploadProgress(0);
    }
  };

  /* confirm sheet selection (multi) */
  const confirmSheetSelection = async () => {
    if (!sheetSelectionFor) return;
    setSheetSelectionModalOpen(false);

    const bufferKey = sheetSelectionFor === "previous" ? "__smart_recon_last_prev_buffer" : "__smart_recon_last_curr_buffer";
    const buffer: ArrayBuffer | undefined = (window as any)[bufferKey];
    if (!buffer) {
      alert("Buffer missing — re-upload.");
      return;
    }

    const chosen = sheetSelectionFor === "previous" ? selectedPrevSheets : selectedCurrSheets;
    if (!chosen || chosen.length === 0) {
      alert("No sheets selected.");
      return;
    }

    for (const sheetName of chosen) {
      try {
        const result = await parseSpecificSheetFromWorkbookBuffer(buffer, sheetName, `${sheetName}.xlsx`);
        const withSheet = { sheet: sheetName, rows: result.rows.map(r => ({ ...r, SheetName: sheetName })), proofTotal: result.proofTotal, meta: result.meta, fileName: (sheetCandidates.find(s => s.name === sheetName)?.fileName) };
        if (sheetSelectionFor === "previous") {
          setUploadedPrevMulti(prev => {
            if (prev.some(p => p.sheet === sheetName)) return prev;
            return [...prev, withSheet];
          });
          if (!activePrevSheet) setActivePrevSheet(sheetName);
          if (result.meta && result.meta.SystemBalance !== undefined) {
            setSheetSystemBalances(s => ({ ...s, [sheetName]: Number(result.meta.SystemBalance) }));
          }
          setSheetProofs(prev => ({ ...prev, [sheetName]: { matchedSum: 0, itemCount: result.rows.length, status: "pending" } }));
          setSheetExpanded(prev => ({ ...prev, [sheetName]: false }));
        } else {
          const { remaining, knockedOff } = autoKnockOffWithinCurrent(result.rows);
          const withKnock = { sheet: sheetName, rows: result.rows.map(r => ({ ...r, SheetName: sheetName })), proofTotal: result.proofTotal, meta: result.meta, fileName: (sheetCandidates.find(s => s.name === sheetName)?.fileName) };
          setUploadedCurrMulti(prev => {
            if (prev.some(p => p.sheet === sheetName)) return prev;
            return [...prev, withKnock];
          });
          if (!activeCurrSheet) setActiveCurrSheet(sheetName);
          if (result.meta && result.meta.SystemBalance !== undefined) {
            setSheetSystemBalances(s => ({ ...s, [sheetName]: Number(result.meta.SystemBalance) }));
          }
          setAutoKnockedOffCurr(prev => [...prev, ...knockedOff.map(k => ({ ...k, SheetName: sheetName }))]);
          setSheetProofs(prev => ({ ...prev, [sheetName]: { matchedSum: 0, itemCount: result.rows.length, status: "pending" } }));
          setSheetExpanded(prev => ({ ...prev, [sheetName]: false }));
        }
      } catch (e) {
        // ignore
      }
    }

    delete (window as any)[bufferKey];
    setSelectedPrevSheets([]);
    setSelectedCurrSheets([]);
    alert("Sheets added.");
  };

  /* apply meta */
  const applySheetMetaToHeader = (meta: any) => {
    if (!meta) return;
    if (meta.BranchCode) setBranchCode(String(meta.BranchCode));
    if (meta.BranchName) setBranchName(String(meta.BranchName));
    if (meta.AccountName) setAccountName(String(meta.AccountName));
    if (meta.AccountNo) setAccountNo(String(meta.AccountNo));
    if (meta.Currency) setCurrency(String(meta.Currency));
    if (meta.Maker) setMaker(String(meta.Maker));
    if (meta.Checker) setChecker(String(meta.Checker));
    if (meta.Rico) setRico(String(meta.Rico));
    if (meta.Clco) setClco(String(meta.Clco));
    if (meta.SystemBalance && !systemBalanceLocked) {
      const s = robustParseNumber(meta.SystemBalance);
      if (!isNaN(s.value)) {
        setSystemBalanceInput(String(s.value));
        setSystemBalance(s.value);
      }
    } else {
      if (!systemBalanceLocked) {
        setSystemBalance(null);
        setSystemBalanceInput("");
      }
    }
  };

  const onSetActivePrevSheet = (sheetName: string) => {
    setActivePrevSheet(sheetName);
    const block = uploadedPrevMulti.find(u => u.sheet === sheetName);
    if (block && block.meta) applySheetMetaToHeader(block.meta);
    const existsInCurr = uploadedCurrMulti.some(u => u.sheet === sheetName);
    if (existsInCurr) {
      const should = confirm(`Sheet "${sheetName}" in Current. Auto-select?`);
      if (should) {
        setActiveCurrSheet(sheetName);
        const currBlock = uploadedCurrMulti.find(u => u.sheet === sheetName);
        if (currBlock && currBlock.meta) applySheetMetaToHeader(currBlock.meta);
      }
    }
  };

  const onSetActiveCurrSheet = (sheetName: string) => {
    setActiveCurrSheet(sheetName);
    const block = uploadedCurrMulti.find(u => u.sheet === sheetName);
    if (block && block.meta) applySheetMetaToHeader(block.meta);
    const existsInPrev = uploadedPrevMulti.some(u => u.sheet === sheetName);
    if (existsInPrev) {
      const should = confirm(`Sheet "${sheetName}" in Previous. Auto-select?`);
      if (should) {
        setActivePrevSheet(sheetName);
        const prevBlock = uploadedPrevMulti.find(u => u.sheet === sheetName);
        if (prevBlock && prevBlock.meta) applySheetMetaToHeader(prevBlock.meta);
      }
    }
  };

  /* pending sums */
  const computePendingSumForSheet = (sheetName?: string) => {
    if (!sheetName) return 0;
    const rowsForSheet = resultRows.filter(r => r.SheetName === sheetName && (r.status === "pending"));
    const sum = rowsForSheet.reduce((acc, r) => acc + amountAbsOf(r), 0);
    return sum;
  };

  const computePendingSumAll = () => {
    const rows = resultRows.filter(r => r.status === "pending");
    const sum = rows.reduce((acc, r) => acc + amountAbsOf(r), 0);
    return sum;
  };

  const computeMatchedSummaryForSheet = (sheetName?: string) => {
    if (!sheetName) return { matchedCount: 0, matchedAmount: 0 };
    const rowsForSheet = resultRows.filter(r => r.SheetName === sheetName && (r.status === "matched" || r.status === "auto"));
    const matchedCount = rowsForSheet.length;
    const matchedAmount = rowsForSheet.reduce((acc, r) => acc + amountAbsOf(r), 0) / 2;
    return { matchedCount, matchedAmount };
  };

  const computeMatchedSummaryAll = () => {
    const rows = resultRows.filter(r => r.status === "matched" || r.status === "auto");
    const matchedCount = rows.length;
    const matchedAmount = rows.reduce((acc, r) => acc + amountAbsOf(r), 0) / 2;
    return { matchedCount, matchedAmount };
  };

  /* run reconciliation (handles multi, one, all) */
  const runReconciliation = async () => {
    if (mode === "multi") {
      if (!activePrevSheet || !activeCurrSheet) {
        alert("Pick active sheets on both sides.");
        return;
      }

      if (activePrevSheet !== activeCurrSheet) {
        const ok = confirm(`Prev (${activePrevSheet}) and Curr (${activeCurrSheet}) differ. Continue?`);
        if (!ok) return;
      }

      const prevBlock = uploadedPrevMulti.find(b => b.sheet === activePrevSheet);
      const currBlock = uploadedCurrMulti.find(b => b.sheet === activeCurrSheet);
      if (!prevBlock || !currBlock) {
        alert("Active sheet missing.");
        return;
      }

      const debits = prevBlock.rows.map(r => ({ ...r, side: "debit" as const, SheetName: prevBlock.sheet }));
      const credits = currBlock.rows.map(r => ({ ...r, side: "credit" as const, SheetName: currBlock.sheet }));

      const firstPass = matchPairs(debits, credits);
      const secondPass = matchPairs(firstPass.pendingDebits, firstPass.pendingCredits);

      const allMatchedPairs = [...firstPass.matchedPairs, ...secondPass.matchedPairs];
      const finalPendingDebits = secondPass.pendingDebits;
      const finalPendingCredits = secondPass.pendingCredits;

      const results: TransactionRow[] = [
        ...allMatchedPairs.flatMap((p) => [
          { ...p.debit, status: "matched" as const, side: "debit" as const, SheetName: prevBlock.sheet },
          { ...p.credit, status: "matched" as const, side: "credit" as const, SheetName: currBlock.sheet },
        ]),
        ...finalPendingDebits.map((r) => ({ ...r, status: "pending" as const, side: "debit" as const, SheetName: prevBlock.sheet })),
        ...finalPendingCredits.map((r) => ({ ...r, status: "pending" as const, side: "credit" as const, SheetName: currBlock.sheet })),
      ];

      const matchedSum = allMatchedPairs.reduce((acc, p) => acc + amountAbsOf(p.debit), 0);

      const resultsWithMeta = results.map(row => ({
        ...row,
        BranchCode: branchCode || prevBlock.meta?.BranchCode || currBlock.meta?.BranchCode,
        BranchName: branchName || prevBlock.meta?.BranchName || currBlock.meta?.BranchName,
        AccountName: accountName || prevBlock.meta?.AccountName || currBlock.meta?.AccountName || prevBlock.sheet,
        AccountNo: accountNo || prevBlock.meta?.AccountNo || currBlock.meta?.AccountNo,
        Currency: currency || prevBlock.meta?.Currency || currBlock.meta?.Currency,
        Maker: maker || prevBlock.meta?.Maker || currBlock.meta?.Maker,
        Checker: checker || prevBlock.meta?.Checker || currBlock.meta?.Checker,
        Rico: rico || prevBlock.meta?.Rico || currBlock.meta?.Rico,
        Clco: clco || prevBlock.meta?.Clco || currBlock.meta?.Clco,
        SystemBalance: sheetSystemBalances[prevBlock.sheet] ?? undefined,
        ProofTotal: matchedSum,
      }));

      setResultRows(prev => [...prev, ...resultsWithMeta]);
      setSheetProofs(prev => ({ ...prev, [prevBlock.sheet]: { matchedSum, itemCount: resultsWithMeta.length, status: "pending" } }));
      setSummary(prev => ({
        matchedCount: prev.matchedCount + allMatchedPairs.length,
        pendingDebitCount: prev.pendingDebitCount + finalPendingDebits.length,
        pendingCreditCount: prev.pendingCreditCount + finalPendingCredits.length,
      }));

      try {
        const supabase = getSupabaseClient();
        if (supabase && userId) {
          const CHUNK = 200;
          for (let i = 0; i < resultsWithMeta.length; i += CHUNK) {
            const chunk = resultsWithMeta.slice(i, i + CHUNK);
            const insertPayload = chunk.map((row: any) => ({
              date: row.Date,
              narration: row.Narration,
              original_amount: row.OriginalAmount,
              signed_amount: row.SignedAmount,
              is_negative: row.IsNegative,
              first15: row.First15,
              last15: row.Last15,
              helper_key1: row.HelperKey1,
              helper_key2: row.HelperKey2,
              side: row.side,
              status: row.status,
              branch_code: row.BranchCode || "DEFAULT_BRANCH",
              account_no: row.AccountNo || null,
              account_name: row.AccountName || null,
              currency: row.Currency || null,
              proof_total: row.ProofTotal ?? null,
              system_balance: row.SystemBalance ?? null,
              maker: row.Maker || null,
              checker: row.Checker || null,
              rico: row.Rico || null,
              user_id: userId,
              sheet_name: prevBlock.sheet,
            }));
            const { error } = await supabase.from("reconciliation_results").insert(insertPayload);
            if (error) {
              console.error("Supabase insert error", error);
              throw error;
            }
          }
        } else {
          const existing = JSON.parse(localStorage.getItem("recon_results_temp") || "[]");
          localStorage.setItem("recon_results_temp", JSON.stringify([...existing, ...resultsWithMeta]));
        }
      } catch (err) {
        console.error("Save failed - fallback local", err);
        const existing = JSON.parse(localStorage.getItem("recon_results_temp") || "[]");
        localStorage.setItem("recon_results_temp", JSON.stringify([...existing, ...resultsWithMeta]));
      }

      alert(`Reconciled ${prevBlock.sheet}: ${allMatchedPairs.length} pairs • ₦${formatDisplayNumber(matchedSum)}`);
      setShowResults(true);
      return;
    }

    /* one-sheet fallback (legacy) */
    if (mode === "one") {
      if (!uploadedPrev.length || !uploadedCurr.length) {
        alert("Upload both Prev and Curr files.");
        return;
      }
      if (systemBalance === null) {
        alert("Lock system balance.");
        return;
      }
      const debits = uploadedPrev.map((r) => ({ ...r, side: "debit" as const }));
      const credits = uploadedCurrRemaining.map((r) => ({ ...r, side: "credit" as const }));

      const firstPass = matchPairs(debits, credits);
      const secondPass = matchPairs(firstPass.pendingDebits, firstPass.pendingCredits);

      const allMatchedPairs = [
        ...firstPass.matchedPairs,
        ...secondPass.matchedPairs,
      ];

      const finalPendingDebits = secondPass.pendingDebits;
      const finalPendingCredits = secondPass.pendingCredits;

      const results: TransactionRow[] = [
        ...allMatchedPairs.flatMap((p) => [
          { ...p.debit, status: "matched" as const, side: "debit" as const },
          { ...p.credit, status: "matched" as const, side: "credit" as const },
        ]),
        ...finalPendingDebits.map((r) => ({ ...r, status: "pending" as const, side: "debit" as const })),
        ...finalPendingCredits.map((r) => ({ ...r, status: "pending" as const, side: "credit" as const })),
      ];

      const matchedSum = allMatchedPairs.reduce((acc, p) => acc + amountAbsOf(p.debit), 0);

      const resultsWithMeta = results.map((row) => ({
        ...row,
        BranchCode: branchCode,
        BranchName: branchName,
        AccountName: accountName,
        AccountNo: accountNo,
        Currency: currency,
        Maker: maker,
        Checker: checker,
        Rico: rico,
        Clco: clco,
        SystemBalance: systemBalance ?? undefined,
        ProofTotal: matchedSum,
      }));

      setResultRows(resultsWithMeta);
      setShowResults(true);
      setSummary({ matchedCount: allMatchedPairs.length, pendingDebitCount: finalPendingDebits.length, pendingCreditCount: finalPendingCredits.length });

      setSheetProofs(prev => ({ ...prev, [accountName || "default"]: { matchedSum, itemCount: resultsWithMeta.length, status: "pending" } }));

      try {
        const supabase = getSupabaseClient();
        if (supabase && userId) {
          const CHUNK = 200;
          for (let i = 0; i < resultsWithMeta.length; i += CHUNK) {
            const chunk = resultsWithMeta.slice(i, i + CHUNK);
            const { error } = await supabase.from("reconciliation_results").insert(
              chunk.map((row) => ({
                date: row.Date,
                narration: row.Narration,
                original_amount: row.OriginalAmount,
                signed_amount: row.SignedAmount,
                is_negative: row.IsNegative,
                first15: row.First15,
                last15: row.Last15,
                helper_key1: row.HelperKey1,
                helper_key2: row.HelperKey2,
                side: row.side,
                status: row.status,
                branch_code: branchCode || "DEFAULT_BRANCH",
                account_no: accountNo || null,
                account_name: accountName || null,
                currency: currency || null,
                proof_total: row.ProofTotal ?? null,
                system_balance: row.SystemBalance ?? null,
                maker: maker || null,
                checker: checker || null,
                rico: rico || null,
                user_id: userId,
              }))
            );
            if (error) {
              console.error("Supabase insert error", error);
              throw error;
            }
          }
        } else {
          localStorage.setItem("recon_results_temp", JSON.stringify(resultsWithMeta));
        }
      } catch (err) {
        console.error("Save failed", err);
        localStorage.setItem("recon_results_temp", JSON.stringify(resultsWithMeta));
      }

      alert(`Done. Matched: ${allMatchedPairs.length} • ₦${formatDisplayNumber(matchedSum)}`);
      return;
    }

    /* All-in-One mode */
    if (mode === "all") {
      if (!uploadedAll || uploadedAll.length === 0) {
        alert("Upload the All-in-One sheet.");
        return;
      }
      // use uploadedAllDebits and uploadedAllCredits
      const debits = uploadedAllDebits.map(r => ({ ...r, side: "debit" as const }));
      const credits = uploadedAllCredits.map(r => ({ ...r, side: "credit" as const }));

      const firstPass = matchPairs(debits, credits);
      const secondPass = matchPairs(firstPass.pendingDebits, firstPass.pendingCredits);

      const allMatchedPairs = [...firstPass.matchedPairs, ...secondPass.matchedPairs];
      const finalPendingDebits = secondPass.pendingDebits;
      const finalPendingCredits = secondPass.pendingCredits;

      const results: TransactionRow[] = [
        ...allMatchedPairs.flatMap((p) => [
          { ...p.debit, status: "matched" as const, side: "debit" as const, SheetName: p.debit.SheetName },
          { ...p.credit, status: "matched" as const, side: "credit" as const, SheetName: p.credit.SheetName },
        ]),
        ...finalPendingDebits.map((r) => ({ ...r, status: "pending" as const, side: "debit" as const })),
        ...finalPendingCredits.map((r) => ({ ...r, status: "pending" as const, side: "credit" as const })),
      ];

      const matchedSum = allMatchedPairs.reduce((acc, p) => acc + amountAbsOf(p.debit), 0);

      const resultsWithMeta = results.map(row => ({
        ...row,
        BranchCode: branchCode,
        BranchName: branchName,
        AccountName: accountName || "AllInOne",
        AccountNo: accountNo,
        Currency: currency,
        Maker: maker,
        Checker: checker,
        Rico: rico,
        Clco: clco,
        SystemBalance: systemBalance ?? undefined,
        ProofTotal: matchedSum,
      }));

      setResultRows(prev => [...prev, ...resultsWithMeta]);
      setSummary(prev => ({
        matchedCount: prev.matchedCount + allMatchedPairs.length,
        pendingDebitCount: prev.pendingDebitCount + finalPendingDebits.length,
        pendingCreditCount: prev.pendingCreditCount + finalPendingCredits.length,
      }));

      try {
        const supabase = getSupabaseClient();
        if (supabase && userId) {
          const CHUNK = 200;
          for (let i = 0; i < resultsWithMeta.length; i += CHUNK) {
            const chunk = resultsWithMeta.slice(i, i + CHUNK);
            const insertPayload = chunk.map((row: any) => ({
              date: row.Date,
              narration: row.Narration,
              original_amount: row.OriginalAmount,
              signed_amount: row.SignedAmount,
              is_negative: row.IsNegative,
              first15: row.First15,
              last15: row.Last15,
              helper_key1: row.HelperKey1,
              helper_key2: row.HelperKey2,
              side: row.side,
              status: row.status,
              branch_code: row.BranchCode || "DEFAULT_BRANCH",
              account_no: row.AccountNo || null,
              account_name: row.AccountName || null,
              currency: row.Currency || null,
              proof_total: row.ProofTotal ?? null,
              system_balance: row.SystemBalance ?? null,
              maker: row.Maker || null,
              checker: row.Checker || null,
              rico: row.Rico || null,
              user_id: userId,
              sheet_name: row.SheetName || "AllInOne",
            }));
            const { error } = await supabase.from("reconciliation_results").insert(insertPayload);
            if (error) {
              console.error("Supabase insert error", error);
              throw error;
            }
          }
        } else {
          const existing = JSON.parse(localStorage.getItem("recon_results_temp") || "[]");
          localStorage.setItem("recon_results_temp", JSON.stringify([...existing, ...resultsWithMeta]));
        }
      } catch (err) {
        console.error("Save failed", err);
        const existing = JSON.parse(localStorage.getItem("recon_results_temp") || "[]");
        localStorage.setItem("recon_results_temp", JSON.stringify([...existing, ...resultsWithMeta]));
      }

      alert(`All-in-One done: ${allMatchedPairs.length} pairs • ₦${formatDisplayNumber(matchedSum)}`);
      setShowResults(true);
      return;
    }
  };

  /* export */
  const exportAll = () => {
    if (!resultRows || resultRows.length === 0) {
      alert("No results to export.");
      return;
    }
    const data = resultRows.map((r) => ({
      Date: r.Date,
      Narration: r.Narration,
      OriginalAmount: r.OriginalAmount,
      SignedAmount: r.SignedAmount,
      IsNegative: r.IsNegative,
      Side: r.side,
      Status: r.status,
      BranchCode: r.BranchCode,
      BranchName: r.BranchName,
      AccountName: r.AccountName,
      AccountNo: r.AccountNo,
      Currency: r.Currency,
      ProofTotal: r.ProofTotal,
      SystemBalance: r.SystemBalance,
      Maker: r.Maker,
      Checker: r.Checker,
      Rico: r.Rico,
      Clco: r.Clco,
      SheetName: r.SheetName,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ReconciliationResults");
    XLSX.writeFile(wb, "reconciliation_results.xlsx");
  };

  /* admin clear */
  const adminClearTemp = async () => {
    if (!confirm("Delete all temp results?")) return;
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.from("reconciliation_results").delete().neq("id", 0);
      }
      localStorage.removeItem("recon_results_temp");
      setResultRows([]);
      setShowResults(false);
      alert("Cleared");
    } catch (err) {
      console.error("Clear error", err);
    }
  };

  const clearAll = () => {
    if (!confirm("Clear all data?")) return;

    try {
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem("recon_prev");
      localStorage.removeItem("recon_curr");
      localStorage.removeItem("recon_curr_remaining");
      localStorage.removeItem("recon_auto_knocked_curr");
      localStorage.removeItem("recon_results_temp");
      localStorage.removeItem("proof_submissions");
    } catch (e) {
      // ignore
    }

    try {
      delete (window as any).__smart_recon_last_prev_buffer;
      delete (window as any).__smart_recon_last_curr_buffer;
    } catch (e) {
      // ignore
    }

    setPrevFile(null);
    setCurrFile(null);
    setAllFile(null);
    setUploadedPrev([]);
    setUploadedCurr([]);
    setUploadedCurrRemaining([]);
    setAutoKnockedOffCurr([]);
    setUploadedPrevMulti([]);
    setUploadedCurrMulti([]);
    setUploadedAll([]);
    setUploadedAllDebits([]);
    setUploadedAllCredits([]);
    setResultRows([]);
    setShowResults(false);
    setSummary({ matchedCount: 0, pendingDebitCount: 0, pendingCreditCount: 0 });
    setSelectedRows(new Set());
    setLastParseLog("");
    setSystemBalance(null);
    setSystemBalanceInput("");
    setSystemBalanceLocked(false);
    setBranchCode("");
    setBranchName("");
    setAccountName("");
    setAccountNo("");
    setCurrency("NGN");
    setMaker("");
    setChecker("");
    setRico("");
    setClco("");
    setActivePrevSheet(null);
    setActiveCurrSheet(null);
    setSheetSystemBalances({});
    setSheetProofs({});
    setUndoStack([]);
    setSheetCandidates([]);
    setSheetSelectionFor(null);
    setSelectedPrevSheets([]);
    setSelectedCurrSheets([]);
    setSheetExpanded({});
    alert("Reset done.");
  };

  /* undo */
  const pushUndo = (rows: TransactionRow[], summ: ReconciliationSummary, prevProof: number, currProof: number) => {
    setUndoStack((s) => {
      const copy = [...s];
      copy.unshift({ resultRows: rows, summary: summ, prevProofTotal: prevProof, currProofTotal: currProof });
      if (copy.length > 5) copy.splice(5);
      return copy;
    });
  };

  const undo = () => {
    if (undoStack.length === 0) {
      alert("Nothing to undo.");
      return;
    }
    const top = undoStack[0];
    setResultRows(top.resultRows);
    setSummary(top.summary);
    setUndoStack((s) => s.slice(1));
    alert("Undo applied.");
  };

  /* reset matches */
  const resetMatches = () => {
    if (!confirm("Reset matches?")) return;
    pushUndo(resultRows, summary, prevProofTotal, currProofTotal);
    const resetRows = resultRows.map((r) => ({ ...r, status: "pending" as Status }));
    setResultRows(resetRows);
    const pendingDeb = resetRows.filter((r) => (r.SignedAmount ?? 0) < 0).length;
    const pendingCred = resetRows.filter((r) => (r.SignedAmount ?? 0) > 0).length;
    setSummary({ matchedCount: 0, pendingDebitCount: pendingDeb, pendingCreditCount: pendingCred });
    setPrevProofTotal(0);
    setCurrProofTotal(0);
    alert("Matches reset.");
  };

  /* pending lists */
  const pendingDebits = useMemo(() => resultRows.filter((r) => r.status === "pending" && (r.SignedAmount ?? 0) < 0), [resultRows]);
  const pendingCredits = useMemo(() => resultRows.filter((r) => r.status === "pending" && (r.SignedAmount ?? 0) > 0), [resultRows]);
  const matchedList = useMemo(() => resultRows.filter((r) => r.status === "matched" || r.status === "auto"), [resultRows]);

  /* proof totals */
  const [prevProofTotal, setPrevProofTotal] = useState<number>(0);
  const [currProofTotal, setCurrProofTotal] = useState<number>(0);

  const activeSheetName = activePrevSheet || activeCurrSheet;
  const displayedProofTotal = useMemo(() => {
    if (activeSheetName) {
      return computePendingSumForSheet(activeSheetName);
    }
    return computePendingSumAll();
  }, [activeSheetName, resultRows, sheetProofs, uploadedPrev, uploadedCurr, uploadedPrevMulti, uploadedCurrMulti, uploadedAll]);

  const displayedSystemBalance = useMemo(() => {
    if (activeSheetName && sheetSystemBalances[activeSheetName] !== undefined) return sheetSystemBalances[activeSheetName];
    return systemBalance;
  }, [activeSheetName, sheetSystemBalances, systemBalance]);

  const displayedDiff = (displayedSystemBalance !== null && displayedSystemBalance !== undefined) ? displayedProofTotal - displayedSystemBalance : null;

  const matchedSummaryForActive = useMemo(() => {
    if (activeSheetName) return computeMatchedSummaryForSheet(activeSheetName);
    return computeMatchedSummaryAll();
  }, [activeSheetName, resultRows]);

  /* manual match helpers */
  const getPendingAmounts = () => {
    const amounts = new Set<number>();
    pendingDebits.forEach((d) => amounts.add(amountAbsOf(d)));
    pendingCredits.forEach((c) => amounts.add(amountAbsOf(c)));
    return Array.from(amounts).sort((a, b) => a - b);
  };

  const filteredPendingDebits = useMemo(() => {
    if (amountFilter === "all") return pendingDebits;
    return pendingDebits.filter((d) => amountAbsOf(d) === Number(amountFilter));
  }, [pendingDebits, amountFilter]);

  const filteredPendingCredits = useMemo(() => {
    if (amountFilter === "all") return pendingCredits;
    return pendingCredits.filter((c) => amountAbsOf(c) === Number(amountFilter));
  }, [pendingCredits, amountFilter]);

  const manualMatchSelected = async () => {
    if (!manualAmount || manualAmount === "") {
      alert("Pick amount.");
      return;
    }
    const amt = Number(manualAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      alert("Enter valid amount.");
      return;
    }

    const matchStr = (manualNarration || "").trim().toUpperCase();
    if (!matchStr) {
      alert("Enter narration fragment.");
      return;
    }

    const debCandidates = pendingDebits.filter((d) => amountAbsOf(d) === amt && String(d.Narration || "").toUpperCase().includes(matchStr));
    const credCandidates = pendingCredits.filter((c) => amountAbsOf(c) === amt && String(c.Narration || "").toUpperCase().includes(matchStr));

    if (debCandidates.length === 0 || credCandidates.length === 0) {
      alert("No matching rows.");
      return;
    }

    const debitRow = debCandidates[0];
    const creditRow = credCandidates[0];
    const debitGlobal = resultRows.findIndex((r) => r.__id === debitRow.__id);
    const creditGlobal = resultRows.findIndex((r) => r.__id === creditRow.__id);

    if (debitGlobal === -1 || creditGlobal === -1) {
      alert("Internal error.");
      return;
    }

    pushUndo(resultRows.map((r) => ({ ...r })), { ...summary }, prevProofTotal, currProofTotal);

    const newResults = [...resultRows];
    newResults[debitGlobal] = { ...newResults[debitGlobal], status: "matched", side: "debit" };
    newResults[creditGlobal] = { ...newResults[creditGlobal], status: "matched", side: "credit" };

    const newMatchedCount = summary.matchedCount + 1;
    const newPendingDebitCount = Math.max(0, summary.pendingDebitCount - 1);
    const newPendingCreditCount = Math.max(0, summary.pendingCreditCount - 1);

    const newProof = (prevProofTotal ?? 0) + amt;

    const updatedWithMeta = newResults.map((row) => ({
      ...row,
      BranchCode: branchCode,
      BranchName: branchName,
      AccountName: accountName,
      AccountNo: accountNo,
      Currency: currency,
      Maker: maker,
      Checker: checker,
      Rico: rico,
      Clco: clco,
      SystemBalance: displayedSystemBalance ?? undefined,
      ProofTotal: newProof,
    }));

    setResultRows(updatedWithMeta);
    setSummary({ matchedCount: newMatchedCount, pendingDebitCount: newPendingDebitCount, pendingCreditCount: newPendingCreditCount });
    setPrevProofTotal(newProof);
    setCurrProofTotal(newProof);

    try {
      const supabase = getSupabaseClient();
      const toInsert = [updatedWithMeta[debitGlobal], updatedWithMeta[creditGlobal]].map((row) => ({
        date: row.Date,
        narration: row.Narration,
        original_amount: row.OriginalAmount,
        signed_amount: row.SignedAmount,
        is_negative: row.IsNegative,
        first15: row.First15,
        last15: row.Last15,
        helper_key1: row.HelperKey1,
        helper_key2: row.HelperKey2,
        side: row.side,
        status: row.status,
        branch_code: branchCode || "DEFAULT_BRANCH",
        account_no: accountNo || null,
        account_name: accountName || null,
        currency: currency || null,
        proof_total: row.ProofTotal ?? null,
        system_balance: row.SystemBalance ?? null,
        maker: maker || null,
        checker: checker || null,
        rico: rico || null,
        user_id: userId,
      }));
      if (supabase && userId) {
        const { error } = await supabase.from("reconciliation_results").insert([toInsert[0], toInsert[1]]);
        if (error) {
          console.error("Supabase insert error", error);
          const existing = JSON.parse(localStorage.getItem("recon_results_temp") || "[]");
          localStorage.setItem("recon_results_temp", JSON.stringify([...existing, ...toInsert]));
        }
      } else {
        const existing = JSON.parse(localStorage.getItem("recon_results_temp") || "[]");
        localStorage.setItem("recon_results_temp", JSON.stringify([...existing, ...toInsert]));
      }
    } catch (err) {
      console.error("Manual match persist failed", err);
      const existing = JSON.parse(localStorage.getItem("recon_results_temp") || "[]");
      localStorage.setItem("recon_results_temp", JSON.stringify([...existing, ...([])]));
    }

    alert(`Matched ₦${formatDisplayNumber(amt)} for '${matchStr}'.`);
    setManualAmount("");
    setManualNarration("");
  };

  /* manual refresh */
  const manualRefreshUI = () => {
    setUploadProgress(5);
    setTimeout(() => {
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.uploadedPrevMulti) setUploadedPrevMulti(parsed.uploadedPrevMulti);
          if (parsed.uploadedCurrMulti) setUploadedCurrMulti(parsed.uploadedCurrMulti);
          if (parsed.uploadedAll) setUploadedAll(parsed.uploadedAll);
          if (parsed.resultRows) {
            setResultRows(parsed.resultRows);
            setShowResults(true);
          }
        }
      } catch (e) {
        // ignore
      }
      setUploadProgress(0);
      alert("UI refreshed.");
    }, 300);
  };

  /* submit proof */
  const submitProof = (sheetName?: string) => {
    if (sheetName) {
      const proof = sheetProofs[sheetName];
      if (!proof) { alert("No proof."); return; }
      if (!confirm(`Submit ${sheetName}? ₦${formatDisplayNumber(proof.matchedSum)} (${proof.itemCount})`)) return;
      try {
        const supabase = getSupabaseClient();
        if (supabase && userId) {
          supabase.from("reconciliation_proofs").insert({
            sheet_name: sheetName,
            matched_sum: proof.matchedSum,
            item_count: proof.itemCount,
            branch_code: branchCode || null,
            account_no: accountNo || null,
            account_name: accountName || null,
            user_id: userId,
          }).then(({ error }) => {
            if (error) console.error("Proof insert error", error);
          });
        }
      } catch (e) {
        console.error("Proof persist error", e);
      }
      setSheetProofs(prev => {
        const copy = { ...prev };
        if (copy[sheetName]) copy[sheetName].status = "submitted";
        return copy;
      });
      alert("Marked submitted.");
      return;
    }

    const pending = Object.entries(sheetProofs).filter(([s, i]) => i.status === "pending");
    if (pending.length === 0) { alert("No pending proofs."); return; }
    const confirmMsg = pending.map(([s, i]) => `${s}: ₦${formatDisplayNumber(i.matchedSum)} (${i.itemCount})`).join("\n");
    if (!confirm(`Submit these?\n\n${confirmMsg}`)) return;

    try {
      const supabase = getSupabaseClient();
      if (supabase && userId) {
        pending.forEach(([sheet, info]) => {
          supabase.from("reconciliation_proofs").insert({
            sheet_name: sheet,
            matched_sum: info.matchedSum,
            item_count: info.itemCount,
            branch_code: branchCode || null,
            account_no: accountNo || null,
            account_name: accountName || null,
            user_id: userId,
          }).then(({ error }) => {
            if (error) console.error("Proof insert error", error);
          });
        });
      }
    } catch (e) {
      console.error("Proof persist error", e);
    }

    setSheetProofs(prev => {
      const copy = { ...prev };
      for (const [s] of pending) {
        if (copy[s]) copy[s].status = "submitted";
      }
      return copy;
    });

    alert("Submitted.");
  };

  /* UI small components */
  function PreviewTableCompact({ data, limit = Infinity }: { data: TransactionRow[]; limit?: number }) {
    const rowsToShow = limit && limit > 0 ? data.slice(0, limit) : data;
    if (!data || data.length === 0) {
      return (
        <div className="rounded-lg border border-border bg-muted/50 p-2 text-center text-xs">
          <p className="text-xs text-muted-foreground">No data</p>
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead className="text-foreground">Date</TableHead>
              <TableHead className="text-foreground">Narration</TableHead>
              <TableHead className="text-right text-foreground">Amt</TableHead>
              <TableHead className="text-foreground">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rowsToShow.map((row, idx) => (
              <TableRow key={row.__id ?? idx} className="text-xs">
                <TableCell className="font-medium text-foreground py-1">{row.Date}</TableCell>
                <TableCell className="max-w-[360px] text-foreground whitespace-nowrap overflow-hidden text-ellipsis py-1" title={row.Narration}>{row.Narration}</TableCell>
                <TableCell className="text-right font-mono text-foreground py-1">₦{formatDisplayNumber(amountAbsOf(row))}</TableCell>
                <TableCell className="py-1"><Badge variant={row.status === "auto" ? "destructive" : row.status === "matched" ? "success" : "secondary"}>{row.status ?? "—"}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {data.length > limit && (
          <div className="p-2 text-xs text-muted-foreground">Showing {limit} of {data.length}</div>
        )}
      </div>
    );
  }

  function PreviewTableFull({ data }: { data: TransactionRow[] }) {
    if (!data || data.length === 0) {
      return <div className="text-xs text-muted-foreground">No rows</div>;
    }
    return (
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left">
              <th className="p-2">Date</th>
              <th className="p-2">Narration</th>
              <th className="p-2 text-right">Amt</th>
              <th className="p-2">Original</th>
              <th className="p-2">First15</th>
              <th className="p-2">Last15</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={row.__id ?? idx} className="border-t">
                <td className="p-2">{row.Date}</td>
                <td className="p-2 max-w-[600px] whitespace-pre-wrap">{row.Narration}</td>
                <td className="p-2 text-right font-mono">₦{formatDisplayNumber(row.SignedAmount)}</td>
                <td className="p-2">{row.OriginalAmount}</td>
                <td className="p-2">{row.First15}</td>
                <td className="p-2">{row.Last15}</td>
                <td className="p-2"><Badge variant={row.status === "auto" ? "destructive" : row.status === "matched" ? "success" : "secondary"}>{row.status ?? "—"}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const toggleSheetExpanded = (sheet: string) => {
    setSheetExpanded(prev => ({ ...prev, [sheet]: !prev[sheet] }));
  };

  /* UI Render */
  return (
    <div className={`${darkMode ? "dark" : ""}`}>
      <div className="space-y-4 p-4 bg-white dark:bg-slate-900 min-h-screen">
        <div className="sticky top-2 z-30">
          <Card>
            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">Active Sheet</div>
                  <div className="text-xl font-bold">{activePrevSheet ?? activeCurrSheet ?? (mode === "all" ? "All-in-One" : "—")}</div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Pending</div>
                  <div className="text-xl font-bold">₦{formatDisplayNumber(displayedProofTotal)}</div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">System</div>
                  <div className="text-xl font-bold">₦{formatDisplayNumber(displayedSystemBalance)}</div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Diff</div>
                  <div className={`text-xl font-bold ${displayedDiff === 0 ? "text-green-600" : "text-red-600"}`}>₦{formatDisplayNumber(displayedDiff)}</div>
                </div>

                <div className="ml-auto flex gap-2 items-center">
                  <Button variant="ghost" onClick={undo} className="gap-2"><Undo2 className="h-4 w-4" /> Undo ({undoStack.length})</Button>
                  <Button variant="outline" onClick={resetMatches} className="gap-2 text-sm"><Trash2 className="h-4 w-4" /> Reset</Button>
                  <Button variant="destructive" onClick={clearAll} className="gap-2 text-sm">Clear</Button>

                  <Button variant="ghost" onClick={() => setShowMatchedSummary(s => !s)} className="gap-2 text-sm" title="Matched">
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {showMatchedSummary && (
                <div className="mt-3 border-t pt-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <div className="font-medium">Matched</div>
                      <div className="text-xs text-muted-foreground">
                        Items: {matchedSummaryForActive.matchedCount} • Amt: ₦{formatDisplayNumber(matchedSummaryForActive.matchedAmount)}
                      </div>
                    </div>
                    <div>
                      <Button variant="outline" size="sm" onClick={() => {
                        const sheet = activeSheetName;
                        const matchedRows = sheet ? resultRows.filter(r => (r.status === "matched" || r.status === "auto") && r.SheetName === sheet) : resultRows.filter(r => r.status === "matched" || r.status === "auto");
                        if (!matchedRows || matchedRows.length === 0) {
                          alert("No matched rows.");
                          return;
                        }
                        const data = matchedRows.map((r) => ({
                          Date: r.Date,
                          Narration: r.Narration,
                          SignedAmount: r.SignedAmount,
                          Side: r.side,
                          SheetName: r.SheetName,
                        }));
                        const ws = XLSX.utils.json_to_sheet(data);
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, "MatchedSummary");
                        XLSX.writeFile(wb, `matched_summary_${sheet || "all"}.xlsx`);
                      }}>Export</Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Header + mode selector */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Smart Recon</h1>
            <p className="text-xs text-muted-foreground">Per-sheet or single-sheet</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-muted-foreground">Mode</div>
            <div className="inline-flex rounded-md overflow-hidden border">
              <button onClick={() => setMode('multi')} className={`px-3 py-1 text-xs ${mode === 'multi' ? "bg-primary text-white" : "bg-white dark:bg-slate-800"}`}>Multi</button>
              <button onClick={() => setMode('one')} className={`px-3 py-1 text-xs ${mode === 'one' ? "bg-primary text-white" : "bg-white dark:bg-slate-800"}`}>One</button>
              <button onClick={() => setMode('all')} className={`px-3 py-1 text-xs ${mode === 'all' ? "bg-primary text-white" : "bg-white dark:bg-slate-800"}`}>All-in-One</button>
            </div>
          </div>
        </div>

        {/* Account card */}
        <Card>
          <CardHeader>
            <CardTitle>Acct / Branch</CardTitle>
            <CardDescription className="text-xs">Values update when sheet active</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              <div>
                <label className="text-xs text-muted-foreground">Branch Code</label>
                <input value={branchCode} onChange={(e) => setBranchCode(e.target.value)} className="w-full border rounded px-2 py-1 text-sm bg-white dark:bg-slate-800" placeholder="D08" />
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Branch Name</label>
                <input value={branchName} onChange={(e) => setBranchName(e.target.value)} className="w-full border rounded px-2 py-1 text-sm bg-white dark:bg-slate-800" placeholder="Branch" />
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Account</label>
                <input value={accountName} onChange={(e) => setAccountName(e.target.value)} className="w-full border rounded px-2 py-1 text-sm bg-white dark:bg-slate-800" placeholder="Account name" />
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Acc No</label>
                <input value={accountNo} onChange={(e) => setAccountNo(e.target.value)} className="w-full border rounded px-2 py-1 text-sm bg-white dark:bg-slate-800" placeholder="155000014" />
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Currency</label>
                <input value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full border rounded px-2 py-1 text-sm bg-white dark:bg-slate-800" placeholder="NGN" />
              </div>

              <div>
                <label className="text-xs text-muted-foreground">System Bal</label>
                <div className="flex gap-2">
                  <input
                    value={systemBalanceInput}
                    onChange={(e) => setSystemBalanceInput(e.target.value)}
                    className="w-full border rounded px-2 py-1 text-sm bg-white dark:bg-slate-800"
                    placeholder="Enter and lock"
                    readOnly={systemBalanceLocked}
                  />
                  {!systemBalanceLocked ? (
                    <Button onClick={() => {
                      const parsed = robustParseNumber(systemBalanceInput);
                      if (!Number.isFinite(parsed.value)) {
                        alert("Invalid number.");
                        return;
                      }
                      setSystemBalance(parsed.value);
                      if (activePrevSheet) setSheetSystemBalances(s => ({ ...s, [activePrevSheet]: parsed.value }));
                      if (activeCurrSheet) setSheetSystemBalances(s => ({ ...s, [activeCurrSheet]: parsed.value }));
                      setSystemBalanceLocked(true);
                    }} className="gap-2 text-sm"><Lock className="h-4 w-4" /> Lock</Button>
                  ) : (
                    <Button variant="outline" onClick={() => {
                      if (!confirm("Unlock?")) return;
                      setSystemBalanceLocked(false);
                      setSystemBalance(null);
                      setSystemBalanceInput("");
                    }} className="gap-2 text-sm"><Unlock className="h-4 w-4" /> Unlock</Button>
                  )}
                </div>
                {systemBalance !== null && <div className="mt-1 text-sm text-muted-foreground">Locked: ₦{formatDisplayNumber(systemBalance)}</div>}
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Maker</label>
                <input value={maker} onChange={(e) => setMaker(e.target.value)} className="w-full border rounded px-2 py-1 text-sm bg-white dark:bg-slate-800" placeholder="Maker" />
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Checker</label>
                <input value={checker} onChange={(e) => setChecker(e.target.value)} className="w-full border rounded px-2 py-1 text-sm bg-white dark:bg-slate-800" placeholder="Checker" />
              </div>

              <div>
                <label className="text-xs text-muted-foreground">RICO</label>
                <input value={rico} onChange={(e) => setRico(e.target.value)} className="w-full border rounded px-2 py-1 text-sm bg-white dark:bg-slate-800" placeholder="Reconciler" />
              </div>

              <div>
                <label className="text-xs text-muted-foreground">CLCO</label>
                <input value={clco} onChange={(e) => setClco(e.target.value)} className="w-full border rounded px-2 py-1 text-sm bg-white dark:bg-slate-800" placeholder="Optional" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Uploads */}
        {mode === "all" ? (
          <div className="grid gap-4 md:grid-cols-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-primary" /> All-in-One Sheet</CardTitle>
                <CardDescription className="text-xs">One sheet with debits & credits</CardDescription>
              </CardHeader>
              <CardContent>
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 hover:bg-gray-50 text-sm">
                  <Upload className="mb-2 h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">{allFile ? allFile.name : "Click to upload"}</span>
                  <span className="mt-1 text-xs text-muted-foreground">.xlsx/.xls</span>
                  <input type="file" className="hidden" accept=".xlsx,xls" ref={fileInputAllRef} onChange={(e) => e.target.files?.[0] && (setAllFile(e.target.files[0]), handleFileUpload(e.target.files[0], "all"))} />
                </label>

                <div className="mt-3">
                  <div className="text-xs font-medium">Preview</div>
                  <div className="mt-2">
                    <div className="mb-2">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-medium">All</div>
                        <div className="text-xs text-muted-foreground">{uploadedAll.length} rows</div>
                      </div>
                      <PreviewTableCompact data={uploadedAll} limit={10} />
                    </div>

                    <div className="mb-2">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-medium">Debits</div>
                        <div className="text-xs text-muted-foreground">{uploadedAllDebits.length}</div>
                      </div>
                      <PreviewTableCompact data={uploadedAllDebits} limit={10} />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-medium">Credits</div>
                        <div className="text-xs text-muted-foreground">{uploadedAllCredits.length}</div>
                      </div>
                      <PreviewTableCompact data={uploadedAllCredits} limit={10} />
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <Button onClick={() => runReconciliation()} className="gap-2 text-xs"><FileSpreadsheet className="h-4 w-4" /> Reconcile</Button>
                    <Button variant="outline" onClick={() => { setUploadedAll([]); setUploadedAllDebits([]); setUploadedAllCredits([]); setAllFile(null); }} className="text-xs">Clear</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-primary" /> Previous</CardTitle>
                <CardDescription className="text-xs">Upload prev file</CardDescription>
              </CardHeader>
              <CardContent>
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 hover:bg-gray-50 text-sm">
                  <Upload className="mb-2 h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">{prevFile ? prevFile.name : "Click to upload"}</span>
                  <span className="mt-1 text-xs text-muted-foreground">.xlsx/.xls</span>
                  <input type="file" className="hidden" accept=".xlsx,xls" ref={fileInputPrevRef} onChange={(e) => e.target.files?.[0] && (setPrevFile(e.target.files[0]), handleFileUpload(e.target.files[0], "previous"))} />
                </label>

                <div className="mt-3 flex gap-2 items-center">
                  <Button variant="outline" onClick={() => {
                    if (sheetCandidates.length > 0 && sheetSelectionFor === "previous") {
                      setSheetSelectionModalOpen(true);
                    } else {
                      alert("Re-upload to open sheet selection.");
                    }
                  }}>Select Sheets</Button>

                  <Button variant="ghost" onClick={() => {
                    if (mode === "multi" && activePrevSheet) {
                      setEyePreviewModal({ open: true, sheet: activePrevSheet });
                    } else if (mode === "one" && uploadedPrev.length) {
                      setEyePreviewModal({ open: true, sheet: "legacy_prev" });
                    } else {
                      alert("No data.");
                    }
                  }}>Preview</Button>

                  <Button variant="outline" onClick={() => {
                    (async () => {
                      try {
                        const supabase = getSupabaseClient();
                        if (!supabase) {
                          alert("No DB.");
                          return;
                        }
                        const { data, error } = await supabase.from("reconciliation_results").select("sheet_name, account_name, branch_code").limit(200);
                        if (error) {
                          console.error("fetch error", error);
                          alert("DB fetch error");
                          return;
                        }
                        if (!data || data.length === 0) {
                          alert("No DB data.");
                          return;
                        }
                        const choices = Array.from(new Set(data.map((d: any) => d.sheet_name || d.account_name || d.branch_code))).slice(0, 50);
                        alert(`Fetched ${choices.length} accounts.`);
                      } catch (e) {
                        console.error("DB fetch failed", e);
                      }
                    })();
                  }}>Fetch DB</Button>
                </div>

                <div className="mt-2">
                  <div className="text-xs font-medium">Sheets</div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {uploadedPrevMulti.length === 0 ? <div className="text-xs text-muted-foreground">No sheets</div> : uploadedPrevMulti.map(m => (
                      <button key={m.sheet} onClick={() => onSetActivePrevSheet(m.sheet)} className={`px-3 py-1 rounded text-xs border ${activePrevSheet === m.sheet ? "bg-primary text-white" : "bg-white dark:bg-slate-800"}`}>
                        {m.sheet}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-2 text-xs text-muted-foreground">
                  <strong>Last Log:</strong>
                  <pre className="max-h-24 overflow-auto text-xs bg-gray-50 p-2 rounded">{lastParseLog || "—"}</pre>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-primary" /> Current</CardTitle>
                <CardDescription className="text-xs">Upload current</CardDescription>
              </CardHeader>
              <CardContent>
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 hover:bg-gray-50 text-sm">
                  <Upload className="mb-2 h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">{currFile ? currFile.name : "Click to upload"}</span>
                  <span className="mt-1 text-xs text-muted-foreground">.xlsx/.xls</span>
                  <input type="file" className="hidden" accept=".xlsx,xls" ref={fileInputCurrRef} onChange={(e) => e.target.files?.[0] && (setCurrFile(e.target.files[0]), handleFileUpload(e.target.files[0], "current"))} />
                </label>

                <div className="mt-3">
                  <div className="text-xs font-medium">Sheets</div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {uploadedCurrMulti.length === 0 ? <div className="text-xs text-muted-foreground">No sheets</div> : uploadedCurrMulti.map(m => (
                      <button key={m.sheet} onClick={() => onSetActiveCurrSheet(m.sheet)} className={`px-3 py-1 rounded text-xs border ${activeCurrSheet === m.sheet ? "bg-primary text-white" : "bg-white dark:bg-slate-800"}`}>
                        {m.sheet}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3">
                  <div className="text-xs text-muted-foreground">Auto Knocked-Off: {autoKnockedOffCurr.length}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Active sheet preview (multi) */}
        {mode === "multi" && (activePrevSheet || activeCurrSheet) && (
          <Card>
            <CardHeader>
              <CardTitle>Active Preview</CardTitle>
              <CardDescription className="text-xs">Full content for active sheets</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-3">
                <button onClick={() => {
                  if (!activePrevSheet) { alert("Select Prev."); return; }
                  setEyePreviewModal({ open: true, sheet: activePrevSheet });
                }} className="px-3 py-1 rounded text-xs bg-white dark:bg-slate-800 border">Prev</button>

                <button onClick={() => {
                  if (!activeCurrSheet) { alert("Select Curr."); return; }
                  setEyePreviewModal({ open: true, sheet: activeCurrSheet });
                }} className="px-3 py-1 rounded text-xs bg-white dark:bg-slate-800 border">Curr</button>

                <div className="ml-auto flex gap-2">
                  <Button onClick={() => runReconciliation()} className="gap-2 text-xs"><FileSpreadsheet className="h-4 w-4" /> Run</Button>
                  <Button variant="outline" onClick={() => { setActivePrevSheet(null); setActiveCurrSheet(null); }} className="text-xs">Clear</Button>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground">Compact:</div>
                  <div className="mt-2">
                    {activePrevSheet && (
                      <div className="mb-2">
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-medium">Prev — {activePrevSheet}</div>
                          <div className="text-xs text-muted-foreground">{uploadedPrevMulti.find(b => b.sheet === activePrevSheet)?.rows.length ?? 0} rows</div>
                        </div>
                        <PreviewTableCompact data={uploadedPrevMulti.find(b => b.sheet === activePrevSheet)?.rows || []} limit={sheetExpanded[activePrevSheet || ""] ? Infinity : 10} />
                      </div>
                    )}

                    {activeCurrSheet && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-medium">Curr — {activeCurrSheet}</div>
                          <div className="text-xs text-muted-foreground">{uploadedCurrMulti.find(b => b.sheet === activeCurrSheet)?.rows.length ?? 0} rows</div>
                        </div>
                        <PreviewTableCompact data={uploadedCurrMulti.find(b => b.sheet === activeCurrSheet)?.rows || []} limit={sheetExpanded[activeCurrSheet || ""] ? Infinity : 10} />
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex gap-2">
                    {(activePrevSheet || activeCurrSheet) && (
                      <Button onClick={() => {
                        const sheet = activePrevSheet || activeCurrSheet!;
                        toggleSheetExpanded(sheet);
                      }} className="text-xs">
                        {sheetExpanded[activePrevSheet || activeCurrSheet || ""] ? "Less" : "More"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Workspace tabs */}
        <Card>
          <CardHeader>
            <CardTitle>Workspace</CardTitle>
            <CardDescription className="text-xs">Manage pending/matched/manual/proof</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="pending" className="w-full">
              <TabsList className="grid w-full grid-cols-4 text-xs">
                <TabsTrigger value="pending">Pending ({summary.pendingDebitCount + summary.pendingCreditCount})</TabsTrigger>
                <TabsTrigger value="matched">Matched ({summary.matchedCount})</TabsTrigger>
                <TabsTrigger value="assist">Assist</TabsTrigger>
                <TabsTrigger value="proof">Proof</TabsTrigger>
              </TabsList>

              {/* Pending */}
              <TabsContent value="pending">
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <Card>
                    <CardHeader className="py-2">
                      <CardTitle className="text-sm">Debits ({pendingDebits.length})</CardTitle>
                      <CardDescription className="text-xs">Neg = Debit</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <SelectableTableCompact data={pendingDebits} selectedRows={selectedRows} onSelectionChange={setSelectedRows} allData={resultRows} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="py-2">
                      <CardTitle className="text-sm">Credits ({pendingCredits.length})</CardTitle>
                      <CardDescription className="text-xs">Pos = Credit</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <SelectableTableCompact data={pendingCredits} selectedRows={selectedRows} onSelectionChange={setSelectedRows} allData={resultRows} />
                    </CardContent>
                  </Card>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs">
                  <div className="text-muted-foreground">
                    {displayedSystemBalance !== null && (
                      <>
                        Pending: ₦{formatDisplayNumber(displayedProofTotal)} • System: ₦{formatDisplayNumber(displayedSystemBalance)}
                        {displayedDiff !== null && (
                          <span className={`ml-3 font-semibold ${displayedDiff === 0 ? "text-green-600" : "text-red-600"}`}>Diff: ₦{formatDisplayNumber(displayedDiff)}</span>
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={runReconciliation} className="gap-2 text-xs"><FileSpreadsheet className="h-4 w-4" /> Run</Button>
                    <Button variant="outline" onClick={resetMatches} className="gap-2 text-xs"><Trash2 className="h-4 w-4" /> Reset</Button>
                    <Button variant="ghost" onClick={() => exportAll()} className="gap-2 text-xs"><Download className="h-4 w-4" /> Export</Button>
                  </div>
                </div>
              </TabsContent>

              {/* Matched */}
              <TabsContent value="matched">
                <div className="mt-3">
                  <Card>
                    <CardHeader className="py-2">
                      <CardTitle className="text-sm">Matched</CardTitle>
                      <CardDescription className="text-xs">Matched & auto</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <PreviewTableCompact data={matchedList} limit={10} />
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Assist */}
              <TabsContent value="assist">
                <div className="mt-3">
                  <Card>
                    <CardHeader className="py-2 flex items-center justify-between">
                      <div>
                        <CardTitle className="text-sm">Manual Assist</CardTitle>
                        <CardDescription className="text-xs">Filter + match</CardDescription>
                      </div>
                      <div className="flex gap-2 items-center">
                        <div className="flex items-center gap-2">
                          <input
                            list="pending-amounts"
                            placeholder="Amount"
                            value={amountFilter === "all" ? "" : String(amountFilter)}
                            onChange={(e) => {
                              const v = e.target.value.trim();
                              if (v === "") setAmountFilter("all");
                              else setAmountFilter(Number(v));
                            }}
                            className="border rounded px-2 py-1 text-sm bg-white dark:bg-slate-800"
                          />
                          <datalist id="pending-amounts">
                            <option value="all">All</option>
                            {getPendingAmounts().map((a) => <option key={a} value={a}>{a}</option>)}
                          </datalist>
                        </div>

                        <Button variant="outline" size="sm" onClick={() => { setManualAmount(""); setManualNarration(""); setAmountFilter("all"); }} className="text-xs">Clear</Button>
                      </div>
                    </CardHeader>

                    <CardContent>
                      <div className="mb-3 flex flex-col md:flex-row gap-2 items-start">
                        <input
                          list="pending-amounts"
                          value={manualAmount === "" ? "" : String(manualAmount)}
                          onChange={(e) => setManualAmount(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder="Amount"
                          className="border rounded px-2 py-1 text-sm bg-white dark:bg-slate-800"
                        />
                        <input value={manualNarration} onChange={(e) => setManualNarration(e.target.value)} placeholder="Narration" className="border rounded px-2 py-1 text-sm w-full md:w-1/3 bg-white dark:bg-slate-800" />
                        <Button onClick={manualMatchSelected} className="text-sm">Match</Button>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <h4 className="text-xs font-medium mb-1">Debits</h4>
                          <PreviewTableCompact data={filteredPendingDebits} limit={10} />
                        </div>
                        <div>
                          <h4 className="text-xs font-medium mb-1">Credits</h4>
                          <PreviewTableCompact data={filteredPendingCredits} limit={10} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Proof */}
              <TabsContent value="proof">
                <div className="mt-3">
                  <Card>
                    <CardHeader className="py-2">
                      <CardTitle className="text-sm">Proof</CardTitle>
                      <CardDescription className="text-xs">Submit per sheet</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Object.keys(sheetProofs).length === 0 ? (
                          <div className="text-xs text-muted-foreground">No sheets</div>
                        ) : Object.entries(sheetProofs).map(([sheet, info]) => (
                          <div key={sheet} className="border rounded p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium">{sheet}</div>
                                <div className="text-xs text-muted-foreground">{info.itemCount} items</div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-sm font-semibold">₦{formatDisplayNumber(info.matchedSum)}</div>
                                <Badge variant={info.status === "pending" ? "secondary" : "success"}>{info.status}</Badge>
                                <Button variant="ghost" onClick={() => setEyePreviewModal({ open: true, sheet })} className="p-1"><Eye className="h-4 w-4" /></Button>

                                <Button variant="outline" size="sm" onClick={() => toggleSheetExpanded(sheet)} className="text-xs">
                                  {sheetExpanded[sheet] ? "Less" : "More"}
                                </Button>

                                <Button onClick={() => submitProof(sheet)} size="sm" className="text-xs">Submit</Button>
                              </div>
                            </div>

                            <div className="mt-3 grid md:grid-cols-2 gap-3">
                              <div>
                                <div className="text-xs font-medium mb-1">Prev — {sheet}</div>
                                <PreviewTableCompact data={uploadedPrevMulti.find(b => b.sheet === sheet)?.rows || []} limit={sheetExpanded[sheet] ? Infinity : 10} />
                              </div>
                              <div>
                                <div className="text-xs font-medium mb-1">Curr — {sheet}</div>
                                <PreviewTableCompact data={uploadedCurrMulti.find(b => b.sheet === sheet)?.rows || []} limit={sheetExpanded[sheet] ? Infinity : 10} />
                              </div>
                            </div>
                          </div>
                        ))}

                        {Object.keys(sheetProofs).length > 0 && (
                          <div className="flex gap-2">
                            <Button onClick={() => submitProof()} className="gap-2">Submit All</Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Eye modal */}
        {eyePreviewModal.open && eyePreviewModal.sheet && (
          <div className="fixed inset-0 z-50 flex items-start justify-center p-6">
            <div className="absolute inset-0 bg-black opacity-40" onClick={() => setEyePreviewModal({ open: false })} />
            <div className="relative bg-white dark:bg-slate-800 w-full max-w-6xl rounded-lg p-4 shadow-lg z-60">
              <div className="flex items-center justify-between">
                <div className="font-semibold">Full Preview — {eyePreviewModal.sheet}</div>
                <Button variant="ghost" onClick={() => setEyePreviewModal({ open: false })}><X className="h-4 w-4" /></Button>
              </div>
              <div className="mt-3">
                {uploadedPrevMulti.find(b => b.sheet === eyePreviewModal.sheet) ? (
                  <>
                    <div className="mb-4"><div className="font-medium">Prev — {eyePreviewModal.sheet}</div></div>
                    <PreviewTableFull data={uploadedPrevMulti.find(b => b.sheet === eyePreviewModal.sheet)!.rows} />
                  </>
                ) : null}

                {uploadedCurrMulti.find(b => b.sheet === eyePreviewModal.sheet) ? (
                  <>
                    <div className="mt-4 mb-4"><div className="font-medium">Curr — {eyePreviewModal.sheet}</div></div>
                    <PreviewTableFull data={uploadedCurrMulti.find(b => b.sheet === eyePreviewModal.sheet)!.rows} />
                  </>
                ) : null}

                {mode === "all" && uploadedAll.length > 0 && eyePreviewModal.sheet === "All-in-One" && (
                  <>
                    <div className="mt-4 mb-4"><div className="font-medium">All-in-One</div></div>
                    <PreviewTableFull data={uploadedAll} />
                    <div className="mt-4"><div className="font-medium">Debits</div></div>
                    <PreviewTableFull data={uploadedAllDebits} />
                    <div className="mt-4"><div className="font-medium">Credits</div></div>
                    <PreviewTableFull data={uploadedAllCredits} />
                  </>
                )}

                <div className="mt-4">
                  <div className="font-medium">Results — {eyePreviewModal.sheet}</div>
                  <PreviewTableFull data={resultRows.filter(r => r.SheetName === eyePreviewModal.sheet || (mode === "all" && eyePreviewModal.sheet === "All-in-One"))} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sheet selection modal */}
        {sheetSelectionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-black opacity-40" onClick={() => setSheetSelectionModalOpen(false)} />
            <div className="relative bg-white dark:bg-slate-800 w-full max-w-3xl rounded-lg p-4 shadow-lg z-60">
              <div className="flex items-center justify-between">
                <div className="font-semibold">Select Sheets ({sheetSelectionFor})</div>
                <Button variant="ghost" onClick={() => setSheetSelectionModalOpen(false)}><X className="h-4 w-4" /></Button>
              </div>

              <div className="mt-3 space-y-2">
                {sheetCandidates.map((c) => {
                  const checked = sheetSelectionFor === "previous" ? selectedPrevSheets.includes(c.name) : selectedCurrSheets.includes(c.name);
                  return (
                    <div key={c.name} className="flex items-center justify-between border rounded p-2">
                      <div>
                        <div className="font-medium text-sm">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.preview && c.preview.length > 0 ? `${c.preview.length} sample rows` : "No preview"}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={checked} onChange={(e) => {
                          if (sheetSelectionFor === "previous") {
                            setSelectedPrevSheets(prev => e.target.checked ? [...prev, c.name] : prev.filter(s => s !== c.name));
                          } else {
                            setSelectedCurrSheets(prev => e.target.checked ? [...prev, c.name] : prev.filter(s => s !== c.name));
                          }
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSheetSelectionModalOpen(false)}>Cancel</Button>
                <Button onClick={confirmSheetSelection}>Add</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* Small selectable table */
function SelectableTableCompact({
  data,
  selectedRows,
  onSelectionChange,
  allData,
}: {
  data: TransactionRow[];
  selectedRows: Set<number>;
  onSelectionChange: (selected: Set<number>) => void;
  allData: TransactionRow[];
}) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/50 p-2 text-center text-xs">
        <p className="text-xs text-muted-foreground">No pending</p>
      </div>
    );
  }

  const toggleRow = (index: number) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(index)) newSelected.delete(index);
    else newSelected.add(index);
    onSelectionChange(newSelected);
  };

  const toggleAll = () => {
    if (selectedRows.size === data.length) {
      onSelectionChange(new Set());
      return;
    }
    const allIndices = data.map((d) => allData.findIndex((ad) => ad.__id === d.__id)).filter((i) => i !== -1);
    onSelectionChange(new Set(allIndices));
  };

  return (
    <div className="rounded-lg border border-border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="text-xs">
            <TableHead className="w-12"><Checkbox checked={selectedRows.size === data.length && data.length > 0} onCheckedChange={toggleAll} /></TableHead>
            <TableHead className="text-foreground">Date</TableHead>
            <TableHead className="text-foreground">Narration</TableHead>
            <TableHead className="text-right text-foreground">Amt</TableHead>
            <TableHead className="text-foreground">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, i) => {
            const globalIndex = allData.findIndex((ad) => ad.__id === row.__id);
            return (
              <TableRow key={row.__id ?? i} className="text-xs">
                <TableCell className="py-1"><Checkbox checked={selectedRows.has(globalIndex)} onCheckedChange={() => toggleRow(globalIndex)} /></TableCell>
                <TableCell className="font-medium text-foreground py-1">{row.Date}</TableCell>
                <TableCell className="max-w-[360px] text-foreground whitespace-nowrap overflow-hidden text-ellipsis py-1" title={row.Narration}>{row.Narration}</TableCell>
                <TableCell className="text-right font-mono text-foreground py-1">₦{formatDisplayNumber(amountAbsOf(row))}</TableCell>
                <TableCell className="py-1"><Badge variant={row.status === "auto" ? "destructive" : row.status === "matched" ? "success" : "secondary"}>{row.status}</Badge></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/* prevent refresh & keep-alive */

export default SmartReconciliation;

/* ===== auto-added helpers BEGIN ===== */
export type AmountNormalization = {
  OriginalAmount: string | number;
  SignedAmount: number;
  AmountAbs: number;
  AmountType: "debit" | "credit" | "unknown";
};

export function normalizeAmount(input: string | number | null | undefined): AmountNormalization {
  const OriginalAmount = input === null || input === undefined ? "" : input;
  try {
    if (typeof input === "number") {
      const SignedAmount = Number(input);
      const AmountAbs = Math.abs(SignedAmount);
      const AmountType = SignedAmount < 0 ? "debit" : (SignedAmount > 0 ? "credit" : "unknown");
      return { OriginalAmount, SignedAmount, AmountAbs, AmountType };
    }
    let s = String(input).trim();
    s = s.replace(/[\u00A0\s]+/g, "");
    s = s.replace(/[^0-9().,+-]/g, "");
    let negative = false;
    if (/^(.*)$/.test(s)) {
      negative = true;
      s = s.replace(/^(|)$/g, "");
    }
    s = s.replace(/[, ]+/g, "");
    const n = Number(s);
    const SignedAmount = Number.isFinite(n) ? (negative ? -n : n) : 0;
    const AmountAbs = Math.abs(SignedAmount);
    const AmountType = SignedAmount < 0 ? "debit" : (SignedAmount > 0 ? "credit" : "unknown");
    return { OriginalAmount, SignedAmount, AmountAbs, AmountType };
  } catch (e) {
    return { OriginalAmount, SignedAmount: 0, AmountAbs: 0, AmountType: "unknown" };
  }
}

export type ParsedRow = Record<string, string | number | null>;
export type ParseOptions = { hasHeader?: boolean; delimiter?: string; maxRows?: number; };

function stripFormula(value: string): string {
  if (typeof value !== "string") return value;
  if (value.startsWith("=") && !value.startsWith("==")) {
    return value.slice(1);
  }
  return value;
}

export function parseCSV(text: string, opts?: ParseOptions): { header: string[]; rows: ParsedRow[] } {
  const options = { hasHeader: true, delimiter: ",", maxRows: 200000, ...(opts || {}) };
  const delim = options.delimiter!;
  const lines = text.split(/\r?\n/);
  const safeLines = lines.slice(0, options.maxRows).filter(l => l.length > 0);
  const rows: string[][] = [];
  for (const line of safeLines) {
    const row: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i+1] === '"') { cur += '"'; i++; continue; }
        inQuotes = !inQuotes;
        continue;
      }
      if (!inQuotes && ch === delim) {
        row.push(stripFormula(cur));
        cur = "";
        continue;
      }
      cur += ch;
    }
    row.push(stripFormula(cur));
    rows.push(row);
  }
  let header: string[] = [];
  const parsed: ParsedRow[] = [];
  if (options.hasHeader && rows.length > 0) {
    header = rows[0].map((h, idx) => (h && String(h).trim().length > 0 ? String(h).trim() : `col_${idx+1}`));
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const obj: ParsedRow = {};
      for (let j = 0; j < header.length; j++) {
        obj[header[j]] = (j < r.length ? (r[j] === "" ? null : r[j]) : null);
      }
      parsed.push(obj);
    }
  } else {
    const maxCols = rows.length > 0 ? Math.max(...rows.map(r => r.length)) : 0;
    header = Array.from({length: maxCols}, (_,i)=>`col_${i+1}`);
    for (const r of rows) {
      const obj: ParsedRow = {};
      for (let j = 0; j < header.length; j++) {
        obj[header[j]] = (j < r.length ? (r[j] === "" ? null : r[j]) : null);
      }
      parsed.push(obj);
    }
  }
  return { header, rows: parsed };
}

export type Sheet = { name: string; rows: ParsedRow[] };

  const unmatchedB: ParsedRow[] = [];
  for (const r of rowsB) {
    const n = normalizeAmount(r[amountColB] as any);
    (r as any).__amount = n;
    const candidates = mapA.get(n.AmountAbs);
    if (candidates && candidates.length > 0) {
      matches.push({ left: candidates.shift()!, right: r });
    } else {
      unmatchedB.push(r);
    }
  }
  const unmatchedA = Array.from(mapA.values()).flat();

function finalizeReconciliation(matches, mapA, unmatchedB) {
  

return { matches, unmatchedA, unmatchedB };
}

export async function heavyParseServerSide(csvText: string, opts?: ParseOptions) {
  return parseCSV(csvText, opts);
}
/* ===== auto-added helpers END ===== */

// --- AUTO PATCH: normalizeRow + parseAllInOne ---

function normalizeRow(raw: any, sheetName: string): any {
  const { value, isNegative, original } = robustParseNumber(raw?.Amount);
  const numericAmount = value ?? 0;
  const narration = String(raw?.Narration || "").trim();
  const first15 = narration.slice(0, 15);
  const last15 = narration.slice(-15);

  return {
    Date: excelDateToJS(raw?.Date),
    Narration: narration,
    OriginalAmount: original,
    SignedAmount: numericAmount,
    IsNegative: isNegative,
    AmountAbs: Math.abs(numericAmount),
    AmountType: numericAmount < 0 ? "debit" : "credit",
    First15: first15,
    Last15: last15,
    HelperKey1: (first15 + last15).toLowerCase(),
    HelperKey2: String(numericAmount),
    SheetName: sheetName,
    __id: uid(),
  };
}

async function parseAllInOne(file: File) {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });

  const collected: any[] = [];

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

    for (const raw of rawRows) {
      const row = normalizeRow(raw, sheetName);
      collected.push(row);
    }
  }

  const debits = collected.filter(r => r.AmountType === "debit");
  const credits = collected.filter(r => r.AmountType === "credit");

  setUploadedAll(collected);
  setUploadedAllDebits(debits);
  setUploadedAllCredits(credits);
}

// --- END AUTO PATCH ---
