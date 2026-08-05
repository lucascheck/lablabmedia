import { getServiceClient, checkAdminAccessToken } from "@/lib/ai-config.server";

export async function createUserAsAdmin(input: {
  accessToken: string;
  email: string;
  password: string;
}): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const check = await checkAdminAccessToken(input.accessToken);
  if (!check.isAdmin) {
    return { ok: false, error: check.reason ?? "Apenas administradores podem criar usuários." };
  }

  const client = getServiceClient();
  if (!client) {
    return { ok: false, error: "Servidor sem SUPABASE_SERVICE_ROLE_KEY configurada." };
  }

  const { data, error } = await client.auth.admin.createUser({
    email: input.email.trim(),
    password: input.password,
    email_confirm: true,
  });

  if (error || !data.user) {
    return { ok: false, error: error?.message ?? "Erro ao criar usuário." };
  }

  // Foi um admin que criou diretamente, então já libera o acesso sem
  // precisar passar pela fila de aprovação manual.
  await client.from("profiles").update({ approved: true }).eq("id", data.user.id);

  return { ok: true, userId: data.user.id };
}
