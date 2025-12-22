"use client";
export const runtime = "nodejs"
import React, { useEffect, useMemo, useState } from "react"
import * as XLSX from "xlsx"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Upload,
  FileSpreadsheet,
  Calendar,
  User,
  Eye,
  Filter,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Database,
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

/**
 * SmartCallOver.tsx (updated)
 * - Preserves original structure
 * - Replaces parsePdfRebuilder with improved, flexible parsing
 * - NIP/NEFT preview uses Smart Teller exceptions UI and behavior
 */

/* ---------------------------
   Helpers & constants
   --------------------------- */
const normalize = (v: any) => {
  if (v === null || v === undefined) return ""
  return String(v).replace(/\r?\n|\t/g, " ").replace(/\s+/g, " ").trim()
}

const sleep = (ms = 0) => new Promise((r) => setTimeout(r, ms))

const BANK_KEYWORDS = [
  "Access Bank",
  "Zenith Bank",
  "First Bank",
  "First Bank of",
  "GTBank",
  "GTBank Plc",
  "Wema Bank",
  "Sterling Bank",
  "UBA",
  "Union Bank",
  "Fidelity",
  "Polaris",
  "Moniepoint",
  "OPAY",
  "Ecobank",
  "Keystone Bank",
  "FCMB",
  "Kuda",
]

const SMART_TELLER_HEADERS = [
  "Cr Ccy",
  "Cr Amount",
  "Lcy Amount",
  "Narration",
  "Cr Acc Brn Code",
  "Dr Ccy",
  "Dr Amount",
  "Dr Account Number",
  "Cr Account No",
  "Dr Acc Brn Code",
  "Trans Date",
  "Teller Id",
]

/* ---------------------------
   Excel parsers (unchanged)
   --------------------------- */
const parseSmartTellerGL = async (file: File) => {
  try {
    const data = await file.arrayBuffer()
    const workbook = XLSX.read(data, { type: "array" })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const jsonData: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" })

    const parsed = jsonData.map((row) => {
      const filtered: Record<string, any> = {}
      SMART_TELLER_HEADERS.forEach((header) => {
        if (row[header] !== undefined) filtered[header] = row[header]
        else {
          const key = Object.keys(row).find((k) => String(k).trim().toLowerCase() === header.trim().toLowerCase())
          filtered[header] = key ? row[key] : ""
        }
      })
      return filtered
    })

    const clean = parsed.filter(
      (r) =>
        (r["Dr Account Number"] && String(r["Dr Account Number"]).trim() !== "") ||
        (r["Cr Account No"] && String(r["Cr Account No"]).trim() !== "")
    )

    const mapped = clean.map((r, idx) => ({
      "BRANCH CODE": r["Dr Acc Brn Code"] || r["Cr Acc Brn Code"] || "",
      "ACCOUNT NUMBER": r["Dr Account Number"] || r["Cr Account No"] || "",
      "NARRATION": r["Narration"] || "",
      "CURRENCY": r["Cr Ccy"] || r["Dr Ccy"] || "",
      "AMOUNT": r["Cr Amount"] || r["Dr Amount"] || r["Lcy Amount"] || "",
      "TRANSACTION DATE": r["Trans Date"] || "",
      "USER ID": r["Teller Id"] || "",
      raw: r,
      __type: (r["Dr Account Number"] && String(r["Dr Account Number"]).trim() !== "") ? "debit" : "credit",
      // exception flags - default false
      bvnChecked: false,
      alterChecked: false,
      amountChecked: false,
      signChecked: false,
    }))

    return mapped
  } catch (error) {
    console.error("Smart Teller parsing failed:", error)
    throw new Error("Error reading Smart Teller GL file")
  }
}

const parseGenericExcel = (file: File) =>
  new Promise<any[]>((resolve, reject) => {
    try {
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const arrayBuffer = ev.target?.result as ArrayBuffer
          const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true, dense: true })
          const sheet = wb.Sheets[wb.SheetNames[0]]
          const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" })

          if (!rows || rows.length < 2) return reject(new Error("File too short or invalid"))

          const headerNames = rows[0].map(normalize)
          const dataRows = rows.slice(1)
          const mapped: any[] = []
          for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i]
            if (row.every((c) => c === "")) continue
            const obj: Record<string, any> = {}
            headerNames.forEach((h, j) => (obj[h] = normalize(row[j])))
            mapped.push(obj)
          }
          resolve(mapped)
        } catch (err) {
          reject(err)
        }
      }
      reader.readAsArrayBuffer(file)
    } catch (err) {
      reject(err)
    }
  })

/* ---------------------------
   PDF loader (dynamic import + CDN fallback)
   --------------------------- */
async function loadPdfJsSafe(): Promise<any> {
  // 🔒 HARD STOP: never allow pdfjs during build or SSR
  if (typeof window === "undefined") {
    throw new Error("PDF parsing must run in the browser only")
  }

  // Prevent Next.js from tree-shaking / preloading pdfjs
  const dynamicImport = new Function("m", "return import(m)")

  try {
    const pdfjs = await dynamicImport("pdfjs-dist/build/pdf")

    if (pdfjs?.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc =
        pdfjs.GlobalWorkerOptions.workerSrc ||
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"
    }

    return pdfjs
  } catch {
    // ---- CDN fallback ----
    return new Promise((resolve, reject) => {
      try {
        if ((window as any).pdfjsLib) return resolve((window as any).pdfjsLib)

        const script = document.createElement("script")
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"
        script.async = true

        script.onload = () => {
          const lib =
            (window as any).pdfjsLib ||
            (window as any).pdfjs ||
            (window as any).pdfjsDist

          if (!lib) return reject(new Error("pdf.js loaded but not exposed"))

          if (lib.GlobalWorkerOptions) {
            lib.GlobalWorkerOptions.workerSrc =
              "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"
          }

          resolve(lib)
        }

        script.onerror = () => reject(new Error("Failed to load pdf.js CDN"))
        document.body.appendChild(script)
      } catch (e) {
        reject(e)
      }
    })
  }
}


