# Process Flow Diagrams / Workflow Diagrams

## Document Control
- Project: LPMS
- Artifact: Process Flows and Workflows
- Version: 1.0
- Date: 2026-02-23

## 1. Login and Forced Password Change Flow
```mermaid
flowchart TD
  A[User opens Login Page] --> B[Submit email + password]
  B --> C{Credentials valid?}
  C -- No --> D[Show 401 error]
  C -- Yes --> E[Issue access + refresh tokens]
  E --> F[Fetch /auth/me profile]
  F --> G{mustChangePassword = true?}
  G -- Yes --> H[Redirect /change-password]
  H --> I[Submit old + new password]
  I --> J{Old password valid and new password policy valid?}
  J -- No --> K[Show validation/auth error]
  J -- Yes --> L[Update password hash + clear must_change_password]
  L --> M[Revoke prior refresh sessions]
  M --> N[Redirect role dashboard]
  G -- No --> N
```

## 2. ERP Lookup and Selective Import Flow
```mermaid
flowchart TD
  A[Learning Admin enters employeeNo] --> B[POST /integrations/erp/subordinates]
  B --> C[Backend calls ERP API with server-side credentials]
  C --> D{ERP success?}
  D -- No --> E[Return ERP_REQUEST_FAILED with details]
  D -- Yes --> F[Return subordinate list]
  F --> G[UI render table + row selection]
  G --> H[Import Selected]
  H --> I[POST /integrations/erp/import-employees]
  I --> J[For each selected row]
  J --> K{employeeNumber duplicate?}
  K -- Yes --> L[Skip with reason]
  K -- No --> M[Resolve email or fallback]
  M --> N{email duplicate?}
  N -- Yes --> L
  N -- No --> O[Create auth_principal EMPLOYEE]
  O --> P[Set must_change_password = true]
  P --> Q[Create employees record]
  Q --> R[Aggregate import summary]
  L --> R
  R --> S[Return imported + skipped counts/details]
```

## 3. Learning Path Lifecycle Flow
```mermaid
flowchart TD
  A[Learning Admin creates path] --> B[Validate fields/category]
  B --> C[Persist learning_path]
  C --> D[Optional path updates]
  D --> E[Status transitions: DRAFT/ACTIVE/ARCHIVED]
  E --> F[Soft delete if requested]
  F --> G[is_deleted = true]
```

## 4. Enrollment Governance Flow by Category
```mermaid
flowchart TD
  A[Enrollment request received] --> B[Read path category + status]
  B --> C{Path active?}
  C -- No --> X[Reject]
  C -- Yes --> D{Actor role}
  D -- Learning Admin --> E[Allow managed enrollment]
  D -- Supervisor --> F{Category = SEMI_RESTRICTED and employee under supervisor?}
  F -- No --> X
  F -- Yes --> E
  D -- Employee --> G{Category = PUBLIC?}
  G -- No --> X
  G -- Yes --> H[Allow self-enrollment]
  E --> I[Insert enrollment with source]
  H --> I
  I --> J[Create in-app notification]
  J --> K[Audit log action]
```

## 5. Supervisor Approval Workflow
```mermaid
flowchart TD
  A[Supervisor opens approvals] --> B[GET /supervisor/approvals]
  B --> C[List approvals scoped to supervised employees]
  C --> D[Supervisor clicks Approve/Reject]
  D --> E[POST /supervisor/approvals/:id/approve|reject]
  E --> F{Enrollment belongs to supervisor scope?}
  F -- No --> G[Return NOT_FOUND/FORBIDDEN]
  F -- Yes --> H[Update approval_status + timestamp + approver]
  H --> I[Audit log]
  I --> J[Refresh approvals list]
```

## 6. Employee Progress and Certificate Workflow
```mermaid
flowchart TD
  A[Employee updates progress] --> B[PUT /employee/my-paths/:id/progress]
  B --> C{Progress 0..100 valid?}
  C -- No --> D[Validation error]
  C -- Yes --> E[Update enrollment progress + status]
  E --> F{Progress == 100?}
  F -- No --> G[Return updated enrollment]
  F -- Yes --> H[Set completed_at]
  H --> I[Insert certificate if not exists]
  I --> J[Create completion notification]
  J --> K[Audit log]
  K --> G
```

## 7. Reporting Workflow
```mermaid
flowchart TD
  A[Learning Admin opens dashboard] --> B[GET /reports/summary]
  B --> C[Aggregate paths/enrollments/completions/certificates]
  C --> D[Calculate completion rate]
  D --> E[Return summary payload]
  E --> F[UI render KPI cards]
```

## 8. End-to-End Public Path Self-Enrollment Journey
```mermaid
sequenceDiagram
  actor Emp as Employee
  participant UI as Employee Dashboard
  participant API as LPMS API
  participant DB as PostgreSQL

  Emp->>UI: Click "Self Enroll" on public path
  UI->>API: POST /employee/self-enroll {learningPathId}
  API->>DB: Validate path category/status
  API->>DB: Insert enrollment(source=SELF) if not exists
  API->>DB: Insert notification
  API-->>UI: 201 + enrollment
  UI->>API: Refresh my paths + notifications
  API-->>UI: Updated data
```

## 9. Operational Notes
1. All diagrams assume bearer token and RBAC checks are applied at protected endpoints.
2. Error payloads follow standardized format:
   - `{ "error": { "code": "...", "message": "...", "details": ... } }`
3. ERP integration is server-side only to protect upstream credentials.
