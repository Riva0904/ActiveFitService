import { chromium } from 'playwright';

const CHROME = 'C:\\Users\\TLTUser\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const API = 'http://localhost:3001/api/v1';

// Get JWT token + user via API
async function loginApi(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  return { token: json.accessToken, user: json.user };
}

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const shot = async (page, name) => page.screenshot({ path: `c:/Ajith/ActiveFit/${name}.png` });

async function makeAuthPage(token, user) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 820 } });
  await ctx.addCookies([{
    name: 'ab_token', value: token, domain: 'localhost', path: '/', httpOnly: false, secure: false,
  }]);
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  // Must hit the origin first before we can access localStorage
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  // Inject Zustand persisted auth state into localStorage
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('activefit-auth', JSON.stringify({ state: { user, token }, version: 0 }));
  }, { token, user });
  return { page, ctx };
}

// ── 1. Admin chat — Members tab ──────────────────────────────────────────────
try {
  const { token, user } = await loginApi('admin@fitnesshub.com', 'Password@123');
  console.log('Admin token:', token ? 'OK' : 'FAILED', '| user:', user?.role);
  const { page, ctx } = await makeAuthPage(token, user);

  // Wait for dashboard to fully load, then navigate to chat via sidebar click
  await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Click the Chat sidebar link
  const chatLink = page.locator('a[href="/admin/chat"]');
  await chatLink.click();
  await page.waitForURL('**/admin/chat', { timeout: 8000 });
  await page.waitForTimeout(2500);
  console.log('Admin chat URL:', page.url());
  await shot(page, 'chat_admin_members');
  console.log('Shot: chat_admin_members');

  // Click Support tab inside the chat page
  const supportBtn = page.locator('button').filter({ hasText: /Support/i }).first();
  if (await supportBtn.count() > 0) {
    await supportBtn.click();
    await page.waitForTimeout(1500);
    await shot(page, 'chat_admin_support');
    console.log('Shot: chat_admin_support');
  } else {
    console.log('Support tab not found');
  }
  await ctx.close();
} catch(e) {
  console.error('Admin chat error:', e.message);
}

// ── 2. SuperAdmin chat page ──────────────────────────────────────────────────
try {
  const { token, user } = await loginApi('superadmin@activeboost.com', 'Password@123');
  console.log('SuperAdmin token:', token ? 'OK' : 'FAILED', '| user:', user?.role);
  const { page, ctx } = await makeAuthPage(token, user);

  // Wait for dashboard to load, then navigate via sidebar
  await page.goto('http://localhost:3000/super-admin', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const chatLink = page.locator('a[href="/super-admin/chat"]');
  await chatLink.click();
  await page.waitForURL('**/super-admin/chat', { timeout: 8000 });
  await page.waitForTimeout(2500);
  console.log('SuperAdmin chat URL:', page.url());
  await shot(page, 'chat_superadmin');
  console.log('Shot: chat_superadmin');
  await ctx.close();
} catch(e) {
  console.error('SuperAdmin chat error:', e.message);
}

await browser.close();
console.log('Done');
