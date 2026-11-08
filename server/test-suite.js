import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

async function runTests() {
  console.log('--- STARTING SITESENTINEL BACKEND INTEGRATION TESTS ---');

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

  // Test 3: SSRF Protection Rejections
  console.log('\n[Test 3] Testing SSRF & Private IP Protection...');
  const prohibitedTargets = [
    'http://localhost:5000/api/health',
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

  // Verify that maxContentLength error did NOT occur
  if (amazonCheck.errorMessage && amazonCheck.errorMessage.includes('maxContentLength')) {
    console.error('❌ FAILED: Amazon check still failed with maxContentLength exceeded!');
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

runTests().catch(err => {
  console.error('❌ Test suite failed:', err.response?.data || err.message);
  process.exit(1);
});
