#!/bin/bash

API_URL="http://localhost:4000/api"

# Login
echo "1. Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "Login failed: $LOGIN_RESPONSE"
  exit 1
fi

echo "✓ Logged in successfully"

# Get or create workspace
echo -e "\n2. Getting workspace..."
WORKSPACES=$(curl -s "$API_URL/workspaces" -H "Authorization: Bearer $TOKEN")
WORKSPACE_ID=$(echo $WORKSPACES | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$WORKSPACE_ID" ]; then
  echo "Creating workspace..."
  WORKSPACE=$(curl -s -X POST "$API_URL/workspaces" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":"Test Workspace","description":"Testing"}')
  WORKSPACE_ID=$(echo $WORKSPACE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
fi

echo "✓ Using workspace: $WORKSPACE_ID"

# Upload text file
echo -e "\n3. Uploading text file..."
TEXT_RESPONSE=$(curl -s -X POST "$API_URL/workspaces/$WORKSPACE_ID/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-document.txt" \
  -F "title=Test Document" \
  -F "sourceType=FILE")

echo "Response: $TEXT_RESPONSE"

TEXT_DOC_ID=$(echo $TEXT_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
TEXT_STATUS=$(echo $TEXT_RESPONSE | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$TEXT_DOC_ID" ]; then
  echo "✗ Text upload failed"
else
  echo "✓ Text file uploaded: $TEXT_DOC_ID"
  echo "  Initial status: $TEXT_STATUS"
  
  # Monitor for 30 seconds
  echo -e "\nMonitoring text document processing..."
  for i in {1..15}; do
    sleep 2
    DOC=$(curl -s "$API_URL/workspaces/$WORKSPACE_ID/documents/$TEXT_DOC_ID" \
      -H "Authorization: Bearer $TOKEN")
    STATUS=$(echo $DOC | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "  [${i}] Status: $STATUS"
    
    if [ "$STATUS" = "INDEXED" ]; then
      echo "✓ Text document successfully processed!"
      break
    elif [ "$STATUS" = "FAILED" ]; then
      echo "✗ Text document processing failed"
      echo "Full response: $DOC"
      break
    fi
  done
fi

# Upload PDF file
echo -e "\n4. Uploading PDF file..."
PDF_RESPONSE=$(curl -s -X POST "$API_URL/workspaces/$WORKSPACE_ID/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@canary-behavioralhealth-technicalreport-2026-2.pdf" \
  -F "title=Canary Technical Report" \
  -F "sourceType=FILE")

echo "Response: $PDF_RESPONSE"

PDF_DOC_ID=$(echo $PDF_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
PDF_STATUS=$(echo $PDF_RESPONSE | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$PDF_DOC_ID" ]; then
  echo "✗ PDF upload failed"
else
  echo "✓ PDF file uploaded: $PDF_DOC_ID"
  echo "  Initial status: $PDF_STATUS"
  
  # Monitor for 30 seconds
  echo -e "\nMonitoring PDF document processing..."
  for i in {1..15}; do
    sleep 2
    DOC=$(curl -s "$API_URL/workspaces/$WORKSPACE_ID/documents/$PDF_DOC_ID" \
      -H "Authorization: Bearer $TOKEN")
    STATUS=$(echo $DOC | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "  [${i}] Status: $STATUS"
    
    if [ "$STATUS" = "INDEXED" ]; then
      echo "✓ PDF document successfully processed!"
      break
    elif [ "$STATUS" = "FAILED" ]; then
      echo "✗ PDF document processing failed"
      echo "Full response: $DOC"
      break
    fi
  done
fi

echo -e "\n✓ Test complete!"
