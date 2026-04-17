# Hugging Face Deployment Redis Removal Bugfix Design

## Overview

This bugfix removes all Redis dependencies from the backend to enable deployment on Hugging Face Spaces, which does not support external Redis instances. The fix replaces Redis-based refresh token storage with PostgreSQL-based storage, removes or gracefully disables the BullMQ queue system, and updates the worker shutdown logic. The implementation ensures all existing authentication and document processing functionality continues to work while eliminating the Redis dependency.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when the application attempts to connect to Redis in an environment where Redis is unavailable (Hugging Face Spaces)
- **Property (P)**: The desired behavior - the application should start successfully and function normally without Redis
- **Preservation**: Existing authentication flows (register, login, refresh, logout) and document processing that must remain unchanged
- **RefreshToken**: JWT token used to obtain new access tokens, currently stored in Redis with 7-day expiration
- **BullMQ**: Redis-backed job queue library used for document processing tasks
- **AuthService**: The service in `backend/src/modules/auth/auth.service.ts` that handles user authentication and token management
- **documentProcessingQueue**: The BullMQ queue instance in `backend/src/lib/queue.ts` used for background document processing

## Bug Details

### Bug Condition

The bug manifests when the application is deployed to Hugging Face Spaces or any environment without Redis. The application attempts to establish Redis connections during initialization, causing startup failures. The `AuthService` requires Redis for refresh token storage, `BullMQ` requires Redis for job queuing, and the workers module attempts to close Redis connections during shutdown.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type DeploymentEnvironment
  OUTPUT: boolean
  
  RETURN input.environment == "HUGGING_FACE_SPACES"
         AND input.redisAvailable == false
         AND (applicationAttemptingRedisConnection() OR 
              authServiceInitializing() OR 
              queueSystemInitializing() OR
              workersModuleShuttingDown())
END FUNCTION
```

### Examples

- **Example 1**: Deploy to HF Spaces → Build fails because Dockerfile expects Redis connection → Expected: Build succeeds without Redis
- **Example 2**: Start application without REDIS_URL env var → env.ts validation fails → Expected: Application starts with Redis features disabled
- **Example 3**: User calls /auth/login → AuthService.storeRefreshToken() attempts redis.set() → Crashes → Expected: Token stored in PostgreSQL
- **Example 4**: User calls /auth/refresh → AuthService.refreshUserToken() attempts redis.get() → Crashes → Expected: Token retrieved from PostgreSQL
- **Example 5**: User calls /auth/logout → AuthService.logoutUser() attempts redis.del() → Crashes → Expected: Token deleted from PostgreSQL
- **Example 6**: Application receives SIGTERM → workers/index.ts attempts redis.quit() → Crashes → Expected: Graceful shutdown without Redis operations
- **Edge case**: Document upload triggers queue.add() → BullMQ attempts Redis connection → Crashes → Expected: Process synchronously or queue disabled gracefully

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- User registration must continue to hash passwords, create user records in PostgreSQL, and generate JWT tokens
- User login must continue to validate credentials against PostgreSQL and issue access/refresh tokens
- Token refresh must continue to validate old refresh tokens and issue new token pairs
- User logout must continue to invalidate refresh tokens
- Document processing must continue to work (either synchronously or via alternative queue)
- Graceful shutdown must continue to close database connections properly
- All other API endpoints must continue to function normally

**Scope:**
All authentication flows and document processing workflows that do NOT involve Redis should be completely unaffected by this fix. This includes:
- Password hashing and validation
- JWT token generation and signing
- Database operations (user creation, queries, updates)
- Document upload and storage
- API request handling and middleware

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **Hard Redis Dependency in Auth Service**: The `AuthService` directly imports and uses `redis` for refresh token storage (storeRefreshToken, refreshUserToken, logoutUser methods), causing crashes when Redis is unavailable.

2. **Hard Redis Dependency in Queue System**: The `documentProcessingQueue` in `backend/src/lib/queue.ts` requires a Redis connection for BullMQ, causing initialization failures.

3. **Hard Redis Dependency in Workers**: The `backend/src/workers/index.ts` imports redis and attempts to call `redis.quit()` during graceful shutdown, causing shutdown failures.

4. **Required Environment Variable**: The `backend/src/config/env.ts` schema marks `REDIS_URL` as required (no `.optional()`), preventing application startup without it.

5. **Package Dependencies**: The `package.json` includes `ioredis` and `bullmq` as dependencies, which are unnecessary without Redis.

## Correctness Properties

Property 1: Bug Condition - Application Starts Without Redis

_For any_ deployment environment where Redis is unavailable (isBugCondition returns true), the fixed application SHALL start successfully, initialize all services without Redis connections, and handle authentication requests using PostgreSQL-based token storage instead of Redis.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

Property 2: Preservation - Authentication Flow Behavior

_For any_ authentication operation (register, login, refresh, logout) where the bug condition does NOT hold (isBugCondition returns false), the fixed application SHALL produce the same authentication results as the original application, preserving token generation, validation, and user session management behavior.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.7**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File 1**: `backend/prisma/schema.prisma`

**Changes**:
1. **Add RefreshToken Model**: Create a new model to store refresh tokens in PostgreSQL
   - Fields: id (uuid), userId (foreign key), token (hashed), expiresAt (timestamp), createdAt (timestamp)
   - Relationship: belongs to User
   - Index: userId for fast lookups

**File 2**: `backend/src/modules/auth/auth.service.ts`

**Function**: `storeRefreshToken`, `refreshUserToken`, `logoutUser`

**Specific Changes**:
1. **Remove Redis Import**: Delete `import { redis } from "../../lib/redis";`

2. **Replace storeRefreshToken Method**: 
   - Remove `await redis.set(...)` call
   - Add Prisma query to insert refresh token into RefreshToken table
   - Store hashed token with 7-day expiration timestamp

3. **Replace refreshUserToken Method**:
   - Remove `await redis.get(...)` call
   - Add Prisma query to find refresh token by userId and token hash
   - Validate token exists and hasn't expired
   - Delete old token and create new one

4. **Replace logoutUser Method**:
   - Remove `await redis.del(...)` call
   - Add Prisma query to delete refresh token by userId

**File 3**: `backend/src/lib/queue.ts`

**Changes**:
1. **Remove Redis Dependency**: Delete `import { redis } from "./redis";`

2. **Conditional Queue Initialization**: 
   - Check if Redis is available via environment variable
   - If unavailable, export null or a mock queue object
   - Add comment explaining queue is disabled without Redis

3. **Alternative Approach**: Consider removing queue entirely and processing documents synchronously

**File 4**: `backend/src/workers/index.ts`

**Changes**:
1. **Remove Redis Import**: Delete `import { redis } from "../lib/redis";`

2. **Update Graceful Shutdown**:
   - Remove `await redis.quit()` call from gracefulShutdown function
   - Keep Prisma disconnect logic
   - Add comment explaining Redis shutdown removed

**File 5**: `backend/src/config/env.ts`

**Changes**:
1. **Make REDIS_URL Optional**: Change `REDIS_URL: z.string().url()` to `REDIS_URL: z.string().url().optional()`
   - This allows application to start without Redis configuration

**File 6**: `backend/src/lib/redis.ts`

**Changes**:
1. **Delete File**: This file is no longer needed after removing all Redis dependencies
   - Alternatively, wrap initialization in conditional check and export null if REDIS_URL not provided

**File 7**: `backend/package.json`

**Changes**:
1. **Remove Redis Dependencies**: Remove `ioredis` and `bullmq` from dependencies
   - This reduces bundle size and eliminates unnecessary packages

**File 8**: `backend/Dockerfile`

**Changes**:
1. **No Changes Required**: Dockerfile should work without Redis once code changes are complete
   - Verify no Redis-specific commands or environment expectations

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Attempt to start the application without Redis and observe failure points. Test each Redis-dependent operation (token storage, queue operations, shutdown) on UNFIXED code to understand exact failure modes.

**Test Cases**:
1. **Environment Validation Test**: Start app without REDIS_URL env var (will fail on unfixed code with env validation error)
2. **Auth Service Initialization Test**: Call /auth/register without Redis (will fail on unfixed code when storing refresh token)
3. **Token Refresh Test**: Call /auth/refresh without Redis (will fail on unfixed code when retrieving token)
4. **Logout Test**: Call /auth/logout without Redis (will fail on unfixed code when deleting token)
5. **Queue Initialization Test**: Import queue module without Redis (will fail on unfixed code during BullMQ initialization)
6. **Graceful Shutdown Test**: Send SIGTERM without Redis (will fail on unfixed code when calling redis.quit())

**Expected Counterexamples**:
- Application crashes on startup with "REDIS_URL is required" error
- AuthService methods throw connection errors when Redis operations are attempted
- Workers module crashes during shutdown attempting to close non-existent Redis connection
- Possible causes: hard-coded Redis imports, required env validation, synchronous Redis client initialization

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL environment WHERE isBugCondition(environment) DO
  result := startApplication(environment)
  ASSERT result.started == true
  ASSERT result.authServiceFunctional == true
  ASSERT result.canRegisterUser == true
  ASSERT result.canLoginUser == true
  ASSERT result.canRefreshToken == true
  ASSERT result.canLogoutUser == true
END FOR
```

