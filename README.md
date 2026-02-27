## RMA Service & UI

This repository implements the **Customer Order-Aware Troubleshooting + RMA Authorization** system described in `RMA_Troubleshooting_RMA_DevSpec_SOW_v1.md`.

### Tech stack

- **Backend**: Node.js + TypeScript + Express
- **Database**: SQL Server (operational RMA schema) + existing DW (read-only)
- **Frontend**: React + TypeScript (customer modal UI + admin dashboard) - *Coming soon*

### Structure

- `backend/` – RMA service (API, business logic, integrations)
- `frontend/` – Customer modal UI and admin dashboard (React) - *To be implemented*
- `sql/` – SQL Server schema and migrations

### Implementation Status

**✅ Backend API (Complete)**
- All customer endpoints implemented with session auth
- All admin endpoints implemented
- Business logic: rules engine, playbook system, troubleshooting flow
- Integrations: HubSpot & EasyPost stubs (ready for real API integration)
- Storage: file upload/download with retention cleanup job
- Audit logging: comprehensive event tracking

**⚠️ Needs Integration**
- HubSpot API (stub ready, needs real calls)
- EasyPost API (stub ready, needs real calls)
- PDF generation (needs proper PDF library)
- DW adapter (placeholder views, needs real view names)

**❌ To Be Built**
- Customer modal UI (React)
- Admin dashboard (React)
- Automated tests
- Bitrix integration code

See `IMPLEMENTATION_STATUS.md` for detailed status.

### Getting started (backend)

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Configure environment** - Create `.env` file:
   ```env
   PORT=4000
   JWT_SECRET=your-secret-key
   SQL_SERVER=localhost
   SQL_DATABASE=RMA
   SQL_USER=sa
   SQL_PASSWORD=your-password
   STORAGE_ROOT_PATH=D:\rma_storage
   STORAGE_RETENTION_DAYS=365
   MAX_UPLOAD_SIZE_MB=50
   HUBSPOT_API_KEY=your-key
   EASYPOST_API_KEY=your-key
   ```

3. **Run database migration:**
   ```sql
   -- Execute sql/001_init_schema.sql on your SQL Server
   ```

4. **Start dev server:**
   ```bash
   npm run dev
   ```

5. **Test API:**
   ```bash
   # Health check
   curl http://localhost:4000/health

   # Start RMA session
   curl -X POST http://localhost:4000/api/rma/start \
     -H "Content-Type: application/json" \
     -d '{
       "brand": "UPFIX",
       "orderId": "ORD123",
       "orderItemId": "ITEM456",
       "sku": "SKU789",
       "customer": { "email": "test@example.com" }
     }'
   ```

### API Documentation

All endpoints are documented in the spec. Key endpoints:

**Customer (require session token):**
- `POST /api/rma/start` - Start RMA session
- `GET /api/rma/:rmaId` - Get RMA status
- `POST /api/rma/:rmaId/step/:stepId` - Complete troubleshooting step
- `POST /api/rma/:rmaId/accept-terms` - Accept terms
- `POST /api/rma/:rmaId/authorize` - Request authorization
- `POST /api/rma/:rmaId/label/purchase` - Purchase label
- `GET /api/rma/:rmaId/pdf` - Download RMA PDF

**Admin:**
- `GET /api/admin/rma/queue` - Get review queue
- `GET /api/admin/rma/:rmaId` - Get RMA detail
- `POST /api/admin/rma/:rmaId/override` - Override status

