const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;
const appUrl = process.env.PUBLIC_APP_URL;
if (appUrl && new URL(appUrl).protocol !== 'https:')
  throw new Error('Public application URL must use HTTPS.');
if (!token || !ref || !/^[a-z0-9]+$/.test(ref))
  throw new Error('Missing or invalid Supabase deployment configuration.');
const response = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/config/auth`,
  {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      disable_signup: true,
      external_anonymous_users_enabled: false,
      jwt_exp: 900,
      refresh_token_rotation_enabled: true,
      security_refresh_token_reuse_interval: 10,
      password_min_length: 12,
      ...(appUrl ? { site_url: appUrl, uri_allow_list: appUrl } : {}),
    }),
  },
);
if (!response.ok)
  throw new Error(`Cannot disable public signup: HTTP ${response.status}`);
const result = await response.json();
if (
  result.disable_signup !== true ||
  result.jwt_exp !== 900 ||
  result.refresh_token_rotation_enabled !== true ||
  result.security_refresh_token_reuse_interval !== 10 ||
  result.password_min_length !== 12
)
  throw new Error('Cloud Auth security configuration was not confirmed.');
console.log(
  'Cloud Auth: signup disabled, JWT TTL 900s, refresh rotation enabled, passwords >=12 characters.',
);
