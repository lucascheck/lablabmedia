import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export function PendingApproval() {
  const { user, signOut } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="max-w-md w-full p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-brand-gold-lightest text-brand-gold mx-auto flex items-center justify-center">
          <Clock className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold tracking-[-0.01em]">Aguardando aprovação</h1>
        <p className="text-muted-foreground">
          Sua conta <span className="font-medium text-foreground">{user?.email}</span> foi criada com sucesso, mas
          ainda precisa ser aprovada por um administrador antes que você possa usar a plataforma.
        </p>
        <p className="text-sm text-muted-foreground">
          Você receberá acesso assim que um admin liberar sua conta.
        </p>
        <Button variant="outline" onClick={() => signOut()} className="mt-2">
          <LogOut className="h-4 w-4" /> Sair
        </Button>
      </Card>
    </div>
  );
}
