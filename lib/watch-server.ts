import {createClient} from '@supabase/supabase-js';
// Never imported by client components. This key is restricted to the price-check worker.
export function watchAdmin(){const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;return url&&key?createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}):null;}
export function backgroundConfigured(){return process.env.PRICE_WATCH_ENABLED==='true'&&!!process.env.CRON_SECRET&&!!process.env.SUPABASE_SERVICE_ROLE_KEY&&!!(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL);}
