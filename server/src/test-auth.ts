import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = 'http://localhost:3000/api/auth';

async function testAuth() {
    try {
        console.log('1. Testing Registration...');
        const username = `user_${Date.now()}`;
        const password = 'password123';

        try {
            const regRes = await axios.post(`${API_URL}/register`, {
                username,
                password,
                name: 'Test User',
                role: 'ADMIN'
            });
            console.log('✅ Registration successful:', regRes.data);
        } catch (e: any) {
            if (e.response && e.response.status === 400 && e.response.data.error === "Username already exists") {
                console.log('⚠️ User already exists, proceeding to login...');
            } else {
                throw e;
            }
        }

        console.log('2. Testing Login...');
        const loginRes = await axios.post(`${API_URL}/login`, {
            username,
            password
        });
        console.log('✅ Login successful. Token:', loginRes.data.token ? 'Received' : 'Missing');

        if (loginRes.data.token) {
            console.log('✅ Auth Flow Verified!');
        } else {
            console.error('❌ Token missing in login response');
        }

    } catch (error: any) {
        console.error('❌ Test failed:', error.response ? error.response.data : error.message);
        process.exit(1);
    }
}

// We can't easily run this with ts-node if server isn't running.
// For now, I'll rely on the user running the server or I'll try to start it in background.
// Actually, I should probably just check if server compiles `npm run build` first.
