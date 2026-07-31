import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const GEMINI_KEY_NAME = "GEMINI_API_KEY";

let serviceClient: SupabaseClient<Database> | null = null;

/**
 * Cliente com a service_role key — ignora RLS. Só deve ser usado em código
 * server-side (nunca importado por um componente cliente). Guarda as
 * configurações da IA (chave, limites) numa tabela que nenhum usuário
 * autenticado consegue ler direto pela API do Supabase.
 */
function getServiceClient(): SupabaseClient<Database> | null {
  if (serviceClient) return serviceClient;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  serviceClient = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serviceClient;
}

export async function readSetting(key: string): Promise<string | undefined> {
  const client = getServiceClient();
  if (!client) return undefined;
  const { data } = await client.from("app_settings").select("value").eq("key", key).maybeSingle();
  return data?.value;
}

export async function writeSetting(key: string, value: string): Promise<void> {
  const client = getServiceClient();
  if (!client) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.");
  const { error } = await client.from("app_settings").upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function isAiConfigured(): Promise<boolean> {
  const value = await readSetting(GEMINI_KEY_NAME);
  return Boolean(value);
}

export async function getGeminiApiKey(): Promise<string | undefined> {
  return readSetting(GEMINI_KEY_NAME);
}

export async function writeGeminiApiKey(apiKey: string): Promise<void> {
  await writeSetting(GEMINI_KEY_NAME, apiKey);
}

/** Cliente Supabase autenticado como o usuário do token (respeita RLS). Retorna null se o token for inválido. */
export async function getAuthedClient(
  accessToken: string | undefined | null,
): Promise<{ supabase: SupabaseClient<Database>; userId: string } | null> {
  if (!accessToken) {
    console.error("[getAuthedClient] accessToken vazio/ausente");
    return null;
  }
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    console.error(
      `[getAuthedClient] faltando env var(s): ${!SUPABASE_URL ? "SUPABASE_URL " : ""}${!SUPABASE_PUBLISHABLE_KEY ? "SUPABASE_PUBLISHABLE_KEY" : ""}`.trim(),
      "| chaves SUPABASE* visíveis no processo:",
      Object.keys(process.env).filter((k) => k.includes("SUPABASE")),
    );
    return null;
  }

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(accessToken);
  if (userErr || !userData?.user) {
    console.error("[getAuthedClient] getUser falhou:", userErr?.message ?? "sem usuário retornado");
    return null;
  }

  return { supabase, userId: userData.user.id };
}

export async function isAdminAccessToken(accessToken: string | undefined | null): Promise<boolean> {
  const authed = await getAuthedClient(accessToken);
  if (!authed) return false;

  const { data: roles, error } = await authed.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", authed.userId);

  if (error) {
    console.error("[isAdminAccessToken] erro ao consultar user_roles:", error.message);
    return false;
  }

  const isAdmin = (roles ?? []).some((r) => r.role === "admin");
  if (!isAdmin) {
    console.error(`[isAdminAccessToken] usuário ${authed.userId} não tem role admin. roles encontradas:`, roles);
  }
  return isAdmin;
}

/**
 * Igual a isAdminAccessToken, mas devolve o motivo exato da falha em texto,
 * pra mostrar direto na tela em vez de precisar olhar os logs do servidor.
 */
export async function checkAdminAccessToken(
  accessToken: string | undefined | null,
): Promise<{ isAdmin: boolean; reason?: string }> {
  if (!accessToken) {
    return { isAdmin: false, reason: "sessão não encontrada (token vazio). Saia e entre de novo." };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return {
      isAdmin: false,
      reason: "servidor sem SUPABASE_URL/SUPABASE_PUBLISHABLE_KEY configuradas.",
    };
  }

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(accessToken);
  if (userErr || !userData?.user) {
    return {
      isAdmin: false,
      reason: `sessão inválida ou expirada (${userErr?.message ?? "sem usuário retornado"}). Saia e entre de novo.`,
    };
  }

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);

  if (error) {
    return { isAdmin: false, reason: `erro ao consultar permissões: ${error.message}` };
  }

  const isAdmin = (roles ?? []).some((r) => r.role === "admin");
  if (!isAdmin) {
    return {
      isAdmin: false,
      reason: `a conta ${userData.user.email ?? userData.user.id} não tem papel de admin no banco.`,
    };
  }

  return { isAdmin: true };
}
