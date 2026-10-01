require('dotenv').config();
const API_URL = 'http://localhost:5000/api';

// Generate unique timestamp for this test run
const timestamp = Date.now();
const cookieJar = new Map();
const testOrigin = process.env.TEST_ORIGIN || 'http://localhost:5173';

// Test state
let testState = {
  userId: null,
  shopId: null,
  employeeIds: [],
  pieceRateEmployeeId: null,
  orderId: null,
  assignmentIds: [],
  payrollRunId: null,
  errors: [],
  results: [],
  ownerEmail: `testowner${timestamp}@example.com`,
  employee2Email: `janesmith${timestamp}@example.com`,
};

// Utility function for API calls
async function apiCall(method, endpoint, body = null) {
  const headers = {
    'Content-Type': 'application/json',
    'Origin': testOrigin,
  };
  if (cookieJar.size) headers.Cookie = [...cookieJar].map(([name, value]) => `${name}=${value}`).join('; ');

  const options = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, options);
    const setCookies = response.headers.getSetCookie?.() || [response.headers.get('set-cookie') || ''];
    for (const setCookie of setCookies) {
      for (const match of setCookie.matchAll(/(?:^|,\s*)(sms_access|sms_refresh)=([^;,]*)/g)) {
        if (match[2]) cookieJar.set(match[1], match[2]);
        else cookieJar.delete(match[1]);
      }
    }
    const data = await response.json();
    return { status: response.status, data };
  } catch (error) {
    return { status: 0, error: error.message };
  }
}

// Test functions
async function test(name, fn) {
  console.log(`\n✓ Testing: ${name}`);
  try {
    await fn();
    testState.results.push({ name, status: 'PASS' });
  } catch (error) {
    console.error(`✗ Failed: ${error.message}`);
    testState.errors.push({ name, error: error.message });
    testState.results.push({ name, status: 'FAIL', error: error.message });
  }
}

