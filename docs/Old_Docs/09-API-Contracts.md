# API Contracts - Request/Response

## Document Control
- Project: LPMS
- Artifact: API Contracts
- Version: 1.0
- Date: 2026-02-23

## 1. Conventions
1. Base path: `/api`
2. Auth: `Authorization: Bearer <accessToken>`
3. Error shape:
```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "Message",
    "details": {}
  }
}
```

## 2. Auth APIs
### 2.1 POST `/auth/login`
Request:
```json
{ "email": "admin@lpms.com", "password": "Pass@123" }
```
Response 200:
```json
{
  "accessToken": "jwt",
  "refreshToken": "opaque-or-jwt",
  "user": {
    "id": "uuid",
    "email": "admin@lpms.com",
    "role": "SUPER_ADMIN",
    "name": "Admin User",
    "mustChangePassword": false
  }
}
```

### 2.2 POST `/auth/refresh`
Request:
```json
{ "refreshToken": "token" }
```
Response 200:
```json
{ "accessToken": "jwt" }
```

### 2.3 POST `/auth/logout`
Request:
```json
{ "refreshToken": "token" }
```
Response 200:
```json
{ "success": true }
```

### 2.4 GET `/auth/me`
Response 200:
```json
{
  "id": "uuid",
  "email": "user@lpms.com",
  "role": "EMPLOYEE",
  "name": "User Name",
  "mustChangePassword": false
}
```

### 2.5 POST `/auth/change-password`
Request:
```json
{ "oldPassword": "Old@123", "newPassword": "New@12345" }
```
Response 200:
```json
{ "success": true, "message": "Password updated" }
```

## 3. Super Admin APIs
### 3.1 POST `/users`
Request:
```json
{ "name": "Learning Admin", "email": "la@lpms.com", "password": "Pass@123", "role": "LEARNING_ADMIN" }
```
Response 201:
```json
{ "id": "uuid", "name": "Learning Admin", "email": "la@lpms.com", "role": "LEARNING_ADMIN" }
```

### 3.2 GET `/users`
Response 200:
```json
[
  { "id": "uuid", "name": "Admin", "email": "admin@lpms.com", "role": "SUPER_ADMIN", "isActive": true }
]
```

### 3.3 DELETE `/users/:id`
Response 200:
```json
{ "success": true }
```

### 3.4 POST `/employees`
Request:
```json
{
  "employeeNumber": "011338",
  "name": "N. Perera",
  "email": "011338@company.com",
  "designation": "Engineer",
  "gradeName": "A.5.",
  "supervisorId": "uuid"
}
```
Response 201:
```json
{
  "principal": { "id": "uuid", "email": "011338@company.com", "role": "EMPLOYEE", "mustChangePassword": true },
  "employee": { "id": "uuid", "employeeNumber": "011338", "designation": "Engineer", "gradeName": "A.5." }
}
```

## 4. Learning Admin APIs
### 4.1 POST `/learning-paths`
Request:
```json
{
  "title": "Data Engineering Track",
  "description": "Core path",
  "category": "RESTRICTED",
  "totalDuration": "24h",
  "status": "ACTIVE"
}
```
Response 201: created learning path object.

### 4.2 GET `/learning-paths`
Response 200: array of learning paths.

### 4.3 GET `/learning-paths/:id`
Response 200: learning path with metadata and (if applicable) stage summary.

### 4.4 PUT `/learning-paths/:id`
Request: mutable path fields.
Response 200: updated learning path object.

### 4.5 DELETE `/learning-paths/:id`
Response 200:
```json
{ "success": true }
```
(soft delete)

### 4.6 POST `/enrollments`
Request:
```json
{
  "learningPathId": "uuid",
  "principalIds": ["uuid1", "uuid2"],
  "source": "LEARNING_ADMIN"
}
```
Response 200:
```json
{ "success": true, "assigned": 2, "skipped": 0, "details": [] }
```

## 5. Supervisor APIs
### 5.1 GET `/supervisor/team`
Response 200: list of subordinate employee principals.

### 5.2 GET `/supervisor/team/progress`
Response 200: progress summary by subordinate and path.

### 5.3 POST `/supervisor/approvals/:id/approve`
Response 200:
```json
{ "success": true, "approvalStatus": "APPROVED" }
```

### 5.4 POST `/supervisor/approvals/:id/reject`
Response 200:
```json
{ "success": true, "approvalStatus": "REJECTED" }
```

### 5.5 POST `/supervisor/enrollments`
Request:
```json
{ "learningPathId": "uuid", "principalIds": ["uuid"], "source": "SUPERVISOR" }
```
Response 200: assignment summary.

## 6. Employee APIs
### 6.1 GET `/employee/my-paths`
Response 200: enrolled learning paths for logged-in employee.

### 6.2 GET `/employee/my-progress`
Response 200: progress summaries.

### 6.3 GET `/employee/notifications`
Response 200: notification list.

### 6.4 POST `/employee/self-enroll`
Request:
```json
{ "learningPathId": "uuid" }
```
Response 200:
```json
{ "success": true, "enrollmentId": "uuid", "approvalStatus": "PENDING" }
```

### 6.5 POST `/employee/enrollments/:id/progress`
Request:
```json
{ "progress": 80 }
```
Response 200:
```json
{ "success": true, "status": "IN_PROGRESS", "progress": 80 }
```

## 7. Integration APIs
### 7.1 POST `/integrations/erp/subordinates`
Request:
```json
{ "employeeNo": "011338" }
```
Response 200:
```json
{ "success": true, "message": "Operation completed successfully", "data": [ { "employeeNumber": "008668" } ] }
```

### 7.2 POST `/integrations/erp/import-subordinates`
Request:
```json
{
  "employees": [
    { "employeeNumber": "008668", "employeeInitials": "M", "employeeSurname": "Giridaran", "designation": "Manager", "gradeName": "A.5.", "email": null }
  ]
}
```
Response 200:
```json
{
  "success": true,
  "imported": 1,
  "skipped": 0,
  "results": [
    { "employeeNumber": "008668", "status": "IMPORTED", "email": "008668@company.com", "mustChangePassword": true }
  ]
}
```

## 8. Reporting APIs
### 8.1 GET `/reports/summary`
Response 200:
```json
{
  "totalUsers": 10,
  "totalEmployees": 120,
  "totalPaths": 15,
  "enrollments": {
    "total": 600,
    "completed": 300,
    "inProgress": 220,
    "notStarted": 80
  }
}
```

## 9. Standard Status Codes
1. `200` success
2. `201` created
3. `400` validation error
4. `401` authentication failure
5. `403` authorization failure
6. `404` not found
7. `409` conflict (duplicate/constraint)
8. `500` internal server error
9. `502` upstream integration failure (ERP)
