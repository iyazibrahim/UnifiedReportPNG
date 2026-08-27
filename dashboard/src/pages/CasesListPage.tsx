import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api, AGENCY_THEME } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CaseRow = {
  ref: string;
  status: string;
  classification?: { categoryLabel?: string };
  jurisdiction?: { agencyId?: string; agencyLabel?: string; reason?: string };
  dispatch?: { externalRef?: string };
  createdAt?: string;
};

const PAGE_SIZE = 20;

export function CasesPage() {
  const [q, setQ] = useState("");
  const [agency, setAgency] = useState("all");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<CaseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (pageNum = page) => {
      setBusy(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (agency && agency !== "all") params.set("agency", agency);
        params.set("limit", String(PAGE_SIZE));
        params.set("skip", String((pageNum - 1) * PAGE_SIZE));
        const res = await api<{ items: CaseRow[]; total: number }>(
          `/api/admin/cases?${params}`
        );
        setItems(res.items);
        setTotal(res.total);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load cases";
        setError(msg);
        toast.error(msg);
      } finally {
        setBusy(false);
        setLoading(false);
      }
    },
    [q, agency, page]
  );

  useEffect(() => {
    load(page);
  }, [page]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function applyFilters() {
    setPage(1);
    load(1);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Cases</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {total} case(s)
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search ref / text / ticket"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applyFilters()}
          className="sm:max-w-xs"
          aria-label="Search cases"
        />
        <Select value={agency} onValueChange={setAgency}>
          <SelectTrigger className="sm:w-48" aria-label="Filter by agency">
            <SelectValue placeholder="All agencies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All agencies</SelectItem>
            {Object.entries(AGENCY_THEME).map(([id, a]) => (
              <SelectItem key={id} value={id}>
                {a.short}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          className="min-h-11"
          onClick={applyFilters}
          disabled={busy}
        >
          {busy ? "Loading…" : "Apply"}
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load cases</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)]">
        {loading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-4">
            <Alert>
              <AlertTitle>No cases found</AlertTitle>
              <AlertDescription>
                Try clearing filters or submit a report via Telegram.
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-[var(--color-muted)]/60 hover:bg-[var(--color-muted)]/60">
                <TableHead>Ref</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Agency</TableHead>
                <TableHead>Ticket</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((c) => (
                <TableRow key={c.ref}>
                  <TableCell>
                    <Link
                      className="inline-flex min-h-11 items-center font-medium underline-offset-4 hover:underline"
                      to={`/admin/cases/${c.ref}`}
                    >
                      {c.ref}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {c.classification?.categoryLabel || "—"}
                  </TableCell>
                  <TableCell>
                    {c.jurisdiction?.agencyLabel || "—"}
                  </TableCell>
                  <TableCell>{c.dispatch?.externalRef || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{c.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {total > 0 ? (
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Page {page} of {pageCount}
          </p>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  disabled={page <= 1 || busy}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  disabled={page >= pageCount || busy}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      ) : null}
    </div>
  );
}
