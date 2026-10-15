const http = require('http');

const testCases = [
  {
    name: 'Invalid Email Format',
    data: {
      name: 'Test User',
      email: 'not-an-email',
      message: 'This is a test message with valid content.',
    },
    expectedStatus: 400,
  },
  {
    name: 'Missing Name',
    data: {
      name: '',
      email: 'test@example.com',
      message: 'This is a test message with valid content.',
    },
    expectedStatus: 400,
  },
  {
    name: 'Message Too Short',
    data: {
      name: 'Test User',
      email: 'test@example.com',
      message: 'Short',
    },
    expectedStatus: 400,
  },
  {
    name: 'Valid Message',
    data: {
      name: 'Validation Test User',
      email: 'validation@test.com',
      message: 'This is a valid test message that should be accepted by the system.',
    },
    expectedStatus: 201,
  },
];

let testIndex = 0;
let passedTests = 0;
let failedTests = 0;

const runTest = (testCase) => {
  return new Promise((resolve) => {
    const postData = JSON.stringify(testCase.data);

    const options = {
      hostname: 'localhost',
      port: 5001,
      path: '/api/contact/submit',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const success = res.statusCode === testCase.expectedStatus;
        const status = success ? '✓' : '✗';

        console.log(`${status} ${testCase.name}`);
        console.log(`  Expected Status: ${testCase.expectedStatus}, Got: ${res.statusCode}`);

        if (!success) {
          console.log(`  Response: ${data.substring(0, 100)}...`);
          failedTests++;
        } else {
          passedTests++;
        }

        console.log();
        resolve();
      });
    });

    req.on('error', (error) => {
      console.error(`✗ ${testCase.name}: ${error.message}`);
      failedTests++;
      resolve();
    });

    req.write(postData);
    req.end();
  });
};

const runAllTests = async () => {
  console.log('='.repeat(60));
  console.log('CONTACT API VALIDATION TESTS');
  console.log('='.repeat(60));
  console.log();

  for (const testCase of testCases) {
    await runTest(testCase);
  }

  console.log('='.repeat(60));
  console.log(`RESULTS: ${passedTests} passed, ${failedTests} failed`);
  console.log('='.repeat(60));

  process.exit(failedTests > 0 ? 1 : 0);
};

setTimeout(() => {
  runAllTests();
}, 500);