// Test Suite
async function runTests() {
  console.log('========================================');
  console.log('SMS BACKEND - COMPREHENSIVE API TESTS');
  console.log('========================================');

  // ============= AUTH TESTS =============
  console.log('\n\n=== AUTH ENDPOINTS ===');

  await test('POST /auth/register', async () => {
    const response = await apiCall('POST', '/auth/register', {
      name: 'Test Owner',
      email: testState.ownerEmail,
      phone: '9876543210',
      password: 'TestPass123!',
      shopName: 'Test Shop',
      shopAddress: '123 Test Street',
    });
    if (response.status !== 201) throw new Error(`Expected 201, got ${response.status}: ${JSON.stringify(response.data)}`);
    if (!cookieJar.has('sms_access') || !cookieJar.has('sms_refresh')) throw new Error('Auth cookies were not set');
    if ('accessToken' in response.data || 'refreshToken' in response.data) throw new Error('Tokens must not be returned in JSON');
    testState.userId = response.data.user.id;
    testState.shopId = response.data.shop.id;
    console.log(`  → Owner ID: ${testState.userId}, Shop ID: ${testState.shopId}`);
  });

  await test('POST /auth/login', async () => {
    const response = await apiCall('POST', '/auth/login', {
      email: testState.ownerEmail,
      password: 'TestPass123!',
    });
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
    if (!cookieJar.has('sms_access') || !cookieJar.has('sms_refresh')) throw new Error('Auth cookies were not set');
    console.log(`  → Login successful, tokens refreshed`);
  });

  await test('POST /auth/refresh', async () => {
    const response = await apiCall('POST', '/auth/refresh');
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
    if ('accessToken' in response.data || 'refreshToken' in response.data) throw new Error('Tokens must not be returned in JSON');
    console.log(`  → Token refreshed successfully`);
  });

  await test('GET /me', async () => {
    const response = await apiCall('GET', '/me', null);
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
    console.log(`  → User authenticated: ${response.data.auth.user.name}`);
  });

  // ============= EMPLOYEE TESTS =============
  console.log('\n\n=== EMPLOYEE ENDPOINTS ===');

  await test('POST /employees (Create Employee 1)', async () => {
    const response = await apiCall('POST', '/employees', {
      name: 'John Doe',
      phone: '9123456789',
      designation: 'Tailor',
      payType: 'HOURLY',
      payRate: 200,
      joiningDate: new Date().toISOString(),
    });
    if (response.status !== 201) throw new Error(`Expected 201, got ${response.status}: ${JSON.stringify(response.data)}`);
    testState.employeeIds.push(response.data.id);
    console.log(`  → Employee created: ${response.data.id}`);
  });

  await test('POST /employees (Create Employee 2)', async () => {
    const response = await apiCall('POST', '/employees', {
      name: 'Jane Smith',
      phone: '9987654321',
      designation: 'Manager',
      payType: 'MONTHLY',
      payRate: 25000,
      joiningDate: new Date().toISOString(),
    });
    if (response.status !== 201) throw new Error(`Expected 201, got ${response.status}: ${JSON.stringify(response.data)}`);
    testState.employeeIds.push(response.data.id);
    console.log(`  → Employee created: ${response.data.id}`);
  });

  await test('POST /employees (Create Piece-Rate Employee)', async () => {
    const response = await apiCall('POST', '/employees', {
      name: 'Piece Worker',
      designation: 'Finisher',
      payType: 'PIECE_RATE',
      payRate: 15,
      joiningDate: new Date().toISOString(),
    });
    if (response.status !== 201) throw new Error(`Expected 201, got ${response.status}: ${JSON.stringify(response.data)}`);
    testState.pieceRateEmployeeId = response.data.id;
  });

  await test('GET /employees (List Employees)', async () => {
    const response = await apiCall('GET', '/employees', null);
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
    console.log(`  → Found ${response.data.length} employees`);
  });

  await test('GET /employees/{id}', async () => {
    const employeeId = testState.employeeIds[0];
    const response = await apiCall('GET', `/employees/${employeeId}`, null);
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
    console.log(`  → Retrieved employee: ${response.data.name}`);
  });

  await test('PATCH /employees/{id} (Update Employee)', async () => {
    const employeeId = testState.employeeIds[0];
    const response = await apiCall('PATCH', `/employees/${employeeId}`, {
      designation: 'Senior Tailor',
      payRate: 250,
    });
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
    console.log(`  → Employee updated: ${response.data.designation}`);
  });

  await test('POST /employees/{id}/grant-access', async () => {
    const employeeId = testState.employeeIds[1];
    const response = await apiCall('POST', `/employees/${employeeId}/grant-access`, {
      email: testState.employee2Email,
      role: 'MANAGER',
      password: 'JanePass123!',
    });
    if (response.status !== 201) throw new Error(`Expected 201, got ${response.status}: ${JSON.stringify(response.data)}`);
    console.log(`  → Access granted to employee`);
  });

  // ============= ATTENDANCE TESTS =============
  console.log('\n\n=== ATTENDANCE ENDPOINTS ===');

  await test('POST /attendance/checkin', async () => {
    const response = await apiCall('POST', '/attendance/checkin', {
      employeeId: testState.employeeIds[0],
    });
    if (response.status !== 201) throw new Error(`Expected 201, got ${response.status}: ${JSON.stringify(response.data)}`);
    console.log(`  → Employee checked in`);
  });

  await test('POST /attendance/checkout', async () => {
    const response = await apiCall('POST', '/attendance/checkout', {
      employeeId: testState.employeeIds[0],
    });
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
    console.log(`  → Employee checked out, hours: ${response.data.hoursWorked}`);
  });

  await test('POST /attendance/mark (Manual Mark)', async () => {
    const response = await apiCall('POST', '/attendance/mark', {
      employeeId: testState.employeeIds[1],
      date: new Date().toISOString(),
      status: 'PRESENT',
      notes: 'Marked present by owner',
    });
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
    console.log(`  → Attendance marked: ${response.data.status}`);
  });

  await test('POST /attendance/mark (Record Completed Pieces)', async () => {
    const response = await apiCall('POST', '/attendance/mark', {
      employeeId: testState.pieceRateEmployeeId,
      date: new Date().toISOString(),
      status: 'PRESENT',
      piecesCompleted: 12,
    });
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
    if (response.data.piecesCompleted !== 12) throw new Error(`Expected 12 pieces, got ${response.data.piecesCompleted}`);
  });

  await test('GET /attendance', async () => {
    const response = await apiCall('GET', `/attendance?employeeId=${testState.employeeIds[0]}`, null);
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
    console.log(`  → Found ${response.data.length} attendance records`);
  });

  // ============= PAYROLL TESTS =============
  console.log('\n\n=== PAYROLL ENDPOINTS ===');

  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const periodEnd = now.toISOString();

  await test('POST /payroll/preview', async () => {
    const response = await apiCall('POST', '/payroll/preview', {
      employeeId: testState.employeeIds[0],
      periodStart,
      periodEnd,
    });
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
    console.log(`  → Payroll preview: Gross ${response.data.grossPay}, Net ${response.data.netPay}`);
  });

  await test('POST /payroll/preview (Piece-Rate Calculation)', async () => {
    const response = await apiCall('POST', '/payroll/preview', {
      employeeId: testState.pieceRateEmployeeId,
      periodStart,
      periodEnd,
    });
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
    if (response.data.totalPieces !== 12 || response.data.grossPay !== 180) {
      throw new Error(`Expected 12 pieces and gross pay 180, got ${JSON.stringify(response.data)}`);
    }
  });

  await test('POST /payroll/runs (Save Piece-Rate Payroll)', async () => {
    const response = await apiCall('POST', '/payroll/runs', {
      employeeId: testState.pieceRateEmployeeId,
      periodStart,
      periodEnd,
    });
    if (response.status !== 201) throw new Error(`Expected 201, got ${response.status}: ${JSON.stringify(response.data)}`);
    if (response.data.totalPieces !== 12 || response.data.grossPay !== 180) {
      throw new Error(`Expected stored totals of 12 pieces and 180 pay, got ${JSON.stringify(response.data)}`);
    }
  });

  await test('POST /payroll/runs (Create Payroll Run)', async () => {
    const response = await apiCall('POST', '/payroll/runs', {
      employeeId: testState.employeeIds[0],
      periodStart,
      periodEnd,
    });
    if (response.status !== 201) throw new Error(`Expected 201, got ${response.status}: ${JSON.stringify(response.data)}`);
    testState.payrollRunId = response.data.id;
    console.log(`  → Payroll run created: ${response.data.id}`);
  });

  await test('GET /payroll/runs', async () => {
    const response = await apiCall('GET', '/payroll/runs', null);
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
    console.log(`  → Found ${response.data.length} payroll runs`);
  });

  await test('PATCH /payroll/runs/{id}/pay (Mark as Paid)', async () => {
    const response = await apiCall('PATCH', `/payroll/runs/${testState.payrollRunId}/pay`, {});
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
    console.log(`  → Payroll marked as paid, status: ${response.data.status}`);
  });

  // ============= ORDERS TESTS =============
  console.log('\n\n=== ORDERS ENDPOINTS ===');

  await test('POST /orders (Create Order)', async () => {
    const response = await apiCall('POST', '/orders', {
      clientName: 'Anjali Rao',
      clientPhone: '9123456780',
      instructions: 'Blue silk saree, blouse stitching',
      deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      amount: 3500,
      advancePayment: 1000,
    });
    if (response.status !== 201) throw new Error(`Expected 201, got ${response.status}: ${JSON.stringify(response.data)}`);
    testState.orderId = response.data.id;
    console.log(`  → Order created: ${response.data.id}, Balance: ${response.data.balance}`);
  });

  await test('GET /orders', async () => {
    const response = await apiCall('GET', '/orders', null);
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
    console.log(`  → Found ${response.data.length} orders`);
  });

  await test('GET /orders/{id}', async () => {
    const response = await apiCall('GET', `/orders/${testState.orderId}`, null);
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
    console.log(`  → Order status: ${response.data.status}, Balance: ${response.data.balance}`);
  });

  await test('PATCH /orders/{id} (Update Order Status)', async () => {
    const response = await apiCall('PATCH', `/orders/${testState.orderId}`, {
      status: 'IN_PROGRESS',
    });
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
    console.log(`  → Order status updated: ${response.data.status}`);
  });

  // ============= ASSIGNMENTS TESTS =============
  console.log('\n\n=== WORK ASSIGNMENTS ENDPOINTS ===');

  await test('POST /orders/{orderId}/assignments', async () => {
    const response = await apiCall('POST', `/orders/${testState.orderId}/assignments`, {
      employeeId: testState.employeeIds[0],
      task: 'Stitch blouse',
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      notes: 'Priority task',
    });
    if (response.status !== 201) throw new Error(`Expected 201, got ${response.status}: ${JSON.stringify(response.data)}`);
    testState.assignmentIds.push(response.data.id);
    console.log(`  → Assignment created: ${response.data.id}`);
  });

  await test('GET /orders/{orderId}/assignments', async () => {
    const response = await apiCall('GET', `/orders/${testState.orderId}/assignments`, null);
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
    console.log(`  → Found ${response.data.length} assignments for order`);
  });

  await test('GET /assignments', async () => {
    const response = await apiCall('GET', '/assignments', null);
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
    console.log(`  → Found ${response.data.length} total assignments`);
  });

  await test('PATCH /assignments/{id} (Update Assignment Status)', async () => {
    const response = await apiCall('PATCH', `/assignments/${testState.assignmentIds[0]}`, {
      status: 'IN_PROGRESS',
    });
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
    console.log(`  → Assignment status updated: ${response.data.status}`);
  });

  // ============= DASHBOARD TESTS =============
  console.log('\n\n=== DASHBOARD ENDPOINTS ===');

  await test('GET /dashboard/summary', async () => {
    const response = await apiCall('GET', '/dashboard/summary', null);
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
    console.log(`  → Dashboard data retrieved`);
    console.log(`     Stats: ${response.data.data.stats.totalEmployees} employees, ${response.data.data.stats.activeOrders} active orders`);
  });

  // ============= ADDITIONAL EMPLOYEE TESTS =============
  console.log('\n\n=== ADDITIONAL EMPLOYEE TESTS ===');

  await test('GET /employees?active=true', async () => {
    const response = await apiCall('GET', '/employees?active=true', null);
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
    console.log(`  → Found ${response.data.length} active employees`);
  });

  await test('DELETE /employees/{id} (Deactivate Employee)', async () => {
    const response = await apiCall('DELETE', `/employees/${testState.employeeIds[1]}`, null);
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
    console.log(`  → Employee deactivated`);
  });

  // ============= PASSWORD RESET TESTS =============
  console.log('\n\n=== PASSWORD RESET ENDPOINTS ===');

  await test('POST /auth/forgot-password', async () => {
    const response = await apiCall('POST', '/auth/forgot-password', {
      email: testState.ownerEmail,
    });
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
    console.log(`  → Password reset request sent (check console logs)`);
  });

  await test('POST /auth/logout (Revoke Cookie Session)', async () => {
    const response = await apiCall('POST', '/auth/logout');
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
    const afterLogout = await apiCall('GET', '/me');
    if (afterLogout.status !== 401) throw new Error(`Expected 401 after logout, got ${afterLogout.status}`);
  });

  // ============= RESULTS =============
  console.log('\n\n========================================');
  console.log('TEST RESULTS SUMMARY');
  console.log('========================================');

  const passed = testState.results.filter(r => r.status === 'PASS').length;
  const failed = testState.results.filter(r => r.status === 'FAIL').length;
  const total = testState.results.length;

  console.log(`\nTotal Tests: ${total}`);
  console.log(`✓ Passed: ${passed}`);
  console.log(`✗ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(2)}%`);

  if (testState.errors.length > 0) {
    console.log('\n\nFAILED TESTS:');
    testState.errors.forEach(err => {
      console.log(`\n✗ ${err.name}`);
      console.log(`  Error: ${err.error}`);
    });
  }

  console.log('\n\nTest execution completed!');
  console.log('Check the README.md and openapi.json for any endpoints that need documentation updates.');
}

// Run tests
runTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