/* ---------------------------
   Improved PDF rebuilder parser
   - Attempts to handle Ecobank Instant Payment layout
   - Splits into blocks by S/N + Date and extracts fields robustly
   --------------------------- */
async function parsePdfRebuilder(
  file: File,
  onProgress?: (msg: string) => void
) {
  // 🔒 Never allow execution during SSR / build
  if (typeof window === "undefined") {
    throw new Error("PDF parsing must run in the browser")
  }

  onProgress?.("Loading PDF runtime...")
  const pdfjsLib = await loadPdfJsSafe()
  if (!pdfjsLib) {
    throw new Error("pdfjs not available")
  }

  // 🔒 Force a known-good worker (override broken bundled paths)
  try {
    if (pdfjsLib.GlobalWorkerOptions) {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"
    }
  } catch {
    // ignore – worker will fallback internally
  }

  onProgress?.("Reading file bytes...")
  const arrayBuffer = await file.arrayBuffer()

  onProgress?.("Loading document...")
  const loadingTask = pdfjsLib.getDocument({
  data: arrayBuffer,
  disableAutoFetch: true,
  disableStream: true,
})

  const pdf = await loadingTask.promise
  onProgress?.(`Document has ${pdf.numPages} pages`)

  const pagesText: string[] = []

  for (let p = 1; p <= pdf.numPages; p++) {
    onProgress?.(`Extracting page ${p} / ${pdf.numPages}`)

    const page = await pdf.getPage(p)
    const txt = await page.getTextContent()

    // Join text items with spaces; boundaries reintroduced later by heuristics
    const pageText = txt.items
      .map((it: any) => (typeof it?.str === "string" ? it.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()

    // Push cleaned page text
    pagesText.push(pageText)

    await sleep(6)
  }

  onProgress?.("Merging pages and cleaning text...")

  // Preserve page boundaries using a unique separator
  const fullText = pagesText.join("\n\n---PAGE_BREAK---\n\n")

  // ⬇⬇⬇
  // Continue with your existing regex / transaction parsing logic here
  // using `fullText`
  // ⬆⬆⬆

  return fullText
}
  // Remove common UI/footer junk lines (URLs and navigation terms)
  let cleanedText = fullText
    .replace(/https?:\/\/[^\s]+/g, " ") // remove URLs
    .replace(/\b(Logout|Authorise|Query|eCashier|Export Details|You Are Here|Transactions Query|Approved or completed)\b/gi, " ")
    .replace(/(?:\s){2,}/g, " ")
    .replace(/\u00a0/g, " ")
    .trim()

  // Try to find transaction blocks.
  // Ecobank sample uses: [S/N] [YYYY-MM-DD HH:MM:SS] ... REF: Trans ID:xxxxx | 0000...
  // We'll use a global regex capturing each block that starts with S/N and date and goes until the next S/N+date or EOF.
  // Use 's' flag to allow dot to match newlines (note: TS/JS supports 's')
  const blockRegex = /(\b\d+\b)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})([\s\S]*?)(?=(?:\b\d+\b\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})|$)/gms

  const results: any[] = []
  let match: RegExpExecArray | null
  let count = 0
  while ((match = blockRegex.exec(cleanedText)) !== null) {
    count++
    onProgress?.(`Processing block ${count}`)
    const sn = Number(match[1])
    const date = match[2]
    let body = match[3] || ""
    body = body.replace(/\s{2,}/g, " ").trim()

    // Remove trailing REF/... if present but keep reference id separately
    const refMatch = body.match(/Trans ID[:\s]*([0-9]+)/i) || body.match(/REF[:\s]*Trans ID[:\s]*([0-9]+)/i)
    const refId = refMatch ? refMatch[1] : ""
    // Clean away REF portion so it doesn't pollute other fields
    body = body.replace(/REF:.*$/i, "").replace(/Trans ID[:\s]*[0-9]+/i, "").trim()

    // Attempt to extract amount(s) - choose last currency-like token
    const amountMatches = body.match(/([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)(?!\S)/g)
    let amount = ""
    if (amountMatches && amountMatches.length > 0) {
      amount = amountMatches[amountMatches.length - 1]
      // normalize amount: remove commas
      amount = amount.replace(/,/g, "")
    } else {
      // fallback: look for token with '0' to end
      const fallback = (body.match(/[0-9]{2,}\.?[0-9]*/) || [""])[0]
      amount = fallback.replace(/,/g, "")
    }

    // Try to extract account: 8-12 digit groups
    const accMatch = body.match(/(\b\d{8,16}\b)/)
    const account = accMatch ? accMatch[1] : ""

    // Determine bank by scanning for keywords
    let bank = ""
    for (const b of BANK_KEYWORDS) {
      if (new RegExp(`\\b${b.replace(/\s+/g, "\\s+")}\\b`, "i").test(body)) {
        bank = b
        break
      }
    }

    // Branch detection: look for D<number> / OGUN / branch hints
    const branchMatch = body.match(/\b(D\d{1,3}(?:-|\s)?[A-Z0-9\- ]{0,30}|[A-Z]{2,10}\s*-\s*[A-Z0-9\- ]{0,30}|BRANCH[:\s][A-Za-z0-9 \-]{2,30})\b/i)
    const branch = branchMatch ? branchMatch[0].trim() : ""

    // Now heuristics to split sender vs beneficiary
    // If bank exists we try: [prefix before bank] = sender, [after bank up to account] = beneficiary
    let sender = ""
    let beneficiary = ""

    if (bank) {
      const bankIdx = body.toLowerCase().indexOf(bank.toLowerCase())
      const beforeBank = body.slice(0, bankIdx).trim()
      const afterBank = body.slice(bankIdx + bank.length).trim()
      // Sender usually contains address/branch info and sender name - take last chunk before bank as sender
      sender = beforeBank.split(/\s{2,}|[|,]/).slice(-1)[0] || beforeBank
      // Beneficiary often starts after bank and before account or amount
      if (account) {
        const accIdx = afterBank.indexOf(account)
        if (accIdx !== -1) {
          beneficiary = afterBank.slice(0, accIdx).trim()
        } else {
          beneficiary = afterBank.split(/\s{2,}|[|,]/).slice(0, 4).join(" ").trim()
        }
      } else {
        beneficiary = afterBank.split(/\s{2,}|[|,]/).slice(0, 4).join(" ").trim()
      }
    } else {
      // fallback: split on common separators and take first token as sender, next as beneficiary
      const parts = body.split(/REF:|Trans ID:|\||\n|\s{2,}|, /).map((s) => s.trim()).filter(Boolean)
      sender = parts[0] || ""
      // Sometimes first token is Branch or D18- etc, if so take next token
      if (sender && /^\bD\d+|OGUN\b/i.test(sender) && parts.length > 1) {
        sender = parts[1] || sender
      }
      beneficiary = parts[1] || parts[2] || ""
      // remove account number from beneficiary string if present
      if (account && beneficiary.indexOf(account) !== -1) {
        beneficiary = beneficiary.replace(account, "").trim()
      }
    }

    // Status: search for 'successfully' or 'approved' text inside the block (try to capture phrase)
    const statusMatch = (match = body.match(/\b(Approved or completed|Approved|approved|Completed|completed|successfully|Successfully)\b/)) ? match[0] : ""
    const status = statusMatch ? statusMatch : ""

    // Ensure minimal normalization
    sender = normalize(sender)
    beneficiary = normalize(beneficiary)
    const rawText = normalize(match[0] + " " + body)

    results.push({
      "S/N": sn,
      Date: date,
      Sender: sender,
      Branch: branch,
      Bank: bank,
      Beneficiary: beneficiary,
      Account: account,
      Amount: amount,
      Status: status,
      "Reference ID": refId,
      rawText,
      // exception flags - default false
      bvnChecked: false,
      alterChecked: false,
      amountChecked: false,
      signChecked: false,
    })
  }

  // If the block regex didn't find anything (some PDFs extract poorly), fallback to line scanning:
  if (results.length === 0) {
    onProgress?.("No structured blocks found — trying fallback line parsing...")
    const lines = cleanedText.split(/\n|---PAGE_BREAK---/).map((l) => l.trim()).filter(Boolean)
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      const dateMatch = l.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/)
      if (dateMatch) {
        const snMatch = l.match(/^\s*(\d+)\b/)
        const sn = snMatch ? Number(snMatch[1]) : i + 1
        const date = dateMatch[1]
        // look ahead a couple of lines for account / amount / bank
        const windowText = lines.slice(i, Math.min(i + 4, lines.length)).join(" ")
        const accMatch = windowText.match(/(\b\d{8,16}\b)/)
        const account = accMatch ? accMatch[1] : ""
        const amountMatch = windowText.match(/([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/)
        const amount = amountMatch ? amountMatch[0].replace(/,/g, "") : ""
        let bank = ""
        for (const b of BANK_KEYWORDS) {
          if (new RegExp(`\\b${b.replace(/\s+/g, "\\s+")}\\b`, "i").test(windowText)) {
            bank = b
            break
          }
        }
        const parts = windowText.split(/\s{2,}|,|\||\t/).map((s) => s.trim()).filter(Boolean)
        const sender = parts[1] || parts[0] || ""
        const beneficiary = parts[2] || parts[1] || ""
        results.push({
          "S/N": sn,
          Date: date,
          Sender: normalize(sender),
          Branch: "",
          Bank: bank,
          Beneficiary: normalize(beneficiary),
          Account: account,
          Amount: amount,
          Status: "",
          "Reference ID": "",
          rawText: windowText,
          bvnChecked: false,
          alterChecked: false,
          amountChecked: false,
          signChecked: false,
        })
      }
    }
  }

  // Final normalization: ensure amounts are strings and remove empties
  const final = results
    .map((r) => ({
      ...r,
      Amount: r.Amount ? String(r.Amount).replace(/[^0-9.\-]/g, "") : "",
      Date: r.Date || "",
      Sender: r.Sender || "",
      Beneficiary: r.Beneficiary || "",
      Account: r.Account || "",
      Bank: r.Bank || "",
      Branch: r.Branch || "",
      Status: r.Status || "",
      "Reference ID": r["Reference ID"] || "",
    }))
    .filter((r) => r.Sender || r.Beneficiary || r.Account || r.Amount) // drop completely empty rows

  // Sort by S/N asc if sensible numbers present
  final.sort((a, b) => (Number(a["S/N"]) || 0) - (Number(b["S/N"]) || 0))

  onProgress?.(`Parsed ${final.length} transactions`)
  return final
}

