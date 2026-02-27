# Customer Order-Aware Troubleshooting + RMA Authorization  
**Full Development Specification + Statement of Work (SOW) — v1.0**  
**Brands:** UpFix + MyAirbags  
**Website:** Bitrix (Order Status page → modal)  
**Operational DB:** SQL Server (new RMA tables)  
**Warranty Source of Truth:** SQL Server Data Warehouse (DW)  
**Integrations:** HubSpot (Tickets), EasyPost (Return Labels)  
**Storage:** Local filesystem on the same server as the RMA service (evidence + PDFs + labels)  
**Bench Test Fee:** **$39.99**  
**International:** Self-ship only (no labels provided)  
**USPS:** Only **Pay-on-Delivery Returns** (no prepaid USPS labels)

---

## 0) Background / Problem
Customers sometimes receive repaired parts and still experience issues. Today, troubleshooting and RMAs are handled manually, causing delays, inconsistent decisions, and repeat tickets.

This project builds a customer-facing, **order-aware** troubleshooting and RMA authorization workflow that:
- uses **warranty truth from SQL DW**,  
- uses **SKUGroup playbooks** to guide troubleshooting,  
- creates an **authorized RMA** with a **QR-coded packing slip**,  
- optionally issues return labels via **EasyPost** (UPS/FedEx + USPS Pay-on-Delivery),  
- and creates a clean **audit trail** plus an **internal review queue**.

---

## 1) Objectives (What Success Looks Like)
### Customer outcomes
- Customer selects an order and a specific order item (SKU).
- Customer is guided through troubleshooting steps with photos/videos.
- If unresolved, customer can generate an RMA and (if eligible) a return label.
- Customer prints an RMA document with QR code and includes it in the box.

### Business outcomes
- RMAs follow policy (warranty, terms, evidence requirements).
- Every decision is auditable.
- HubSpot ticket is the internal “spine” for tracking and team work.
- Ops/CX/TS can review exceptions daily and give feedback.

---

## 2) Scope

### In Scope (v1)
1. Bitrix Order Status page: **“Still having issues?”** button + modal launcher
2. RMA Service (new):
   - REST API + customer modal UI
   - ownership validation
   - warranty check from SQL DW
   - SKU → SKUGroup mapping
   - playbook-driven troubleshooting runner
   - evidence uploads (photo/video) to local storage
   - terms acceptance gate including bench fee ($39.99)
   - RMA authorization
   - EasyPost label options + purchase (UPS/FedEx + USPS Pay-on-Delivery Returns)
   - international: self-ship tracking capture
   - RMA PDF generation with QR code (local storage + secure download)
   - audit logging
3. HubSpot Ticket integration: create/update ticket throughout flow
4. Internal admin review dashboard + queue (minimum viable)
5. Storage retention cleanup job (365 days configurable)

### Out of Scope (v1)
- Automatic refunds/replacements (money outcomes remain manual or later)
- International label generation
- Deep/complete integration of tech scan tables (pre/post scans) — placeholders allowed for now
- Replacing Intercom / sales bot (Sales continues using Intercom)

---

## 3) Non-Negotiable Rules
### 3.1 AI vs deterministic rules
- **AI may guide troubleshooting** (ask next question, summarize, choose playbook branch).
- **AI may not**:
  - approve refunds
  - waive fees
  - override warranty windows
  - issue labels without policy gates
- **Rules engine** controls eligibility for authorization/labeling.

### 3.2 Warranty truth
- Warranty is **SQL DW source of truth**. No other system overrides it.

### 3.3 USPS policy
- No prepaid USPS return labels.
- Only offer USPS **Pay-on-Delivery Returns** (when enabled in EasyPost config).

### 3.4 Security
- Do **not** rely on URL `?access=` tokens.
- Use a short-lived **RMA session token** for modal UI API calls.

---

## 4) System Architecture

### 4.1 Components
**A) Bitrix (existing)**
- Adds CTA button on `/account/orders/{OrderID}/`
- Provides: `Brand`, `OrderID`, `OrderItemID`, `SKU`, and customer identity (ID/Email)
- Calls RMA service to start session and launches modal iframe

