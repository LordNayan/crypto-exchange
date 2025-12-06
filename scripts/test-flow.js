const crypto = require('crypto');
const WebSocket = require('ws');
const http = require('http');

// Configuration
const API_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000/ws';
const API_KEY = 'demo-public-key';
const SECRET_KEY = 'demo-secret-key';

// Helper to generate signature
function generateHeaders(method, path, body = '') {
    const nonce = Date.now().toString();
    const payload = `${nonce}${method.toUpperCase()}${path}${body}`;
    const signature = crypto.createHmac('sha384', SECRET_KEY)
        .update(payload)
        .digest('hex');

    return {
        'nyn-apikey': API_KEY,
        'nyn-signature': signature,
        'nyn-nonce': nonce,
        'Content-Type': 'application/json',
    };
}

// Helper to make HTTP requests
function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const bodyStr = body ? JSON.stringify(body) : '';
        const headers = generateHeaders(method, path, bodyStr);
        
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: headers,
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({ status: res.statusCode, data: json });
                } catch (e) {
                    resolve({ status: res.statusCode, data });
                }
            });
        });

        req.on('error', reject);
        if (bodyStr) req.write(bodyStr);
        req.end();
    });
}

async function main() {
    console.log('🚀 Starting End-to-End Test Flow...');

    // 1. Generate Addresses
    console.log('\n📍 Step 1: Generating Deposit Addresses...');
    
    // We need a userId. In the current implementation, it seems userId is passed as query param
    // or derived from API key if auth is enabled.
    // The hardcoded API key is for 'user-1'.
    const userId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'; 

    try {
        // Generate BTC Address
        console.log('Generating BTC Address...');
        const btcRes = await request('POST', '/wallet/address', { userId, currency: 'BTC' });
        console.log('BTC Address:', btcRes.data);

        // Generate ETH Address
        console.log('Generating ETH Address...');
        const ethRes = await request('POST', '/wallet/address', { userId, currency: 'ETH' });
        console.log('ETH Address:', ethRes.data);

        // 2. Connect to WebSocket
        console.log('\n📍 Step 2: Connecting to WebSocket...');
        const ws = new WebSocket(`${WS_URL}?userId=${userId}`);

        ws.on('open', () => {
            console.log('✅ WebSocket Connected!');
            
            // Optional: Send Auth message if required (based on events.gateway.ts)
            // const nonce = Date.now().toString();
            // const payload = `AUTH${nonce}`;
            // const signature = crypto.createHmac('sha384', SECRET_KEY).update(payload).digest('hex');
            // ws.send(JSON.stringify({
            //     event: 'auth',
            //     data: { apiKey: API_KEY, signature, nonce, payload }
            // }));
        });

        ws.on('message', (data) => {
            const msg = JSON.parse(data);
            console.log('\n📩 Received WebSocket Event:', JSON.stringify(msg, null, 2));
            
            if (msg.event === 'deposit_confirmed') {
                console.log('🎉 Deposit Confirmed! Test Successful.');
                process.exit(0);
            }
        });

        ws.on('error', (err) => {
            console.error('❌ WebSocket Error:', err.message);
        });

        console.log('\n⏳ Waiting for deposits...');
        console.log('👉 Please send testnet coins to the addresses above.');
        console.log('   (Or wait for the poller to pick up existing transactions)');

    } catch (err) {
        console.error('❌ Error:', err);
    }
}

main();