/* ---------------------------
   Component
   --------------------------- */
export function SmartCallOver() {
  // states
  const [callOverOfficer, setCallOverOfficer] = useState("")
  const [date, setDate] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<any[]>([])
  const [parsedData, setParsedData] = useState<any[]>([]) // explicit parsedData storage
  const [headers, setHeaders] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [infoLine, setInfoLine] = useState<string>("")
  const [selectedRow, setSelectedRow] = useState<any | null>(null)
  const [userFilter, setUserFilter] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [txType, setTxType] = useState<"flexcube" | "smart" | "nip" | "neft">("flexcube")
  const [branchFilter, setBranchFilter] = useState("")
  const [summary, setSummary] = useState({ clean: 0, exceptions: 0 })
  const [sessionSaved, setSessionSaved] = useState(false)

  const [smartTab, setSmartTab] = useState<"debit" | "credit">("debit")

  const PAGE_SIZE = 20
  const [pageIndex, setPageIndex] = useState(0) // 0-based

  const computeSummary = (data: any[]) => {
    const clean = data.filter((r) => !r.bvnChecked && !r.alterChecked && !r.amountChecked && !r.signChecked).length
    const exc = data.length - clean
    setSummary({ clean, exceptions: exc })
  }

  useEffect(() => {
    computeSummary(previewData)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewData])

  useEffect(() => {
    try {
      const raw = localStorage.getItem("SmartCallOverSession")
      if (raw) {
        const s = JSON.parse(raw)
        if (s) {
          setTxType(s.txType || "flexcube")
          setPreviewData(s.previewData || [])
          setParsedData(s.previewData || [])
          setDate(s.date || "")
          setCallOverOfficer(s.callOverOfficer || "")
          setUserFilter(s.userFilter || "")
          setBranchFilter(s.branchFilter || "")
          setSessionSaved(true)
          setInfoLine("Restored saved session")
        }
      }
    } catch (e) {}
  }, [])

  const filteredPreview = useMemo(() => {
    if (!previewData || previewData.length === 0) return []
    if (txType === "flexcube") {
      if (!userFilter.trim()) return previewData
      const q = userFilter.trim().toLowerCase()
      return previewData.filter((r) => {
        const uid = String(r["USER ID"] || r["AUTHORISER ID"] || r["Authoriser ID"] || r["AUTHORISER"] || "").toLowerCase()
        return uid.includes(q)
      })
    } else if (txType === "smart") {
      if (!branchFilter.trim()) return previewData
      const q = branchFilter.trim().toLowerCase()
      return previewData.filter((r) => String((r["BRANCH CODE"] || r.raw?.["Dr Acc Brn Code"] || r.raw?.["Cr Acc Brn Code"] || "")).toLowerCase().includes(q))
    }
    return previewData
  }, [previewData, txType, userFilter, branchFilter])

  const smartSplit = useMemo(() => {
    if (txType !== "smart") return { debit: previewData, credit: [] }
    const debit: any[] = []
    const credit: any[] = []
    for (const r of filteredPreview) {
      const t = r.__type || (r.raw && (r.raw["Dr Account Number"] ? "debit" : "credit")) || "debit"
      if (String(t).toLowerCase() === "debit") debit.push(r)
      else credit.push(r)
    }
    return { debit, credit }
  }, [filteredPreview, txType])

  const nipApproved = useMemo(() => {
    if (!(txType === "nip" || txType === "neft")) return []
    return filteredPreview.filter((r) => {
      const s = String((r["Status"] || r.status || "")).toLowerCase()
      return s.includes("approved") || s.includes("completed") || s.includes("success")
    })
  }, [filteredPreview, txType])
  const nipOthers = useMemo(() => {
    if (!(txType === "nip" || txType === "neft")) return []
    return filteredPreview.filter((r) => {
      const s = String((r["Status"] || r.status || "")).toLowerCase()
      return !(s.includes("approved") || s.includes("completed") || s.includes("success"))
    })
  }, [filteredPreview, txType])

  /* ----------------------------
     File handler
     ---------------------------- */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files?.[0]
    if (!uploaded) return
    setFile(uploaded)
    setPreviewData([])
    setParsedData([])
    setHeaders([])
    setInfoLine("Parsing...")
    setLoading(true)
    setPageIndex(0)

    try {
      if (txType === "smart") {
        const parsed = await parseSmartTellerGL(uploaded)
        setPreviewData(parsed)
        setParsedData(parsed)
        setHeaders(Object.keys(parsed[0] || {}))
        setInfoLine(`Parsed ${parsed.length} Smart Teller rows.`)
      } else if (txType === "flexcube") {
        const parsed = await parseGenericExcel(uploaded)
        setPreviewData(parsed)
        setParsedData(parsed)
        setHeaders(Object.keys(parsed[0] || {}))
        setInfoLine(`Parsed ${parsed.length} Flexcube rows.`)
      } else if (txType === "nip" || txType === "neft") {
        const lower = (uploaded.name || "").toLowerCase()
        if (!lower.endsWith(".pdf")) {
          alert("NIP/NEFT accepts PDF files only. Please upload a PDF.")
          setInfoLine("Upload rejected — only PDF allowed for NIP/NEFT.")
          setLoading(false)
          return
        }
        try {
          const parsed = await parsePdfRebuilder(uploaded, setInfoLine)
          // ensure each row has exception flags
          const withFlags = parsed.map((r: any) => ({ ...r, bvnChecked: false, alterChecked: false, amountChecked: false, signChecked: false }))
          setPreviewData(withFlags)
          setParsedData(withFlags)
          setHeaders(Object.keys(withFlags[0] || {}))
          setInfoLine(`Parsed ${withFlags.length} rows from PDF.`)
        } catch (err: any) {
          console.error("PDF parse error:", err)
          setInfoLine(err?.message || "PDF parsing failed")
          setPreviewData([])
          setHeaders([])
        }
      } else {
        const parsed = await parseGenericExcel(uploaded)
        setPreviewData(parsed)
        setParsedData(parsed)
        setHeaders(Object.keys(parsed[0] || {}))
        setInfoLine(`Parsed ${parsed.length} rows.`)
      }
    } catch (err) {
      console.error(err)
      alert("Error parsing file. Check file format.")
      setInfoLine("Parsing failed.")
      setPreviewData([])
      setHeaders([])
    } finally {
      setLoading(false)
      setTimeout(() => computeSummary(previewData), 100)
    }
  }

  /* ----------------------------
     DB mock
     ---------------------------- */
  const fetchFromDB = async () => {
    setLoading(true)
    setInfoLine("Fetching from database...")
    await new Promise((r) => setTimeout(r, 700))
    const mock = [
      {
        "BRANCH CODE": "001",
        "ACCOUNT NUMBER": "0123456789",
        "NARRATION": "Fetched txn 1",
        "CURRENCY": "NGN",
        "AMOUNT": "2,000.00",
        "TRANSACTION DATE": "2025-11-07",
        "USER ID": "TELLER01",
        bvnChecked: false,
        alterChecked: false,
        amountChecked: false,
        signChecked: false,
      },
      {
        "BRANCH CODE": "002",
        "ACCOUNT NUMBER": "0987654321",
        "NARRATION": "Fetched txn 2",
        "CURRENCY": "NGN",
        "AMOUNT": "3,500.00",
        "TRANSACTION DATE": "2025-11-07",
        "USER ID": "TELLER02",
        bvnChecked: false,
        alterChecked: false,
        amountChecked: false,
        signChecked: false,
      },
    ]
    setPreviewData(mock)
    setParsedData(mock)
    setHeaders(Object.keys(mock[0]))
    setInfoLine("Fetched 2 rows from DB (mock).")
    setLoading(false)
    computeSummary(mock)
  }

  /* ----------------------------
     Save / Clear / Module switch / Submit
     ---------------------------- */
  const handleSaveSession = () => {
    try {
      const payload = {
        txType,
        previewData,
        date,
        callOverOfficer,
        userFilter,
        branchFilter,
      }
      localStorage.setItem("SmartCallOverSession", JSON.stringify(payload))
      setSessionSaved(true)
      setInfoLine("Session saved locally")
      alert("Session saved locally.")
    } catch (e) {
      console.error("Save failed", e)
      alert("Failed to save session")
    }
  }

  const handleClearPreview = () => {
    if (previewData.length > 0 && !sessionSaved) {
      const ok = confirm("You have unsaved data — save session before clearing? Cancel = don't clear. OK = clear anyway.")
      if (!ok) return
    }
    setPreviewData([])
    setParsedData([])
    setFile(null)
    setHeaders([])
    setInfoLine("Preview cleared")
    setSessionSaved(false)
    setPageIndex(0)
  }

  const handleModuleSwitch = (newType: "flexcube" | "smart" | "nip" | "neft") => {
    if (newType === txType) return
    if (previewData.length > 0 && !sessionSaved) {
      const choice = confirm("You have unsaved data. Save or submit first. Press Cancel to stay. OK to switch (you'll lose unsaved data).")
      if (!choice) return
    }
    setTxType(newType)
    setPreviewData([])
    setParsedData([])
    setFile(null)
    setHeaders([])
    setInfoLine(`Switched to ${newType.toUpperCase()}`)
    setSessionSaved(false)
    setSmartTab("debit")
    setBranchFilter("")
    setUserFilter("")
    setPageIndex(0)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!file && previewData.length === 0) return alert("Please upload or fetch transactions first.")
    if (!callOverOfficer.trim() || !userFilter.trim()) return alert("Please fill Call Over Officer and User/Authorizer ID before submit.")
    setSubmitted(true)
    try {
      localStorage.removeItem("SmartCallOverSession")
    } catch (e) {}
    setSessionSaved(false)
    alert("✅ Transaction Journal ready (dummy submit). Local session cleared.")
  }

  /* ----------------------------
     Exceptions toggles
     ---------------------------- */
  const canEdit = callOverOfficer.trim() && userFilter.trim()
  const handleToggle = (index: number, key: string) => {
    if (!canEdit) {
      alert("Please fill Call Over Officer and User/Authorizer ID before making checks.")
      return
    }
    setPreviewData((prev) => {
      const updated = [...prev]
      // index refers to global index (pageIndex applied at caller)
      const row = updated[index]
      if (!row) return updated
      updated[index] = { ...row, [key]: !row[key] }
      computeSummary(updated)
      return updated
    })
  }
  const getExceptionColor = (row: any) => {
    const count = (row.bvnChecked ? 1 : 0) + (row.alterChecked ? 1 : 0) + (row.amountChecked ? 1 : 0) + (row.signChecked ? 1 : 0)
    if (count === 0) return { color: "green", icon: <CheckCircle size={16} className="text-green-600" />, label: "Clean" }
    if (count <= 2) return { color: "yellow", icon: <AlertTriangle size={16} className="text-yellow-500" />, label: "Minor" }
    return { color: "red", icon: <XCircle size={16} className="text-red-600" />, label: "Major" }
  }

  const cellClass = "border px-2 py-1 text-gray-700 truncate max-w-[160px] text-xs"
  const headerCellClass = "border px-2 py-2 text-left text-gray-700 font-semibold truncate text-xs bg-gray-50 sticky top-0 z-10"

  const currentPageSlice = (arr: any[]) => {
    const start = pageIndex * PAGE_SIZE
    return arr.slice(start, start + PAGE_SIZE)
  }
  const pageCount = (arr: any[]) => Math.max(1, Math.ceil(arr.length / PAGE_SIZE))

  /* ----------------------------
     Render
     ---------------------------- */
  return (
    <div className="p-6">
      <Card className="shadow-md border border-slate-200">
        <CardHeader className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet size={20} /> Smart Call Over — Transaction Journal
            </CardTitle>

            <div className="ml-2 inline-flex rounded-md bg-gray-100 p-1">
              {[{ id: "flexcube", label: "Flexcube" }, { id: "smart", label: "Smart Teller" }, { id: "nip", label: "NIP" }, { id: "neft", label: "NEFT" }].map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleModuleSwitch(t.id as any)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition ${txType === t.id ? "bg-white shadow-sm text-slate-900" : "text-gray-600"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Label className="text-sm text-slate-600 mr-2">GL Upload</Label>

            <Input
              type="file"
              accept={txType === "nip" || txType === "neft" ? "application/pdf,.pdf" : ".xlsx,.xls,.csv"}
              onChange={handleFileChange}
              className="cursor-pointer"
            />

            <Button variant="outline" onClick={fetchFromDB} className="flex items-center gap-2">
              <Database size={14} /> Fetch from DB
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6 mt-2" autoComplete="off">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label>Call Over Officer</Label>
                <div className="flex items-center border rounded-md p-2 bg-white">
                  <User size={18} className="text-gray-500 mr-2" />
                  <Input
                    placeholder="Enter officer name"
                    value={callOverOfficer}
                    onChange={(e) => setCallOverOfficer(e.target.value)}
                    required
                    className="border-0 focus:ring-0"
                  />
                </div>
              </div>

              <div>
                <Label>Date</Label>
                <div className="flex items-center border rounded-md p-2 bg-white">
                  <Calendar size={18} className="text-gray-500 mr-2" />
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="border-0 focus:ring-0"
                  />
                </div>
              </div>

              <div>
                <Label>{txType === "smart" ? "Branch Code (filter)" : "User / Authorizer Filter"}</Label>
                <div className="flex items-center border rounded-md p-2 bg-white">
                  <Filter size={18} className="text-gray-500 mr-2" />
                  <Input
                    placeholder={txType === "smart" ? "Branch code e.g. 001" : "User ID or Authorizer ID"}
                    value={txType === "smart" ? branchFilter : userFilter}
                    onChange={(e) => (txType === "smart" ? setBranchFilter(e.target.value) : setUserFilter(e.target.value))}
                    className="border-0 focus:ring-0"
                  />
                </div>
              </div>
            </div>

            <Card className="border-slate-100 shadow-sm">
              <CardHeader>
                <CardTitle className="text-slate-700 flex items-center gap-2">
                  <Upload size={18} /> {txType === "flexcube" ? "Flexcube Transactions Preview" : txType === "smart" ? "Smart Teller Transactions Preview" : txType === "nip" ? "NIP Transactions Preview" : "NEFT Transactions Preview"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {file && <p className="text-sm text-gray-600 mt-1">📁 {file.name}</p>}
                <div className="text-xs text-muted-foreground mt-2 text-slate-600">{infoLine}</div>
                <div className="mt-2 text-sm text-slate-500">Parser: {txType === "smart" ? "Smart Teller (excel)" : txType.toUpperCase()}</div>
              </CardContent>
            </Card>

            {loading ? (
              <div className="text-center py-6 text-slate-600 animate-pulse">⏳ Parsing data...</div>
            ) : (
              <>
                {txType === "smart" ? (
                  <>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => { setSmartTab("debit"); setPageIndex(0) }}
                        className={`px-3 py-1 rounded-md text-sm font-medium ${smartTab === "debit" ? "bg-white shadow-sm text-slate-900" : "text-gray-600"}`}
                      >
                        Debit ({smartSplit.debit.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSmartTab("credit"); setPageIndex(0) }}
                        className={`px-3 py-1 rounded-md text-sm font-medium ${smartTab === "credit" ? "bg-white shadow-sm text-slate-900" : "text-gray-600"}`}
                      >
                        Credit ({smartSplit.credit.length})
                      </button>
                      <div className="ml-auto text-sm text-slate-500">Branch: {branchFilter || "—"}</div>
                    </div>

                    <div className="overflow-auto border rounded-md mt-2 max-h-[56vh]">
                      <table className="min-w-full border-collapse text-xs md:text-sm">
                        <thead>
                          <tr>
                            {["BRANCH CODE", "ACCOUNT NUMBER", "NARRATION", "CURRENCY", "AMOUNT", "TRANSACTION DATE", "USER ID"].map((h) => (<th key={h} className={headerCellClass}>{h}</th>))}
                            <th className={headerCellClass}>Exceptions</th>
                            <th className={headerCellClass}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentPageSlice((smartTab === "debit" ? smartSplit.debit : smartSplit.credit)).map((row: any, i: number) => {
                            const globalIndex = i + pageIndex * PAGE_SIZE
                            const { icon, label, color } = getExceptionColor(row)
                            return (
                              <tr key={i} className="hover:bg-gray-50">
                                {["BRANCH CODE", "ACCOUNT NUMBER", "NARRATION", "CURRENCY", "AMOUNT", "TRANSACTION DATE", "USER ID"].map((c, j) => (<td key={j} className={cellClass}>{String(row[c] ?? "")}</td>))}
                                <td className={`border px-2 py-1 text-center font-medium ${color === "red" ? "text-red-600" : color === "yellow" ? "text-yellow-600" : "text-green-600"}`}>
                                  <div className="flex items-center justify-center gap-1">{icon} {label}</div>
                                </td>
                                <td className="border px-2 py-1 text-center">
                                  <div className="flex items-center gap-2 justify-center">
                                    {["bvnChecked","alterChecked","amountChecked","signChecked"].map((k, idx) => (
                                      <label key={idx} className="inline-flex items-center gap-1 cursor-pointer text-xs">
                                        <input type="checkbox" checked={!!row[k]} onChange={() => handleToggle(globalIndex, k)} className="accent-blue-600 w-4 h-4" />
                                        <span>{["BVN","Alter","Amt","Sign"][idx]}</span>
                                      </label>
                                    ))}
                                    <Button size="sm" variant="ghost" onClick={() => setSelectedRow({ ...row, __globalIndex: globalIndex })} className="p-1"><Eye size={14} /></Button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <div className="text-sm text-slate-600">Page {pageIndex + 1} / {pageCount(smartTab === "debit" ? smartSplit.debit : smartSplit.credit)}</div>
                      <div className="flex gap-2">
                        <Button onClick={() => setPageIndex((p) => Math.max(0, p - 1))} disabled={pageIndex === 0}>Prev</Button>
                        <Button onClick={() => setPageIndex((p) => Math.min(pageCount(smartTab === "debit" ? smartSplit.debit : smartSplit.credit) - 1, p + 1))} disabled={pageIndex >= pageCount(smartTab === "debit" ? smartSplit.debit : smartSplit.credit) - 1}>Next</Button>
                      </div>
                    </div>
                  </>
                ) : txType === "nip" || txType === "neft" ? (
                  <>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="text-sm text-slate-500">Parser: PDF rebuilder</div>
                    </div>

                    <div className="overflow-auto border rounded-md mt-2 max-h-[56vh]">
                      <table className="min-w-full border-collapse text-xs md:text-sm">
                        <thead>
                          <tr>
                            {(previewData[0] ? Object.keys(previewData[0]) : ["S/N","Date","Sender","Branch","Bank","Beneficiary","Account","Amount","Status"]).slice(0,9).map((h) => (
                              <th key={h} className={headerCellClass}>{String(h).toUpperCase()}</th>
                            ))}
                            <th className={headerCellClass}>Exceptions</th>
                            <th className={headerCellClass}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentPageSlice((nipApproved.length >= nipOthers.length ? nipApproved.concat(nipOthers) : previewData)).map((row: any, i: number) => {
                            const globalIndex = i + pageIndex * PAGE_SIZE
                            const { icon, label, color } = getExceptionColor(row)
                            // ensure keys exist in row for stable order
                            const keys = Object.keys(previewData[0] || { "S/N": "", Date: "", Sender: "", Branch: "", Bank: "", Beneficiary: "", Account: "", Amount: "", Status: "" }).slice(0,9)
                            return (
                              <tr key={i} className="hover:bg-gray-50">
                                {keys.map((k) => (
                                  <td key={k} className={cellClass}>{String(row[k] ?? "")}</td>
                                ))}
                                <td className={`border px-2 py-1 text-center font-medium ${color === "red" ? "text-red-600" : color === "yellow" ? "text-yellow-600" : "text-green-600"}`}>
                                  <div className="flex items-center justify-center gap-1">{icon} {label}</div>
                                </td>
                                <td className="border px-2 py-1 text-center">
                                  <div className="flex items-center gap-2 justify-center">
                                    {["bvnChecked","alterChecked","amountChecked","signChecked"].map((k, idx) => (
                                      <label key={idx} className="inline-flex items-center gap-1 cursor-pointer text-xs">
                                        <input type="checkbox" checked={!!row[k]} onChange={() => handleToggle(globalIndex, k)} className="accent-blue-600 w-4 h-4" />
                                        <span>{["BVN","Alter","Amt","Sign"][idx]}</span>
                                      </label>
                                    ))}
                                    <Button size="sm" variant="ghost" onClick={() => setSelectedRow({ ...row, __globalIndex: globalIndex })}>View</Button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <div className="text-sm text-slate-600">Page {pageIndex + 1} / {pageCount(previewData)}</div>
                      <div className="flex gap-2">
                        <Button onClick={() => setPageIndex((p) => Math.max(0, p - 1))} disabled={pageIndex === 0}>Prev</Button>
                        <Button onClick={() => setPageIndex((p) => Math.min(pageCount(previewData) - 1, p + 1))} disabled={pageIndex >= pageCount(previewData) - 1}>Next</Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="overflow-auto border rounded-md mt-2 max-h-[60vh]">
                    <table className="min-w-full border-collapse text-xs md:text-sm">
                      <thead>
                        <tr>
                          {["BRANCH CODE", "PRODUCT CODE", "TRANSACTION CODE", "ACCOUNT NUMBER", "NARRATION", "CURRENCY", "AMOUNT", "TRANSACTION DATE", "USER ID", "AUTHORISER ID"].map((h) => (<th key={h} className={headerCellClass}>{h}</th>))}
                          <th className={headerCellClass}>Exceptions</th>
                          <th className={headerCellClass}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentPageSlice(filteredPreview).map((row: any, i: number) => {
                          const globalIndex = i + pageIndex * PAGE_SIZE
                          const { icon, label, color } = getExceptionColor(row)
                          return (
                            <tr key={i} className="hover:bg-gray-50">
                              {["BRANCH CODE", "PRODUCT CODE", "TRANSACTION CODE", "ACCOUNT NUMBER", "NARRATION", "CURRENCY", "AMOUNT", "TRANSACTION DATE", "USER ID", "AUTHORISER ID"].map((c, j) => (<td key={j} className={cellClass}>{String(row[c] ?? "")}</td>))}
                              <td className={`border px-2 py-1 text-center font-medium ${color === "red" ? "text-red-600" : color === "yellow" ? "text-yellow-600" : "text-green-600"}`}>
                                <div className="flex items-center justify-center gap-1">{icon} {label}</div>
                              </td>
                              <td className="border px-2 py-1 text-center">
                                <div className="flex items-center gap-2 justify-center">
                                  {["bvnChecked","alterChecked","amountChecked","signChecked"].map((k, idx) => (
                                    <label key={idx} className="inline-flex items-center gap-1 cursor-pointer text-xs">
                                      <input type="checkbox" checked={!!row[k]} onChange={() => handleToggle(globalIndex, k)} className="accent-blue-600 w-4 h-4" />
                                      <span>{["BVN","Alter","Amt","Sign"][idx]}</span>
                                    </label>
                                  ))}
                                  <Button size="sm" variant="ghost" onClick={() => setSelectedRow({ ...row, __globalIndex: globalIndex })} className="p-1"><Eye size={14} /></Button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>

                    <div className="flex items-center justify-between mt-2">
                      <div className="text-sm text-slate-600">Page {pageIndex + 1} / {pageCount(filteredPreview)}</div>
                      <div className="flex gap-2">
                        <Button onClick={() => setPageIndex((p) => Math.max(0, p - 1))} disabled={pageIndex === 0}>Prev</Button>
                        <Button onClick={() => setPageIndex((p) => Math.min(pageCount(filteredPreview) - 1, p + 1))} disabled={pageIndex >= pageCount(filteredPreview) - 1}>Next</Button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid md:grid-cols-3 gap-4 mt-4">
                  <Card className="p-4">
                    <div className="text-sm text-slate-600">Summary</div>
                    <div className="mt-2 text-lg font-semibold">✅ Clean: {summary.clean}</div>
                    <div className="text-lg font-semibold text-red-600">⚠️ Exceptions: {summary.exceptions}</div>
                  </Card>

                  <Card className="p-4">
                    <div className="text-sm text-slate-600">Actions</div>
                    <div className="mt-2 flex flex-col gap-2">
                      <Button onClick={() => { alert("Dummy submit clicked"); }} className="bg-teal-600 text-white">Dummy Submit</Button>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={handleClearPreview}>Clear Preview</Button>
                        <Button variant="ghost" onClick={handleSaveSession} className="flex items-center gap-2">💾 Save Session</Button>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="text-sm text-slate-600">Counts</div>
                    <div className="mt-2">
                      <div>Total Rows: <strong>{previewData.length}</strong></div>
                      <div className="text-xs text-slate-500 mt-1">Active parser: {txType.toUpperCase()}</div>
                      <div className="text-xs text-slate-400 mt-1">Session saved: {sessionSaved ? "Yes" : "No"}</div>
                    </div>
                  </Card>
                </div>
              </>
            )}

            <div className="flex justify-end mt-4">
              <Button type="submit" className="bg-blue-700 hover:bg-blue-800 text-white">Submit</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Dialog open={!!selectedRow} onOpenChange={() => setSelectedRow(null)}>
        <DialogContent className="max-w-full lg:max-w-[1000px] border-t-4 border-slate-700 rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-slate-900">Transaction Details</DialogTitle>
          </DialogHeader>
          {selectedRow && (
            <div className="overflow-y-auto max-h-[80vh] text-sm divide-y divide-gray-200 mt-2 px-4">
              {Object.entries(selectedRow).map(([key, value]) => (
                <div key={key} className="flex justify-between py-1 hover:bg-gray-50">
                  <span className="font-medium text-slate-700">{key}</span>
                  <span className="text-slate-600 text-right max-w-[60%] break-words">{String(value)}</span>
                </div>
              ))}
              <div className="flex justify-end mt-3">
                <Button onClick={() => setSelectedRow(null)} className="bg-slate-700 hover:bg-slate-800 text-white">Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default SmartCallOver