**B) RMA Service (new)**
- Hosts customer modal UI and REST API
- Own SQL Server operational tables
- Reads SQL DW for warranty + SKUGroup + ownership verification fields
- Integrates with HubSpot tickets
- Integrates with EasyPost for labels
- Stores evidence/PDF/labels on local disk and streams downloads via HTTPS

**C) SQL Data Warehouse (existing)**
- Read-only source for:
  - order items + customer ownership fields
  - warranty eligibility per order item
  - SKU → SKUGroup mapping

**D) HubSpot (existing)**
- Ticket is the internal system-of-record for the RMA case.
- Aircall is integrated into HubSpot (transcripts/sms can later be used, not required for v1).

**E) EasyPost (existing account)**
- Generates UPS/FedEx return labels + USPS Pay-on-Delivery Returns for domestic shipments.

---

## 5) Customer Experience Flow (End-to-End)

### Step 0 — Launch from Order Status page (Bitrix)
- Customer clicks **Still having issues?**
- Customer selects the exact **Order Item** (line item) for the problem.

### Step 1 — Start RMA Session
Bitrix calls: `POST /api/rma/start` (server-side preferred)

RMA service must:
1. Validate **ownership** (order item belongs to customer)
2. Query SQL DW for:
   - warranty status by `OrderItemID`
   - SKUGroup by `SKU`
3. Create RMA operational row + audit log
4. Create HubSpot ticket (and associate to contact + deal)
5. Return `{ rmaId, rmaSessionToken, warrantyEligible, skuGroupName, nextAction }`

### Step 2 — Troubleshooting Stepper (SKUGroup playbook)
- UI loads playbook for SKUGroup
- Customer completes steps; can upload evidence as requested
- Customer can:
  - mark “Fixed” and close
  - continue steps
  - opt out and request return

### Step 3 — Terms acceptance (hard gate)
Before authorization:
Customer must accept exact text:

> If the part arrives and tests good / no fault found, I agree to pay return shipping and a **$39.99 bench test fee** may be applied.

Capture:
- timestamp
- IP address
- user agent

### Step 4 — RMA Authorization decision
Rules engine returns one of:
- `AUTHORIZED`
- `NEEDS_REVIEW`
- `DENIED` (ownership/fraud only)

### Step 5 — Return shipping selection
- **International:** force own label (self-ship)
- **Domestic:** offer:
  - UPS (EasyPost)
  - FedEx (EasyPost)
  - USPS Pay-on-Delivery (EasyPost) — only if enabled
- Customer may always choose “I will ship myself” (own label)

### Step 6 — RMA packet + downloads
System generates:
- RMA PDF with QR code
- Label PDF (if issued)
- Confirmation page with downloads and packing instructions

---

## 6) RMA Status State Machine (v1)
Stored in `dbo.RMA_Request.Status`:

1. `DRAFT`
2. `STARTED` (ownership + DW checks done)
3. `TROUBLESHOOTING_IN_PROGRESS`
4. `TROUBLESHOOTING_COMPLETE`
5. `AWAITING_TERMS_ACCEPTANCE`
6. `AUTHORIZED`
7. `NEEDS_REVIEW`
8. `DENIED`
9. `LABEL_OPTIONS_PRESENTED`
10. `LABEL_ISSUED`
11. `AWAITING_CUSTOMER_SHIPMENT`
12. `TRACKING_RECORDED`
13. `CLOSED_FIXED`

---

## 7) Business Rules (Deterministic)

### 7.1 Ownership validation (hard stop)
If order item does not belong to customer:
- Set status `DENIED`
- Audit: `OWNERSHIP_VALIDATION_FAILED`
- Return safe UI message: “We can’t validate this order item.”

### 7.2 Warranty gate (DW truth)
- If `InWarranty = true`: proceed normally
- If `InWarranty = false`:
  - customer can still troubleshoot
  - RMA may be allowed as “paid evaluation” (configurable), default:
    - allow authorization
    - label issuance disabled (self-ship only)
  - mark reason codes: `OUT_OF_WARRANTY`

