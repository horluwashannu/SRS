"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"

interface BranchInfoProps {
  branchCode: string
  branchName: string
  region: string
  onBranchCodeChange: (value: string) => void
  onBranchNameChange: (value: string) => void
  onRegionChange: (value: string) => void
}

export function BranchInfo({
  branchCode,
  branchName,
  region,
  onBranchCodeChange,
  onBranchNameChange,
  onRegionChange,
}: BranchInfoProps) {
  return (
    <Card className="border-primary/20 bg-card/50 backdrop-blur">
      <CardContent className="pt-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="branchCode">Branch Code</Label>
            <Input
              id="branchCode"
              placeholder="e.g., BR001"
              value={branchCode}
              onChange={(e) => onBranchCodeChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="branchName">Branch Name</Label>
            <Input
              id="branchName"
              placeholder="e.g., Lagos Main Branch"
              value={branchName}
              onChange={(e) => onBranchNameChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="region">Region</Label>
            <Input
              id="region"
              placeholder="e.g., South West"
              value={region}
              onChange={(e) => onRegionChange(e.target.value)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
