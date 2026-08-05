import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/use-profile";
import { createUser } from "@/lib/admin-users.functions";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, ShieldOff, Check, X, Shield, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "Admin — LabMedia" }] }),
});

type Row = {
  id: string;
  email: string;
  approved: boolean;
  created_at: string;
  isAdmin: boolean;
};

function AdminPage() {
  const { profile, loading: profLoading } = useProfile();
  const navigate = useNavigate();
  const createUserFn = useServerFn(createUser);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!profLoading && profile && !profile.isAdmin) {
      navigate({ to: "/" });
    }
  }, [profLoading, profile, navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: profs }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id,email,approved,created_at").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    const adminSet = new Set((roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));
    setRows((profs ?? []).map((p) => ({ ...p, isAdmin: adminSet.has(p.id) })));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (profile?.isAdmin) load();
  }, [profile?.isAdmin, load]);

  const setApproval = async (id: string, approved: boolean) => {
    const { error } = await supabase.from("profiles").update({ approved }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(approved ? "Usuário aprovado" : "Aprovação removida");
    load();
  };

  const toggleAdmin = async (id: string, isAdmin: boolean) => {
    if (isAdmin) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", id).eq("role", "admin");
      if (error) return toast.error(error.message);
      toast.success("Admin removido");
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: id, role: "admin" });
      if (error) return toast.error(error.message);
      toast.success("Admin concedido");
    }
    load();
  };

  const handleCreateUser = async () => {
    if (!newEmail.trim() || newPassword.length < 6) {
      toast.error("Preencha o email e uma senha com no mínimo 6 caracteres");
      return;
    }
    setCreating(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token ?? "";
    const result = await createUserFn({
      data: { accessToken, email: newEmail.trim(), password: newPassword },
    });
    setCreating(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Usuário criado e já aprovado");
    setCreateOpen(false);
    setNewEmail("");
    setNewPassword("");
    load();
  };

  if (profLoading || !profile?.isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-8 px-4 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-brand-starbucks to-brand-accent flex items-center justify-center">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-[-0.01em]">Admin</h1>
            <p className="text-sm text-muted-foreground">Gerencie usuários e aprovações de acesso</p>
          </div>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Criar usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar novo usuário</DialogTitle>
              <DialogDescription>
                Cria a conta direto e já libera o acesso (sem precisar de aprovação nem confirmação por email).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-user-email">Email</Label>
                <Input
                  id="new-user-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  disabled={creating}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-user-password">Senha inicial</Label>
                <Input
                  id="new-user-password"
                  type="text"
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={creating}
                />
                <p className="text-xs text-muted-foreground">
                  Compartilhe essa senha com a pessoa — ela pode trocá-la depois de entrar.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateUser} disabled={creating}>
                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar usuário
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {r.email}
                      {r.isAdmin && <Badge variant="secondary" className="gap-1"><ShieldCheck className="h-3 w-3" /> admin</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {r.approved ? (
                      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20">aprovado</Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-300">pendente</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {r.approved ? (
                      <Button size="sm" variant="outline" onClick={() => setApproval(r.id, false)}>
                        <X className="h-4 w-4" /> Revogar
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => setApproval(r.id, true)}>
                        <Check className="h-4 w-4" /> Aprovar
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => toggleAdmin(r.id, r.isAdmin)}>
                      {r.isAdmin ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                      {r.isAdmin ? "Remover admin" : "Tornar admin"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
