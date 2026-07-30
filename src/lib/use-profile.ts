import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type UserProfile = {
  id: string;
  email: string;
  approved: boolean;
  isAdmin: boolean;
};

export function useProfile() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (authLoading) return;
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const [{ data: prof }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id,email,approved").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      if (!active) return;
      setProfile({
        id: user.id,
        email: prof?.email ?? user.email ?? "",
        approved: prof?.approved ?? false,
        isAdmin: (roles ?? []).some((r) => r.role === "admin"),
      });
      setLoading(false);
    })();
    return () => { active = false; };
  }, [user, authLoading]);

  return { profile, loading: loading || authLoading };
}
