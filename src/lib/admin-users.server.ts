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

export async function deleteUserAsAdmin(input: {
  accessToken: string;
  userId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const check = await checkAdminAccessToken(input.accessToken);
  if (!check.isAdmin) {
    return { ok: false, error: check.reason ?? "Apenas administradores podem excluir usuários." };
  }

  if (check.userId === input.userId) {
    return { ok: false, error: "Você não pode excluir sua própria conta por aqui." };
  }

  const client = getServiceClient();
  if (!client) {
    return { ok: false, error: "Servidor sem SUPABASE_SERVICE_ROLE_KEY configurada." };
  }

  // Exclui direto do auth.users — profiles e user_roles têm ON DELETE
  // CASCADE, então saem junto automaticamente.
  const { error } = await client.auth.admin.deleteUser(input.userId);
  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
