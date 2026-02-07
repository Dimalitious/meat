/**
 * Production V3 API Tests
 * 
 * Run: npx ts-node testProductionV3.ts
 */

import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const TOKEN = process.env.TEST_TOKEN || 'YOUR_JWT_TOKEN_HERE';

const api = axios.create({
    baseURL: API_URL,
    headers: { Authorization: `Bearer ${TOKEN}` }
});

// Test data
let testRunId: number;
let testValueId: number;

async function testAddValueWithOpType() {
    console.log('\n=== Test: Add Value with opType ===');

    // First get an existing run
    const runsRes = await api.get('/api/production-v2/runs');
    const runs = runsRes.data;

    if (runs.length === 0) {
        console.log('⚠️ No runs found. Create a run first.');
        return false;
    }

    testRunId = runs[0].id;
    console.log(`Using run ID: ${testRunId}`);

    // Get run details to find a node
    const runDetails = await api.get(`/api/production-v2/runs/${testRunId}`);
    const nodes = runDetails.data.mml?.rootNodes || [];

    if (nodes.length === 0) {
        console.log('⚠️ No MML nodes found.');
        return false;
    }

    const nodeId = nodes[0].id;

    // Test 1: PRODUCTION entry (no reasonText required)
    try {
        const res1 = await api.post(`/api/production-v2/runs/${testRunId}/values`, {
            mmlNodeId: nodeId,
            value: 1.5,
            opType: 'PRODUCTION'
        });
        console.log('✅ PRODUCTION entry created:', res1.data.id);
        testValueId = res1.data.id;
    } catch (err: any) {
        console.log('❌ PRODUCTION entry failed:', err.response?.data?.error || err.message);
        return false;
    }

    // Test 2: WRITEOFF without reasonText (should fail)
    try {
        await api.post(`/api/production-v2/runs/${testRunId}/values`, {
            mmlNodeId: nodeId,
            value: 0.5,
            opType: 'WRITEOFF'
        });
        console.log('❌ WRITEOFF without reason should have failed!');
        return false;
    } catch (err: any) {
        console.log('✅ WRITEOFF correctly rejected without reasonText:', err.response?.data?.error);
    }

    // Test 3: WRITEOFF with reasonText (should pass)
    try {
        const res3 = await api.post(`/api/production-v2/runs/${testRunId}/values`, {
            mmlNodeId: nodeId,
            value: 0.3,
            opType: 'WRITEOFF',
            reasonText: 'Брак - бой товара'
        });
        console.log('✅ WRITEOFF with reason created:', res3.data.id);
    } catch (err: any) {
        console.log('❌ WRITEOFF with reason failed:', err.response?.data?.error || err.message);
        return false;
    }

    // Test 4: ADJUSTMENT with reasonText
    try {
        const res4 = await api.post(`/api/production-v2/runs/${testRunId}/values`, {
            mmlNodeId: nodeId,
            value: -0.2,
            opType: 'ADJUSTMENT',
            reasonText: 'Корректировка веса'
        });
        console.log('✅ ADJUSTMENT created:', res4.data.id);
    } catch (err: any) {
        console.log('❌ ADJUSTMENT failed:', err.response?.data?.error || err.message);
        return false;
    }

    return true;
}

async function testUpdateValue() {
    console.log('\n=== Test: Update Value ===');

    if (!testValueId) {
        console.log('⚠️ No test value ID. Run testAddValueWithOpType first.');
        return false;
    }

    try {
        const res = await api.patch(`/api/production-v2/runs/values/${testValueId}`, {
            value: 2.0
        });
        console.log('✅ Value updated:', res.data.value);
        return true;
    } catch (err: any) {
        console.log('❌ Update failed:', err.response?.data?.error || err.message);
        return false;
    }
}

async function testActualWeightCalculation() {
    console.log('\n=== Test: actualWeight Calculation ===');

    if (!testRunId) {
        console.log('⚠️ No test run ID.');
        return false;
    }

    const runDetails = await api.get(`/api/production-v2/runs/${testRunId}`);
    const values = runDetails.data.values || [];

    // Calculate expected actualWeight (only PRODUCTION entries)
    const productionSum = values
        .filter((v: any) => v.opType === 'PRODUCTION' || !v.opType)
        .reduce((sum: number, v: any) => sum + (v.value || 0), 0);

    console.log(`Expected actualWeight (PRODUCTION only): ${productionSum}`);
    console.log(`Actual actualWeight from run: ${runDetails.data.actualWeight}`);

    if (Math.abs(runDetails.data.actualWeight - productionSum) < 0.001) {
        console.log('✅ actualWeight calculation correct!');
        return true;
    } else {
        console.log('❌ actualWeight mismatch!');
        return false;
    }
}

async function testDeleteValue() {
    console.log('\n=== Test: Delete Value ===');

    if (!testValueId) {
        console.log('⚠️ No test value ID.');
        return false;
    }

    try {
        await api.delete(`/api/production-v2/runs/values/${testValueId}`);
        console.log('✅ Value deleted');
        return true;
    } catch (err: any) {
        console.log('❌ Delete failed:', err.response?.data?.error || err.message);
        return false;
    }
}

async function runAllTests() {
    console.log('🚀 Starting Production V3 API Tests...');
    console.log(`API URL: ${API_URL}`);
    console.log(`Token: ${TOKEN.substring(0, 20)}...`);

    const results = {
        addValueWithOpType: await testAddValueWithOpType(),
        updateValue: await testUpdateValue(),
        actualWeightCalculation: await testActualWeightCalculation(),
        deleteValue: await testDeleteValue()
    };

    console.log('\n=== Test Summary ===');
    let passed = 0;
    let failed = 0;

    for (const [test, result] of Object.entries(results)) {
        console.log(`${result ? '✅' : '❌'} ${test}`);
        if (result) passed++;
        else failed++;
    }

    console.log(`\nTotal: ${passed}/${passed + failed} tests passed`);
}

runAllTests().catch(console.error);
