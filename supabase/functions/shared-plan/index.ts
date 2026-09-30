import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createSharingRuntime } from '../_shared/planSharingRuntime.ts';
Deno.serve(createSharingRuntime('public'));
