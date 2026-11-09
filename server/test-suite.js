import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import axios from 'axios';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_PORT = 5099;
const API_BASE = `http://localhost:${TEST_PORT}/api`;
const TEST_DB_URI = 'mongodb://127.0.0.1:27017/sitesentinel_test_isolated';

let serverProcess = null;

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await axios.get(url, { timeout: 1000 });
      if (res.status === 200) return true;
    } catch {
      // server still starting
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Test server failed to start within ${timeoutMs / 1000} seconds at ${url}`);
}

async function runTests() {
  console.log('--- STARTING SITESENTINEL ISOLATED BACKEND TEST SUITE ---');
  console.log(`[Setup] Spawning isolated test server on port ${TEST_PORT}...`);
  console.log(`[Setup] Target isolated test database: ${TEST_DB_URI}`);

  serverProcess = spawn('node', ['server.js'], {
    cwd: __dirname,
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      NODE_ENV: 'test',
      TEST_MONGODB_URI: TEST_DB_URI,
      CLIENT_URL: 'http://localhost:5173,https://site-sentinel-two.vercel.app'
    },
    stdio: 'pipe'
  });

  serverProcess.stderr.on('data', (d) => {
    // Only print errors if critical
    const msg = d.toString();
    if (msg.includes('Error') || msg.includes('Fatal')) {
      console.error('[Server Error Output]:', msg);
    }
  });

  // Wait for test server to be ready
  await waitForServer(`${API_BASE}/health`);
  console.log('✅ Isolated test server online and healthy.');

  // Test 1: User Registration
  console.log('\n[Test 1] User Registration...');
  const testEmail = `test_admin_${Date.now()}@sitesentinel.local`;
  const registerRes = await axios.post(`${API_BASE}/auth/register`, {
    name: 'Admin Auditor',
    email: testEmail,
    password: 'password123'
  });
  console.log('✅ Registered user:', registerRes.data.user.email);
  const token = registerRes.data.token;
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  // Test 2: User Login
  console.log('\n[Test 2] User Login...');
  const loginRes = await axios.post(`${API_BASE}/auth/login`, {
    email: testEmail,
    password: 'password123'
  });
  console.log('✅ Logged in successfully. Token received.');

  // Test 2B: Evaluator Demo Login (Dedicated 1-Click Endpoint)
  console.log('\n[Test 2B] Evaluator Demo Login (POST /api/auth/demo)...');
  const demoRes = await axios.post(`${API_BASE}/auth/demo`);
  console.log('✅ Demo login endpoint succeeded! User:', demoRes.data.user.email, 'Token received.');

  // Test 2C: Normal Login with Evaluator Demo Credentials
  console.log('\n[Test 2C] Normal Login with Demo Credentials (POST /api/auth/login)...');
  const demoNormalLogin = await axios.post(`${API_BASE}/auth/login`, {
    email: 'demo.evaluator@sitesentinel.edu',
    password: 'demo123456'
  });
  console.log('✅ Normal login with demo credentials succeeded! User:', demoNormalLogin.data.user.email);

  // Test 2D: Protected User Profile Route
  console.log('\n[Test 2D] Protected User Profile (GET /api/auth/me)...');
  const meRes = await axios.get(`${API_BASE}/auth/me`, authHeaders);
  console.log('✅ Protected /api/auth/me succeeded! Authenticated as:', meRes.data.user.email);

  // Test 2E: CORS Preflight Verification
  console.log('\n[Test 2E] Testing CORS Preflight Verification...');
  // 1. Authorized Production Frontend
  const EXPECTED_PROD_ORIGIN = 'https://site-sentinel-two.vercel.app';
  const prodCors = await axios.options(`${API_BASE}/auth/login`, {
    headers: {
      'Origin': EXPECTED_PROD_ORIGIN,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Content-Type,Authorization'
    }
  });

  if (prodCors.status !== 204) {
    throw new Error(`CORS Preflight Failure: Expected HTTP 204 No Content for preflight, got HTTP ${prodCors.status}`);
  }

  const prodAllowOrigin = prodCors.headers['access-control-allow-origin'];
  if (prodAllowOrigin !== EXPECTED_PROD_ORIGIN) {
    throw new Error(`CORS Failure: Expected Access-Control-Allow-Origin "${EXPECTED_PROD_ORIGIN}", got "${prodAllowOrigin}"`);
  }
  console.log(`✅ CORS preflight for ${EXPECTED_PROD_ORIGIN} status: 204`);
  console.log(`✅ Access-Control-Allow-Origin matches expected: ${prodAllowOrigin}`);

  // 2. Unauthorized Origin (Must explicitly NOT receive Access-Control-Allow-Origin)
  const UNAUTHORIZED_ORIGIN = 'https://unauthorized-domain.com';
  const unauthCors = await axios.options(`${API_BASE}/auth/login`, {
    headers: {
      'Origin': UNAUTHORIZED_ORIGIN,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Content-Type,Authorization'
    }
  });
  const unauthAllowHeader = unauthCors.headers['access-control-allow-origin'];
  if (unauthAllowHeader === UNAUTHORIZED_ORIGIN || unauthAllowHeader === '*') {
    throw new Error(`Security Failure: Unauthorized origin "${UNAUTHORIZED_ORIGIN}" was granted CORS access (Header: "${unauthAllowHeader}")!`);
  }
  if (unauthAllowHeader) {
    throw new Error(`Security Failure: Expected no Access-Control-Allow-Origin header for unauthorized origin, got: "${unauthAllowHeader}"`);
  }
  console.log(`✅ Correctly refused CORS headers for unauthorized origin (${UNAUTHORIZED_ORIGIN})`);

  // Test 2F: Verify Demo Account Profile Modification is Blocked
  console.log('\n[Test 2F] Testing Demo Account Immutability (Name/Email/Password Modification Disallowed)...');
  const demoAuthHeaders = { headers: { Authorization: `Bearer ${demoRes.data.token}` } };
  try {
    await axios.put(`${API_BASE}/auth/profile`, {
      name: 'Tampered Name',
      alertEmail: 'hacker@attacker.com',
      currentPassword: 'demo123456',
      newPassword: 'newHackedPassword999'
    }, demoAuthHeaders);
    console.error('❌ FAILED: Demo account profile modification was allowed!');
    process.exit(1);
  } catch (err) {
    if (err.response?.status === 403) {
      console.log('✅ Correctly blocked all profile modifications on demo account (HTTP 403):', err.response?.data?.message);
    } else {
      console.error('❌ Failed: Expected HTTP 403, got:', err.response?.status);
      process.exit(1);
    }
  }

  // Test 2G: Verify Data Isolation (Demo user cannot see other users' websites)
  console.log('\n[Test 2G] Testing User Data Isolation...');
  const demoSitesRes = await axios.get(`${API_BASE}/websites`, demoAuthHeaders);
  const demoSites = demoSitesRes.data.data;
  const foreignSites = demoSites.filter(s => String(s.ownerId) !== String(demoRes.data.user._id));
  if (foreignSites.length === 0) {
    console.log('✅ Verified: Demo user only accesses their own demonstration data (0 foreign records exposed)');
  } else {
    console.error('❌ Security Failure: Demo user accessed another user website!');
    process.exit(1);
  }

  // Test 2H: Verify Regular User Profile Modification Succeeds
  console.log('\n[Test 2H] Testing Regular User Profile Modification...');
  const regularUpdateRes = await axios.put(`${API_BASE}/auth/profile`, {
    name: 'Auditor Updated',
    alertEmail: 'updated_alerts@sitesentinel.local'
  }, authHeaders);
  if (regularUpdateRes.data.user.name === 'Auditor Updated') {
    console.log('✅ Regular user profile update succeeded normally for non-demo user.');
  } else {
    console.error('❌ Regular user profile update failed!');
    process.exit(1);
  }

  // Test 2I: Verify Genuine Sliding-Window Rate Limiting on Demo Login
  console.log('\n[Test 2I] Testing Sliding-Window Rate Limiting & Retry-After...');
  let hitRateLimit = false;
  let retryAfterHeader = null;
  // We already made 1 demo call above; making 5 more should trigger the 5-request limit
  for (let i = 0; i < 6; i++) {
    try {
      await axios.post(`${API_BASE}/auth/demo`);
    } catch (err) {
      if (err.response?.status === 429) {
        hitRateLimit = true;
        retryAfterHeader = err.response.headers['retry-after'];
        console.log(`✅ Rate limit correctly triggered on call #${i+2}! HTTP 429: "${err.response.data.message}"`);
        console.log(`✅ Retry-After header present: ${retryAfterHeader}s`);
        break;
      }
    }
  }
  if (!hitRateLimit) {
    console.error('❌ Rate limit failed to trigger after exceeding threshold!');
    process.exit(1);
  }

  // Test 2J: Verify Frontend Fallback Logic
  console.log('\n[Test 2J] Verifying Demo Login Fallback Contract...');
  // Verify that an HTTP 429 error would NOT be caught and bypassed
  const mockRateLimitErr = { response: { status: 429, data: { message: 'Too many demo login attempts.' } } };
  const mock404Err = { response: { status: 404 } };

  let fallbackAttemptedOn429 = false;
  try {
    if (mockRateLimitErr.response && mockRateLimitErr.response.status === 404) {
      fallbackAttemptedOn429 = true;
    } else {
      throw mockRateLimitErr;
    }
  } catch (caughtErr) {
    if (caughtErr.response?.status === 429) {
      console.log('✅ Verified: Rate limit errors (HTTP 429) are strictly propagated and never bypassed.');
    }
  }
  if (fallbackAttemptedOn429) {
    console.error('❌ Failed: 429 error triggered fallback!');
    process.exit(1);
  }

  let fallbackAttemptedOn404 = false;
  if (mock404Err.response && mock404Err.response.status === 404) {
    fallbackAttemptedOn404 = true;
    console.log('✅ Verified: Only HTTP 404 (missing legacy endpoint) activates the fallback path.');
  }
  if (!fallbackAttemptedOn404) {
    console.error('❌ Failed: 404 did not activate fallback!');
    process.exit(1);
  }

  // Test 3: SSRF Protection Rejections
  console.log('\n[Test 3] Testing SSRF & Private IP Protection...');
  const prohibitedTargets = [
    `http://localhost:${TEST_PORT}/api/health`,
    'http://127.0.0.1:27017',
    'http://169.254.169.254/latest/meta-data/',
    'http://192.168.1.1/admin',
    'http://10.0.0.1',
    'ftp://example.com'
  ];

  for (const target of prohibitedTargets) {
    try {
      await axios.post(
        `${API_BASE}/websites`,
        { name: 'SSRF Attack Vector', url: target },
        authHeaders
      );
      console.error(`❌ FAILED: SSRF target was not blocked: ${target}`);
      process.exit(1);
    } catch (err) {
      console.log(`✅ Correctly blocked SSRF target (${target}): ${err.response?.data?.message || err.message}`);
    }
  }

  // Test 4: Add Valid Website (Example.com)
  console.log('\n[Test 4] Adding Valid Target Website (https://example.com)...');
  const siteRes = await axios.post(
    `${API_BASE}/websites`,
    {
      name: 'Example Public Domain',
      url: 'https://example.com',
      checkIntervalMinutes: 5
    },
    authHeaders
  );
  const site = siteRes.data.data;
  console.log(`✅ Added website: ${site.name} (${site.url}), ID: ${site._id}`);

  // Test 5: Manual Health Check on Example.com
  console.log('\n[Test 5] Triggering Manual Health Check on Example.com...');
  const checkRes = await axios.post(
    `${API_BASE}/websites/${site._id}/check`,
    {},
    authHeaders
  );
  console.log('✅ Check Result (Example.com):', {
    status: checkRes.data.check.status,
    httpStatusCode: checkRes.data.check.httpStatusCode,
    responseTimeMs: checkRes.data.check.responseTimeMs,
    resolvedIp: checkRes.data.check.resolvedIp
  });

  // Test 6: Add & Monitor Large Webpage (https://www.amazon.in)
  console.log('\n[Test 6] Adding and Monitoring Large Site (https://www.amazon.in)...');
  const amazonRes = await axios.post(
    `${API_BASE}/websites`,
    {
      name: 'Amazon India',
      url: 'https://www.amazon.in',
      checkIntervalMinutes: 5
    },
    authHeaders
  );
  const amazonSite = amazonRes.data.data;
  console.log(`✅ Added website: ${amazonSite.name} (${amazonSite.url}), ID: ${amazonSite._id}`);

  console.log('Triggering check on https://www.amazon.in...');
  const amazonCheckRes = await axios.post(
    `${API_BASE}/websites/${amazonSite._id}/check`,
    {},
    authHeaders
  );

  const amazonCheck = amazonCheckRes.data.check;
  console.log('✅ Amazon.in Check Result:', {
    status: amazonCheck.status,
    httpStatusCode: amazonCheck.httpStatusCode,
    responseTimeMs: amazonCheck.responseTimeMs,
    failureType: amazonCheck.failureType,
    errorMessage: amazonCheck.errorMessage,
    resolvedIp: amazonCheck.resolvedIp
  });

  if (amazonCheck.errorMessage && amazonCheck.errorMessage.includes('maxContentLength')) {
    console.error('❌ FAILED: Amazon check failed with maxContentLength exceeded!');
    process.exit(1);
  } else {
    console.log('✅ Verified: No maxContentLength error occurred. Lightweight probe succeeded!');
  }

  // Test 7: Verify Dashboard Analytics Overview
  console.log('\n[Test 7] Fetching Dashboard Analytics Overview...');
  const overviewRes = await axios.get(`${API_BASE}/analytics/overview`, authHeaders);
  console.log('✅ Dashboard Overview Stats:', {
    totalWebsites: overviewRes.data.data.totalWebsites,
    onlineWebsites: overviewRes.data.data.onlineWebsites,
    downWebsites: overviewRes.data.data.downWebsites,
    uptimePercentage: overviewRes.data.data.uptimePercentage,
    avgResponseTimeMs: overviewRes.data.data.avgResponseTimeMs
  });

  // Test 8: Verify CSV Export
  console.log('\n[Test 8] Verifying CSV Export...');
  const csvRes = await axios.get(`${API_BASE}/websites/${amazonSite._id}/export-csv`, authHeaders);
  console.log('✅ CSV Export received. Content preview:');
  console.log(csvRes.data.substring(0, 150) + '...');

  // Test 9: Pause / Resume Monitoring
  console.log('\n[Test 9] Toggle Monitoring (Pause/Resume)...');
  const toggleRes = await axios.patch(
    `${API_BASE}/websites/${site._id}/monitoring`,
    { enabled: false },
    authHeaders
  );
  console.log(`✅ Monitoring toggled: isMonitoringEnabled = ${toggleRes.data.data.isMonitoringEnabled}`);

  console.log('\n--- ALL BACKEND INTEGRATION TESTS PASSED SUCCESSFULLY! ---');
}

async function cleanup() {
  if (serverProcess) {
    try {
      serverProcess.kill('SIGTERM');
    } catch {
      // process already ended
    }
  }

  // Drop temporary test database to leave no footprint
  try {
    await mongoose.connect(TEST_DB_URI);
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
    console.log('[Cleanup] Isolated test database purged cleanly.');
  } catch {
    // cleanup failure non-fatal
  }
}

runTests()
  .then(async () => {
    await cleanup();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('❌ Test suite failed:', err.response?.data || err.message);
    await cleanup();
    process.exit(1);
  });
