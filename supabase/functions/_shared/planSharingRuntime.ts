import { createClient } from 'npm:@supabase/supabase-js@2.110.0';
import { requireClerkUser } from './clerkAuth.ts';
import { sharingHandler, tokenKeys } from './planSharing.ts';

export function createSharingRuntime(mode: 'public' | 'owner') {
  const limit = (name: string, maximum: number) => {
    const raw = Deno.env.get(name);
    return raw === undefined ? maximum : /^\d+$/.test(raw) ? Math.min(maximum, Number(raw)) : 0;
  };
  // Lazily construct: missing deployment configuration returns a sanitized 503.
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const client = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.rpc(name, args);
    if (error) throw new Error('Sharing storage unavailable');
    return data;
  };
  return sharingHandler(mode, {
    enabled: Deno.env.get('SHARING_ENABLED') === 'true',
    origins: (Deno.env.get('SHARING_ALLOWED_ORIGINS') ?? '').split(',').map(s => s.trim()).filter(Boolean),
    authenticate: async request => (await requireClerkUser(request)).userId,
    reserve: async (scope, subject) => await rpc('reserve_sharing', { p_scope: scope, p_subject: subject,
      p_minute_cap: limit('SHARING_MINUTE_LIMIT', 120), p_day_cap: limit('SHARING_DAILY_LIMIT', 5000) }) === true,
    rpc,
    keys: () => tokenKeys(Deno.env.get('SHARING_TOKEN_ENCRYPTION_KEYS')),
    activeKey: () => Deno.env.get('SHARING_ACTIVE_KEY_ID') ?? ''
  });
}