**Test Cases**:
1. **Startup Without Redis**: Start application without REDIS_URL → Should succeed
2. **Register Without Redis**: Call /auth/register → Should create user and store refresh token in PostgreSQL
3. **Login Without Redis**: Call /auth/login → Should validate credentials and store refresh token in PostgreSQL
4. **Refresh Without Redis**: Call /auth/refresh → Should validate old token from PostgreSQL and issue new tokens
5. **Logout Without Redis**: Call /auth/logout → Should delete refresh token from PostgreSQL
6. **Shutdown Without Redis**: Send SIGTERM → Should gracefully close database connections

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL authOperation WHERE NOT isBugCondition(environment) DO
  ASSERT authOperation_original(input) == authOperation_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all authentication flows

**Test Plan**: Observe behavior on UNFIXED code first for authentication flows, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Registration Preservation**: Verify user registration produces same user records, password hashes, and JWT tokens
2. **Login Preservation**: Verify login validation and token generation produces same results
3. **Token Refresh Preservation**: Verify refresh token validation and new token generation produces same token structure
4. **Logout Preservation**: Verify logout invalidates tokens correctly
5. **Password Hashing Preservation**: Verify bcrypt hashing continues to use same salt rounds
6. **JWT Structure Preservation**: Verify access and refresh tokens have same payload structure and expiration times

### Unit Tests

- Test RefreshToken model CRUD operations in PostgreSQL
- Test AuthService methods with PostgreSQL-based token storage
- Test environment validation with and without REDIS_URL
- Test graceful shutdown without Redis operations
- Test queue module behavior when Redis is unavailable

### Property-Based Tests

- Generate random user credentials and verify registration/login flows work identically
- Generate random refresh tokens and verify validation logic works identically
- Generate random JWT payloads and verify token generation produces valid tokens
- Test that token expiration logic works correctly with PostgreSQL storage

### Integration Tests

- Test full authentication flow: register → login → refresh → logout
- Test document upload flow with queue disabled or synchronous processing
- Test application startup and shutdown cycles without Redis
- Test concurrent authentication requests with PostgreSQL token storage
- Test token cleanup for expired tokens in PostgreSQL
