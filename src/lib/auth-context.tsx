import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      setLoading(false);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });

    // getSession() só lê o localStorage — não garante que o token ainda é
    // válido pra este projeto Supabase (ex: sessão de antes de trocarmos as
    // env vars). Rede lenta/travada num cenário assim não deve travar a UI
    // pra sempre, então há um timeout de segurança que libera a tela mesmo
    // se nada resolver a tempo.
    const safetyTimeout = setTimeout(() => {
      console.error("[auth] getSession/getUser demorou demais, liberando a tela");
      finish();
    }, 6000);

    supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (error || !data.session) {
          if (error) console.error("[auth] sessão inválida, limpando:", error.message);
          setSession(null);
          setUser(null);
          return;
        }

        // getUser() valida o token contra o servidor (não confia só no que
        // está no localStorage).
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userData.user) {
          console.error("[auth] sessão local inválida para este projeto, limpando:", userErr?.message);
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          return;
        }

        setSession(data.session);
        setUser(userData.user);
      })
      .catch((err) => {
        console.error("[auth] erro ao recuperar sessão:", err);
        setSession(null);
        setUser(null);
      })
      .finally(() => {
        clearTimeout(safetyTimeout);
        finish();
      });

    return () => {
      clearTimeout(safetyTimeout);
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
