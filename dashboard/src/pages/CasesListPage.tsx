import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, AGENCY_THEME } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Badge } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CaseRow = {
  ref: string;
  status: string;
  classification?: { categoryLabel?: string };
  jurisdiction?: { agencyId?: string; agencyLabel?: string; reason?: string };
  dispatch?: { externalRef?: string };
  createdAt?: string;
};

export function CasesPage() {
  const [q, setQ] = useState("");
  const [agency, setAgency] = useState("");
  const [items, setItems] = useState<CaseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");

  async function load() {
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (agency) params.set("agency", agency);
      const res = await api<{ items: CaseRow[]; total: number }>(
        `/api/admin/cases?${params}`
      );
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Cases</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {total} case(s)
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Input
            placeholder="Search ref / text / ticket"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-xs"
          />
          <select
            className="h-9 rounded-md border border-[var(--color-input)] px-3 text-sm"
            value={agency}
            onChange={(e) => setAgency(e.target.value)}
          >
            <option value="">All agencies</option>
            {Object.entries(AGENCY_THEME).map(([id, a]) => (
              <option key={id} value={id}>
                {a.short}
              </option>
            ))}
          </select>
          <Button onClick={load}>Apply</Button>
        </CardContent>
      </Card>
      {error ? <p className="text-[var(--color-destructive)]">{error}</p> : null}
      <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-muted)] text-left">
            <tr>
              <th className="p-3">Ref</th>
              <th className="p-3">Category</th>
              <th className="p-3">Agency</th>
              <th className="p-3">Ticket</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.ref} className="border-t border-[var(--color-border)]">
                <td className="p-3">
                  <Link className="font-medium underline" to={`/admin/cases/${c.ref}`}>
                    {c.ref}
                  </Link>
                </td>
                <td className="p-3">{c.classification?.categoryLabel}</td>
                <td className="p-3">{c.jurisdiction?.agencyLabel}</td>
                <td className="p-3">{c.dispatch?.externalRef || "—"}</td>
                <td className="p-3">
                  <Badge>{c.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
