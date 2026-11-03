import { execFileSync } from 'node:child_process';

// Use the OS credential manager; credentials are never logged or written to disk.
export function githubToken() {
  const response = execFileSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, GCM_INTERACTIVE: 'never', GIT_TERMINAL_PROMPT: '0' },
  });
  const token = response
    .split('\n')
    .find((line) => line.startsWith('password='))
    ?.slice(9)
    .trim();
  if (!token) throw new Error('GitHub authentication is unavailable.');
  return token;
}
export async function github(path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${githubToken()}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok)
    throw new Error(
      `GitHub ${response.status}: ${data?.message || 'Request failed'}`,
    );
  return data;
}
if (process.argv.includes('--check')) {
  const user = await github('/user');
  console.log(`GitHub authenticated as ${user.login}.`);
}
