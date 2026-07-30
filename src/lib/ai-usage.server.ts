import { getAuthedClient, isAdminAccessToken, readSetting, writeSetting } from "@/lib/ai-config.server";

const DAILY_LIMIT_KEY = "GEMINI_DAILY_LIMIT";
const MONTHLY_LIMIT_KEY = "GEMINI_MONTHLY_LIMIT";
const DEFAULT_DAILY_LIMIT = 250;
const DEFAULT_MONTHLY_LIMIT = 5000;

export async function getUsageLimits() {
  const [dailyRaw, monthlyRaw] = await Promise.all([readSetting(DAILY_LIMIT_KEY), readSetting(MONTHLY_LIMIT_KEY)]);
  const daily = Number(dailyRaw);
  const monthly = Number(monthlyRaw);
  return {
    dailyLimit: Number.isFinite(daily) && daily > 0 ? daily : DEFAULT_DAILY_LIMIT,
    monthlyLimit: Number.isFinite(monthly) && monthly > 0 ? monthly : DEFAULT_MONTHLY_LIMIT,
  };
}

export async function setUsageLimits(dailyLimit: number, monthlyLimit: number) {
  await Promise.all([
    writeSetting(DAILY_LIMIT_KEY, String(Math.round(dailyLimit))),
    writeSetting(MONTHLY_LIMIT_KEY, String(Math.round(monthlyLimit))),
  ]);
}

export type LogAiUsageInput = {
  accessToken: string;
  mode: string;
  slideCount?: number;
  success: boolean;
  tokensInput?: number | null;
  tokensOutput?: number | null;
  errorMessage?: string | null;
};

export async function logAiUsage(input: LogAiUsageInput): Promise<void> {
  const authed = await getAuthedClient(input.accessToken);
  if (!authed) return;
  await authed.supabase.from("ai_usage_logs").insert({
    user_id: authed.userId,
    mode: input.mode,
    slide_count: input.slideCount ?? null,
    success: input.success,
    tokens_input: input.tokensInput ?? null,
    tokens_output: input.tokensOutput ?? null,
    error_message: input.errorMessage?.slice(0, 500) ?? null,
  });
}

export type UsageRow = {
  id: string;
  created_at: string;
  mode: string;
  slide_count: number | null;
  success: boolean;
  tokens_input: number | null;
  tokens_output: number | null;
  error_message: string | null;
};

export type UsageStats = {
  isAdmin: boolean;
  dailyLimit: number;
  monthlyLimit: number;
  dailyCount: number;
  monthlyCount: number;
  totalCount: number;
  successCount: number;
  tokensToday: number;
  recent: UsageRow[];
};

export async function getUsageStats(accessToken: string): Promise<UsageStats | null> {
  const authed = await getAuthedClient(accessToken);
  if (!authed) return null;

  const isAdmin = await isAdminAccessToken(accessToken);
  const { dailyLimit, monthlyLimit } = await getUsageLimits();

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  let query = authed.supabase.from("ai_usage_logs").select("*").order("created_at", { ascending: false });
  if (!isAdmin) query = query.eq("user_id", authed.userId);

  const { data } = await query.limit(2000);
  const rows = data ?? [];

  const monthlyRows = rows.filter((r) => r.created_at >= startOfMonth);
  const dailyRows = rows.filter((r) => r.created_at >= startOfDay);
  const tokensToday = dailyRows.reduce((sum, r) => sum + (r.tokens_input ?? 0) + (r.tokens_output ?? 0), 0);

  return {
    isAdmin,
    dailyLimit,
    monthlyLimit,
    dailyCount: dailyRows.length,
    monthlyCount: monthlyRows.length,
    totalCount: rows.length,
    successCount: rows.filter((r) => r.success).length,
    tokensToday,
    recent: rows.slice(0, 12),
  };
}
