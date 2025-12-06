const http = require('http');
const crypto = require('crypto');

// Configuration
const API_URL = 'http://localhost:3000';

// Get arguments from command line
const args = process.argv.slice(2);
if (args.length < 2) {
    console.log('Usage: node scripts/simulate-deposit.js <CURRENCY> <ADDRESS>');
    console.log('Example: node scripts/simulate-deposit.js BTC tb1q...');
    process.exit(1);
}

const [currency, address] = args;
const txHash = '0x' + crypto.randomBytes(32).toString('hex');
const amount = 0.01;

const data = JSON.stringify({
    currency,
    amount,
    address,
    txHash
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/wallet/simulate-deposit',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

console.log(`🚀 Simulating ${currency} deposit...`);
console.log(`   Address: ${address}`);
console.log(`   TxHash:  ${txHash}`);
console.log(`   Amount:  ${amount}`);

const req = http.request(options, (res) => {
    let responseData = '';
    res.on('data', (chunk) => responseData += chunk);
    res.on('end', () => {
        console.log(`\n✅ Response: ${res.statusCode} ${res.statusMessage}`);
        console.log(responseData);
        console.log('\n👉 Check your other terminal running test-flow.js!');
    });
});

req.on('error', (error) => {
    console.error('❌ Error:', error.message);
});

req.write(data);
req.end();