### 7.3 Terms acceptance (hard gate)
No terms accepted → no `AUTHORIZED`, no label.

### 7.4 Evidence requirements (playbook-driven)
If playbook requires evidence and it’s missing:
- move to `NEEDS_REVIEW` (not hard deny)

### 7.5 Abuse controls (configurable)
- Repeat RMA threshold per customer/email within 30 days → `NEEDS_REVIEW`
- “High abuse” SKUGroups + “opt out before minimum steps” → `NEEDS_REVIEW`

### 7.6 International rule (hard)
International customers must use own label.

### 7.7 USPS rule (hard)
- Do not offer prepaid USPS.
- Offer USPS only as **Pay-on-Delivery Returns** and only when enabled/configured.

---

## 8) Data Sources & Contracts (SQL DW)

### 8.1 Adapter layer requirement
Implement a DW adapter so view/table names can change without rewriting logic.

### 8.2 Placeholder DW views (to be replaced later)
1. `dw.vw_OrderItems`
   - Must include:
     - `OrderID`, `OrderItemID`, `SKU`
     - customer ownership fields: `CustomerEmail` and/or `CustomerId`
     - `ShipToCountry` (or equivalent)
2. `dw.vw_WarrantyStatus`
   - `OrderItemID`, `InWarranty`, `WarrantyEndDate`, `ReasonCode`
3. `dw.vw_SKU_Master`
   - `SKU`, `SKUGroupName`

---

## 9) Operational Data Model (SQL Server)

### 9.1 Required tables
#### `dbo.RMA_Request`
- `RMA_ID` UNIQUEIDENTIFIER PK
- `Brand` VARCHAR(20) NOT NULL  -- UPFIX | MYAIRBAGS
- `OrderID` VARCHAR(50) NOT NULL
- `OrderItemID` VARCHAR(50) NOT NULL
- `SKU` VARCHAR(50) NOT NULL
- `SKUGroupName` VARCHAR(100) NOT NULL
- `IsInternational` BIT NOT NULL
- `WarrantyEligible` BIT NOT NULL
- `WarrantyEndDate` DATETIME NULL
- `WarrantyReasonCode` VARCHAR(50) NULL
- `Status` VARCHAR(50) NOT NULL
- `CustomerSelectedReturnMethod` VARCHAR(20) NULL  -- EASYPOST_LABEL | OWN_LABEL
- `CarrierPreference` VARCHAR(30) NULL             -- UPS | FEDEX | USPS_POD | NONE
- `BenchTestFeeAmount` DECIMAL(10,2) NOT NULL DEFAULT 39.99
- `AcceptedBenchFeeTerms` BIT NOT NULL DEFAULT 0
- `AcceptedAt` DATETIME NULL
- `AcceptedIP` VARCHAR(45) NULL
- `AcceptedUserAgent` NVARCHAR(400) NULL
- `HubSpotDealId` VARCHAR(50) NULL
- `HubSpotTicketId` VARCHAR(50) NULL
- `HubSpotContactId` VARCHAR(50) NULL
- `CreatedAt` DATETIME NOT NULL
- `UpdatedAt` DATETIME NOT NULL

Indexes:
- `IX_RMA_OrderItemID`
- `IX_RMA_OrderID`
- `IX_RMA_Status_CreatedAt`

#### `dbo.RMA_Troubleshooting`
- `RMA_ID` UNIQUEIDENTIFIER PK/FK
- `SymptomsJson` NVARCHAR(MAX) NULL
- `StepsCompletedJson` NVARCHAR(MAX) NULL
- `EvidenceJson` NVARCHAR(MAX) NULL
- `CustomerOptedOutOfTS` BIT NOT NULL DEFAULT 0
- `AISummary` NVARCHAR(MAX) NULL
- `AIRecommendation` VARCHAR(20) NULL
- `AIConfidence` DECIMAL(4,3) NULL

