import { useState } from "react";
import { toast } from "sonner";
import { agencyApi } from "@/lib/agencyAuth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/misc";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Props = {
  agencyId: string;
  open: boolean;
  onClose: () => void;
};

export function AgencyPasswordModal({ agencyId, open, onClose }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) {
      toast.error("Kata laluan baharu tidak sepadan");
      return;
    }
    setBusy(true);
    try {
      await agencyApi(agencyId, "/api/agencies/me/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      toast.success("Kata laluan dikemas kini");
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader>
          <CardTitle>Tukar kata laluan</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={submit}>
            <div className="space-y-2">
              <Label>Kata laluan semasa</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label>Kata laluan baharu</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label>Sahkan kata laluan baharu</Label>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Batal
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Menyimpan…" : "Simpan"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
