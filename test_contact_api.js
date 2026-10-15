const http = require('http');

// Test contact message submission
const testContactAPI = () => {
  const testData = {
    name: 'Test User',
    email: 'test@example.com',
    message: 'This is a test message from the verification script. It should be stored in the database.',
  };

  const postData = JSON.stringify(testData);

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
      console.log('='.repeat(60));
      console.log('CONTACT API TEST RESULT');
      console.log('='.repeat(60));
      console.log(`Status Code: ${res.statusCode}`);
      console.log('Response:');
      console.log(JSON.stringify(JSON.parse(data), null, 2));
      console.log('='.repeat(60));

      if (res.statusCode === 201) {
        console.log('✓ Contact API is working correctly!');
        process.exit(0);
      } else {
        console.error('✗ Contact API test failed');
        process.exit(1);
      }
    });
  });

  req.on('error', (error) => {
    console.error('✗ Connection error:', error.message);
    console.log('\nNote: Make sure the backend server is running on port 5001');
    process.exit(1);
  });

  req.write(postData);
  req.end();
};

// Wait a moment for server to respond
console.log('Testing Contact API endpoint...');
console.log('Connecting to http://localhost:5001/api/contact/submit\n');

setTimeout(() => {
  testContactAPI();
}, 500);