#### `dbo.RMA_Label`
- `RMA_ID` UNIQUEIDENTIFIER PK/FK
- `EasyPostShipmentId` VARCHAR(100) NULL
- `EasyPostRateId` VARCHAR(100) NULL
- `Carrier` VARCHAR(30) NULL
- `Service` VARCHAR(50) NULL
- `TrackingNumber` VARCHAR(50) NULL
- `BillingMode` VARCHAR(30) NULL  -- PREPAID | USPS_PAY_ON_DELIVERY
- `LabelFilePath` NVARCHAR(500) NULL
- `LabelCreatedAt` DATETIME NULL

#### `dbo.RMA_AuditLog`
- `AuditId` BIGINT IDENTITY PK
- `RMA_ID` UNIQUEIDENTIFIER NOT NULL
- `EventType` VARCHAR(50) NOT NULL
- `ActorType` VARCHAR(20) NOT NULL  -- CUSTOMER | RULE_ENGINE | AI | AGENT | SYSTEM
- `PayloadJson` NVARCHAR(MAX) NULL
- `CreatedAt` DATETIME NOT NULL

#### `dbo.RMA_Playbook`
- `SKUGroupName` VARCHAR(100) PK
- `PlaybookJson` NVARCHAR(MAX) NOT NULL
- `Version` INT NOT NULL
- `IsActive` BIT NOT NULL
- `UpdatedAt` DATETIME NOT NULL

> Note: dev team may optionally create normalized evidence table (`dbo.RMA_Evidence`). If so, it must still support secure streaming and retention requirements.

---

## 10) File Storage (Local disk on same server)

### 10.1 Config
- `StorageRootPath` (e.g. `/srv/rma_storage` or `D:\rma_storage`)
- `StorageRetentionDays` default 365
- `MaxUploadSizeMB` default 50
- `AllowedExtensions` default `jpg,jpeg,png,webp,mp4,mov,pdf`

### 10.2 Directory layout (must follow)
```
{StorageRootPath}/rma/{Brand}/{OrderID}/{RMA_ID}/
  evidence/{yyyy}/{mm}/
  pdf/
  labels/
```

### 10.3 Naming (must follow)
- Evidence: `evidence_{timestampUtc}_{n}.{ext}`
- RMA PDF: `rma_{RMA_ID}.pdf`
- Label: `label_{carrier}_{tracking}.pdf`

### 10.4 Secure file streaming (required)
No direct file paths exposed to customers.

Endpoints must stream:
- `GET /api/rma/{rmaId}/pdf`
- `GET /api/rma/{rmaId}/label`
- `GET /api/rma/{rmaId}/evidence/{evidenceId}`

All require:
- valid session token
- ownership validation

### 10.5 Cleanup job (required)
Daily job:
- deletes files older than retention days
- logs `STORAGE_CLEANUP` audit event

---

## 11) API Specification

### 11.1 Auth
- Modal UI uses `Authorization: Bearer <rmaSessionToken>`
- Token TTL: 15 minutes
- Optional refresh: `POST /api/rma/{rmaId}/session/refresh`

### 11.2 Customer endpoints (required)
1. `POST /api/rma/start`
2. `GET /api/rma/{rmaId}`
3. `POST /api/rma/{rmaId}/symptoms`
4. `POST /api/rma/{rmaId}/step/{stepId}`
5. `POST /api/rma/{rmaId}/evidence` (multipart)
6. `POST /api/rma/{rmaId}/accept-terms`
7. `POST /api/rma/{rmaId}/authorize`
8. `POST /api/rma/{rmaId}/label/options`
9. `POST /api/rma/{rmaId}/label/purchase`
10. `POST /api/rma/{rmaId}/self-ship` (carrier + tracking)
11. `GET /api/rma/{rmaId}/pdf`
12. `GET /api/rma/{rmaId}/label`
13. `POST /api/rma/{rmaId}/close-fixed`

### 11.3 Admin endpoints (required)
1. `GET /api/admin/rma/queue?status=NEEDS_REVIEW&days=7`
2. `GET /api/admin/rma/{rmaId}`
3. `POST /api/admin/rma/{rmaId}/override`
4. `POST /api/admin/rma/{rmaId}/feedback`
5. `GET /api/admin/rma/{rmaId}/audit`
6. `POST /api/admin/playbook/upsert`
7. `GET /api/admin/playbook/{skuGroupName}`

