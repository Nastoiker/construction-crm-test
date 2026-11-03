const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;
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
    }),
  },
);
if (!response.ok)
  throw new Error(`Cannot disable public signup: HTTP ${response.status}`);
const result = await response.json();
if (result.disable_signup !== true)
  throw new Error('Public signup configuration was not confirmed.');
console.log('Cloud Auth: public signup disabled.');
