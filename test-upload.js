const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testUpload() {
  const API_URL = 'http://localhost:4000/api';
  
  // Step 1: Login
  console.log('1. Logging in...');
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'password123'
    })
  });
  
  if (!loginRes.ok) {
    console.error('Login failed:', await loginRes.text());
    return;
  }
  
  const { accessToken } = await loginRes.json();
  console.log('✓ Logged in successfully');
  
  // Step 2: Get or create workspace
  console.log('\n2. Getting workspace...');
  const workspacesRes = await fetch(`${API_URL}/workspaces`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  let workspaces = await workspacesRes.json();
  let workspaceId;
  
  if (workspaces.length === 0) {
    console.log('Creating new workspace...');
    const createRes = await fetch(`${API_URL}/workspaces`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Test Workspace',
        description: 'Testing document upload'
      })
    });
    const workspace = await createRes.json();
    workspaceId = workspace.id;
  } else {
    workspaceId = workspaces[0].id;
  }
  
  console.log(`✓ Using workspace: ${workspaceId}`);
  
  // Step 3: Upload text file
  console.log('\n3. Uploading text file...');
  const textForm = new FormData();
  textForm.append('file', fs.createReadStream('test-document.txt'));
  textForm.append('title', 'Test Document');
  textForm.append('sourceType', 'FILE');
  
  const textUploadRes = await fetch(`${API_URL}/workspaces/${workspaceId}/documents`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      ...textForm.getHeaders()
    },
    body: textForm
  });
  
  if (!textUploadRes.ok) {
    console.error('Text upload failed:', await textUploadRes.text());
  } else {
    const textDoc = await textUploadRes.json();
    console.log(`✓ Text file uploaded: ${textDoc.id}`);
    console.log(`  Status: ${textDoc.status}`);
    
    // Monitor processing
    await monitorDocument(API_URL, accessToken, workspaceId, textDoc.id, 'Text');
  }
  
  // Step 4: Upload PDF file
  console.log('\n4. Uploading PDF file...');
  const pdfForm = new FormData();
  pdfForm.append('file', fs.createReadStream('canary-behavioralhealth-technicalreport-2026-2.pdf'));
  pdfForm.append('title', 'Canary Technical Report');
  pdfForm.append('sourceType', 'FILE');
  
  const pdfUploadRes = await fetch(`${API_URL}/workspaces/${workspaceId}/documents`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      ...pdfForm.getHeaders()
    },
    body: pdfForm
  });
  
  if (!pdfUploadRes.ok) {
    console.error('PDF upload failed:', await pdfUploadRes.text());
  } else {
    const pdfDoc = await pdfUploadRes.json();
    console.log(`✓ PDF file uploaded: ${pdfDoc.id}`);
    console.log(`  Status: ${pdfDoc.status}`);
    
    // Monitor processing
    await monitorDocument(API_URL, accessToken, workspaceId, pdfDoc.id, 'PDF');
  }
}

async function monitorDocument(apiUrl, token, workspaceId, docId, type) {
  console.log(`\nMonitoring ${type} document processing...`);
  
  for (let i = 0; i < 30; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const res = await fetch(`${apiUrl}/workspaces/${workspaceId}/documents/${docId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!res.ok) {
      console.error('Failed to fetch document status');
      break;
    }
    
    const doc = await res.json();
    console.log(`  [${i * 2}s] Status: ${doc.status}`);
    
    if (doc.status === 'INDEXED') {
      console.log(`✓ ${type} document successfully processed!`);
      console.log(`  Chunks: ${doc.chunkCount || 0}`);
      break;
    } else if (doc.status === 'FAILED') {
      console.error(`✗ ${type} document processing failed`);
      console.error(`  Error: ${doc.error || 'Unknown error'}`);
      break;
    }
  }
}

testUpload().catch(console.error);