Admin auth: internal-only (IP allowlist + credentials minimum).

---

## 12) HubSpot Ticket Integration (Required)

### 12.1 Ticket creation timing
Create a HubSpot ticket at `STARTED` so abandoned flows still create a case.

### 12.2 Ticket content
- Subject: `RMA - {OrderID} - {SKU}`
- Include properties:
  - `orderId`, `orderItemId`, `sku`, `skuGroup`, `rmaId`
  - `warrantyEligible`, `warrantyEndDate`
  - `termsAccepted`, `benchFeeAmount=39.99`
  - `returnMethod`, `carrier`, `trackingNumber`
  - `status`

### 12.3 Updates
Write notes/updates on:
- warranty checked
- troubleshooting completed or opted out
- terms accepted
- authorized / needs review
- label issued / tracking recorded
- customer marks fixed

---

## 13) EasyPost Integration (Required)
Domestic:
- UPS/FedEx labels
- USPS Pay-on-Delivery Returns (when enabled/configured)
- Rates displayed or chosen by rule (config)

International:
- no label generation
- capture tracking if customer provides

Implementation must:
- store EasyPost IDs + tracking
- download label PDF and store locally
- log label actions in audit log

---

## 14) Customer Modal UI (Required)

### 14.1 Integration pattern
Bitrix calls `/api/rma/start`, opens modal iframe:
`/ui?rmaSessionToken=...`

### 14.2 Required UI screens
1. Confirm item + warranty result
2. Troubleshooting stepper (playbook)
3. Terms acceptance screen (bench fee displayed)
4. Shipping selection (carrier options)
5. Confirmation with downloads + packing instructions
6. Resume flow if modal closes

---

## 15) Playbook Engine (Required)

### 15.1 Playbook JSON capability requirements
- step list
- branching
- required evidence
- media embeds
- pass/fail capture

### 15.2 Admin playbook management (MVP)
- Upsert playbook by SKUGroup
- Versioning and activate/deactivate

---

## 16) Audit Logging (Required)
Log every major event to `dbo.RMA_AuditLog`:

- `RMA_STARTED`
- `OWNERSHIP_VALIDATED`
- `WARRANTY_CHECKED`
- `PLAYBOOK_STEP_COMPLETED`
- `EVIDENCE_UPLOADED`
- `CUSTOMER_OPTED_OUT`
- `TERMS_ACCEPTED`
- `RULE_DECISION`
- `LABEL_OPTIONS_SHOWN`
- `LABEL_PURCHASED`
- `TRACKING_RECORDED`
- `HUBSPOT_TICKET_CREATED`
- `HUBSPOT_TICKET_UPDATED`
- `ADMIN_OVERRIDE`
- `STORAGE_CLEANUP`

---

## 17) Admin Review Dashboard (Required)
Minimum features:
- Queue list + filters:
  - `NEEDS_REVIEW`
  - international
  - out-of-warranty
  - opted-out early
  - repeat customer
- Detail view:
  - steps + evidence + terms acceptance + label/tracking
  - audit timeline
- Actions:
  - approve / deny / override
  - feedback “decision correct?” + notes

---

## 18) Reliability, Retries, Observability (Required)
- Correlation ID per request
- Retries with backoff for HubSpot/EasyPost transient failures
- User-safe errors (no stack traces)
- Basic rate limiting to prevent abuse

---

## 19) Testing Plan (Required)

### Unit tests
- rules engine
- playbook branching
- storage path validation (prevent traversal)
- ownership validation logic

### Integration tests
- SQL Server CRUD
- DW adapter reads
- EasyPost in sandbox/test
- HubSpot in test portal

### End-to-end scenarios
1. Domestic in-warranty → troubleshooting → UPS label + PDF
2. Domestic in-warranty → opt out immediately → NEEDS_REVIEW
3. Domestic in-warranty → USPS Pay-on-Delivery label
4. International in-warranty → self-ship + PDF
5. Out-of-warranty → troubleshooting allowed, label disabled (default), self-ship only
6. Ownership validation fails → DENIED

---

## 20) Acceptance Criteria (Definition of Done)
Project is accepted when all are true:

1. Bitrix modal launches and passes correct OrderItemID + SKU
2. Ownership validation prevents cross-customer RMAs
3. Warranty check uses SQL DW and is enforced
4. Playbook stepper works with media, branching, and uploads
5. Terms acceptance gate includes $39.99 and is logged
6. Domestic labels work (UPS/FedEx + USPS Pay-on-Delivery if enabled)
7. International is self-ship only
8. RMA PDF with QR is generated and downloadable
9. Files are stored locally and served via secure streaming endpoints
10. HubSpot tickets are created and updated correctly
11. Full audit trail exists per RMA
12. Admin queue works and supports overrides/feedback
13. Storage cleanup job runs successfully

---

# Statement of Work (SOW)

## A) Deliverables
1. Bitrix UI integration: CTA button + item selector + modal launcher
2. RMA service: API + customer UI
3. SQL Server schema: all required tables + indexes
4. DW adapter: warranty + SKUGroup + ownership fields
5. Playbook engine + admin upsert/versioning
6. Evidence upload pipeline (local storage) + secure downloads
7. Terms acceptance + authorization rules engine
8. EasyPost integration: UPS/FedEx + USPS Pay-on-Delivery; label storage + downloads
9. RMA PDF with QR generation + downloads
10. HubSpot ticket integration (create/update + associations)
11. Audit logging across full lifecycle
12. Admin review dashboard/queue + overrides + feedback
13. Retention cleanup job
14. Test plan + automated tests + UAT support
15. Deployment and runbook documentation

## B) Phases & Milestones

### Phase 1 — Foundation & Start Flow
- SQL Server operational schema
- `/api/rma/start` with ownership validation
- DW adapter for warranty + SKUGroup
- HubSpot ticket creation
- Modal UI loads and displays warranty + item info

**Exit:** Customer can start flow; system selects correct SKUGroup.

### Phase 2 — Troubleshooting Engine + Evidence + Audit
- Playbook runner (branching + media)
- Evidence uploads to local storage + secure streaming
- Audit logging for all customer actions
- HubSpot updated on key milestones

**Exit:** Customer can complete steps and upload evidence; audit trail complete.

### Phase 3 — Authorization + Labels + PDF
- Terms acceptance gate (bench fee $39.99)
- Rules engine
- EasyPost label options + purchase
- USPS Pay-on-Delivery option supported
- RMA PDF + QR generated and downloadable

**Exit:** Domestic label + PDF works; international self-ship works.

### Phase 4 — Admin Queue + Hardening + Cleanup
- Admin queue + detail view + overrides + feedback
- Retries, monitoring, rate limiting
- Storage retention cleanup job
- Full E2E tests pass in staging; production readiness checklist done

**Exit:** Ops can manage daily review; system resilient to failures.

## C) Responsibilities

### Client (UpFix/MyAirbags) provides
- Final DW view names + field mapping (placeholders OK to start)
- Return addresses (UpFix vs MyAirbags)
- HubSpot tokens + property setup approval
- EasyPost keys (staging/prod) and carrier configuration confirmation
- Initial top SKUGroup playbooks + media assets/links

### Developer/Integrator provides
- Implementation of all deliverables
- Security model + token/session system
- Local storage + streaming + retention cleanup
- Automated tests + QA
- Deployment + documentation + runbook
- UAT fixes and stabilization

---

## 21) Technology Options (Recommended, not mandatory)
These tools are *allowed* and *recommended* for speed, but not required if the deliverables and acceptance criteria are met.

### Admin dashboard implementation
- Option 1: Build custom admin UI in the RMA service (React)
- Option 2: Use Retool connected to SQL Server + RMA APIs

### AI implementation (if included in v1)
- Playbook-first is mandatory.
- AI can be added using LangChain/LlamaIndex/native tool-calling.
- AI cannot make policy decisions and must be audit-logged.

---

## 22) Appendix: Terms Acceptance Copy (Exact)
**Checkbox text (customer must accept):**  
> If the part arrives and tests good / no fault found, I agree to pay return shipping and a **$39.99 bench test fee** may be applied.
