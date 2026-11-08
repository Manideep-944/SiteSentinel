# SiteSentinel — Automated Website Uptime and Performance Monitoring System

> **College CSE Internal-Marks Project Submission**  
> **Course:** Full Stack Web Development / Distributed Systems Project  
> **Technology Stack:** MERN (MongoDB, Express.js, React 19 + Vite, Node.js) with `node-cron`, Recharts, and SSRF Security Protection.

---

## 1. Project Title and Abstract

**SiteSentinel** is a production-grade, full-stack website uptime and performance monitoring system engineered to provide reliable, automated observability for web applications and REST endpoints. Built upon the MERN stack, SiteSentinel periodically probes user-configured target URLs, records precise latency metrics, tracks HTTP response codes, detects service disruptions, and computes real-time uptime availability percentages based on persistent MongoDB telemetry.

The platform addresses a critical challenge in modern web infrastructure: identifying service degradation before users are impacted. Designed with defense-in-depth security principles, SiteSentinel incorporates an **SSRF (Server-Side Request Forgery) and DNS Rebinding Prevention Engine** that blocks unauthorized probing of internal networks, RFC 1918 subnets, and cloud metadata infrastructure.

---

## 2. Problem Statement

Modern organizations rely on dozens of interdependent web services, cloud APIs, and microservices. However:
1. **Silent Downtime:** Web services frequently crash, encounter DNS misconfigurations, or suffer latency spikes without alerting operators.
2. **Expensive Enterprise Tools:** Existing commercial monitoring solutions (e.g., Datadog, Pingdom, New Relic) are costly, complex, and vendor-locked.
3. **Security Vulnerabilities in DIY Monitors:** Inexperienced implementations of monitoring tools often inadvertently create SSRF vectors, allowing attackers to probe intranet assets (`localhost`, `127.0.0.1`, `169.254.169.254`) through the server.
4. **Lack of Transparent Telemetry:** Teams need clear uptime percentages derived from verified database checks rather than vague availability claims.

---

## 3. Objectives

- **Automated Observability:** Implement a background scheduler using `node-cron` to execute periodic HTTP/HTTPS health checks without manual intervention.
- **Accurate Telemetry:** Measure high-resolution network response times (in milliseconds) and record HTTP status codes.
- **Defensive Engineering:** Prevent Server-Side Request Forgery (SSRF) and DNS rebinding attacks by validating destination IPs and redirect chains.
- **Interactive Analytics:** Visualize response-time trends and fleet health distributions using Recharts.
- **Incident & Outage Detection:** Identify downtime spans from consecutive failed checks, reporting outage start time, duration, and root cause.
- **Data Export & Notifications:** Provide CSV export capabilities and configurable email notifications on state changes (UP ⇄ DOWN).

---

## 4. Existing System vs. Proposed System

| Feature / Aspect | Existing Traditional / Naive Systems | Proposed SiteSentinel System |
| :--- | :--- | :--- |
| **Monitoring Mechanism** | Manual checks or heavy third-party agents | Lightweight backend scheduler via `node-cron` |
| **Security / SSRF** | Vulnerable to internal IP probing & metadata leaks | Strict multi-layer IP/DNS rebinding & redirect guard |
| **Uptime Calculation** | Hardcoded or estimated assumptions | Formula-backed: $\frac{\text{Successful Checks}}{\text{Total Completed Checks}} \times 100$ |
| **Latency Tracking** | Coarse or unrecorded | High-resolution millisecond latency persisted per probe |
| **Data Ownership** | Vendor-locked proprietary clouds | Self-hosted MongoDB with isolated user ownership |
| **Exportability** | Restricted behind premium tiers | One-click CSV export of historical telemetry |

---

## 5. Technology Stack

### Frontend
- **Framework:** React.js 19 with Vite (fast HMR, optimized production bundler)
- **Routing:** React Router v7
- **Styling:** Custom CSS with responsive SaaS layout, CSS Variables, and Flexbox/Grid
- **Visualizations:** Recharts (Area charts for latency trends, Donut charts for status breakdown)
- **Icons:** Lucide React
- **HTTP Client:** Axios with JWT request interceptors

### Backend
- **Runtime:** Node.js (v20+)
- **Server Framework:** Express.js 4.x
- **Scheduling:** `node-cron` for scheduled background monitoring loops
- **Authentication:** JSON Web Tokens (JWT) & `bcryptjs` (salted password hashing)
- **Validation:** SSRF Validator using Node built-in `dns` and `net` modules
- **Alerting:** Nodemailer (SMTP integration for state transitions)

### Database
- **Database:** MongoDB (Local service or MongoDB Atlas cloud cluster)
- **ODM:** Mongoose 8.x with schema indexes and TTL/retention support

---

## 6. Architecture Explanation

SiteSentinel uses a decoupled client-server architecture with an independent background scheduling engine:

```mermaid
flowchart TD
    User([User / Browser]) <-->|HTTPS / REST API| Frontend[React + Vite Frontend]
    Frontend <-->|JWT Authenticated Calls| Backend[Node.js / Express Server]
    
    subgraph Backend_Process ["SiteSentinel Backend Engine"]
        Backend --> AuthModule[Auth Controller & JWT Guard]
        Backend --> SiteModule[Website Controller]
        Backend --> AnalyticsModule[Analytics & Telemetry Engine]
        Backend --> CronScheduler[node-cron Background Scheduler]
        
        CronScheduler --> MonitorEngine[Monitoring Service]
        SiteModule -->|Manual Check| MonitorEngine
        
        MonitorEngine --> SSRFGuard[SSRF & DNS Rebinding Validator]
        SSRFGuard -->|Resolved Public IP| TargetServer[Public Target Web Server]
        
        MonitorEngine --> EmailService[Nodemailer Alert Dispatcher]
    end

    Backend <-->|Mongoose ODM| MongoDb[(MongoDB Database)]
    EmailService -.->|SMTP| UserMailbox([User Alert Email])
```

### Operational Lifecycle:
1. **User Action:** The user logs in via JWT and registers target endpoints with custom check intervals (e.g., 1 min for demo, 5 min for production).
2. **Scheduled Worker:** The `node-cron` scheduler periodically queries MongoDB for all websites with `isMonitoringEnabled: true`.
3. **SSRF Guard:** Before every HTTP probe, the URL protocol is verified (`http:` or `https:`), hostname is resolved via DNS, and all resolved IPs are cross-checked against private, loopback, and cloud-metadata blocks.
4. **Execution & Metric Capture:** The server sends an HTTP GET request with bounded timeout (e.g., 10s) and size limits. High-resolution timestamps measure latency.
5. **Persistence & Alerts:** The result is saved to `MonitoringCheck`. If a state transition occurred (UP to DOWN or DOWN to UP), an alert email is dispatched.
6. **Telemetry Analytics:** The dashboard aggregates real-time data to render charts and calculate recorded-check uptime.

---

## 7. Database Schema

SiteSentinel models data using three normalized Mongoose schemas:

### User Schema (`User.js`)
```javascript
{
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  alertEmail: { type: String, trim: true, default: '' },
  emailAlertsEnabled: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
}
```

### Website Schema (`Website.js`)
```javascript
{
  ownerId: { type: ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true },
  url: { type: String, required: true, trim: true },
  isMonitoringEnabled: { type: Boolean, default: true, index: true },
  lastStatus: { type: String, enum: ['UP', 'DOWN', 'PENDING'], default: 'PENDING' },
  lastCheckedAt: { type: Date, default: null, index: true },
  lastResponseTimeMs: { type: Number, default: null },
  lastHttpStatusCode: { type: Number, default: null },
  lastErrorMessage: { type: String, default: null },
  checkIntervalMinutes: { type: Number, default: 5 },
  timeoutMs: { type: Number, default: 10000 },
  consecutiveFails: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}
```

### MonitoringCheck Schema (`MonitoringCheck.js`)
```javascript
{
  websiteId: { type: ObjectId, ref: 'Website', required: true, index: true },
  ownerId: { type: ObjectId, ref: 'User', required: true, index: true },
  checkedAt: { type: Date, default: Date.now, index: true },
  status: { type: String, enum: ['UP', 'DOWN'], required: true, index: true },
  responseTimeMs: { type: Number, required: true },
  httpStatusCode: { type: Number, default: null },
  errorMessage: { type: String, default: null },
  failureType: { 
    type: String, 
    enum: ['NONE', 'HTTP_ERROR', 'NETWORK_ERROR', 'TIMEOUT', 'DNS_ERROR', 'BLOCKED_SSRF', 'OTHER'],
    default: 'NONE' 
  },
  resolvedIp: { type: String, default: null }
}
```

---

## 8. REST API Documentation

All protected endpoints require the HTTP header: `Authorization: Bearer <token>`.

### Authentication Endpoints
- `POST /api/auth/register` — Register a new operator account.
- `POST /api/auth/login` — Authenticate and receive a JWT.
- `GET /api/auth/me` — Retrieve current authenticated user profile.
- `PUT /api/auth/profile` — Update notification preferences or password.

### Website Management Endpoints
- `GET /api/websites` — List all monitored endpoints with quick uptime stats.
- `POST /api/websites` — Add a new monitored target (runs SSRF check & immediate probe).
- `GET /api/websites/:id` — Retrieve endpoint configuration and aggregate telemetry.
- `PUT /api/websites/:id` — Update endpoint name, URL, timeout, or interval.
- `DELETE /api/websites/:id` — Delete website and cascade delete all associated check logs.
- `POST /api/websites/:id/check` — Manually trigger an on-demand health check.
- `PATCH /api/websites/:id/monitoring` — Toggle monitoring state (Pause / Resume).
- `GET /api/websites/:id/export-csv` — Download check history as a CSV file.

### Analytics Endpoints
- `GET /api/analytics/overview` — Dashboard summary metrics, response trends, status distribution, and recent incidents.
- `GET /api/websites/:id/history` — Paginated check logs with status and time-range filters (`24h`, `7d`, `30d`, `all`).
- `GET /api/websites/:id/analytics` — Detailed time-series latency data points and detected outage spans.

### System Health
- `GET /api/health` — Public diagnostic endpoint (MongoDB connection status, scheduler status, uptime).

---

## 9. Security & Monitoring Architecture

### Lightweight Probing Strategy
SiteSentinel uses an optimized HTTP probing strategy designed specifically for availability and performance monitoring:
1. **Lightweight HEAD Preference:** The monitoring engine dispatches a lightweight `HEAD` request first to retrieve HTTP status and response headers without downloading or buffering the webpage body.
2. **Streamed GET Fallback:** If a target web server does not support `HEAD` (e.g. returns `405 Method Not Allowed`, `501 Not Implemented`, or `400 Bad Request`), the engine falls back to a streamed `GET` request (`responseType: 'stream'`).
3. **Zero Body Buffering:** As soon as HTTP response headers are received, the incoming response stream is immediately destroyed/aborted. This avoids buffering large HTML payloads, images, or assets in memory, completely eliminating `maxContentLength exceeded` errors on massive web pages (e.g. Amazon, ecommerce portals).
4. **Transparent Diagnostics:** Probing captures high-resolution response duration (in milliseconds), HTTP status code, and detailed status descriptions.

### Monitoring Success Criteria Policy
- **UP (Operational):** HTTP status codes `200 - 399` (Successful and completed Redirection responses).
- **DOWN (Disrupted / Attention Required):**
  - **ACCESS_DENIED:** HTTP `401 Unauthorized` or `403 Forbidden` (Server is online, but access is restricted or WAF/bot filters challenge automated probers).
  - **RATE_LIMITED:** HTTP `429 Too Many Requests` (Server is online, but rate-limiting client probes).
  - **HTTP_ERROR:** HTTP `404 Not Found`, `500 Internal Server Error`, `502 Bad Gateway`, `503 Service Unavailable`, `504 Gateway Timeout`.
  - **NETWORK_ERROR:** Socket connection refused, connection reset, or host unreachable.
  - **TIMEOUT:** Destination server failed to respond within the configured timeout window (`timeoutMs`).
  - **DNS_ERROR:** Hostname could not be resolved.
  - **BLOCKED_SSRF:** Disallowed private, loopback, or metadata destination.

### SSRF & DNS Rebinding Protection
1. **Protocol Restriction:** Only `http:` and `https:` protocols are accepted. File, gopher, and FTP protocols are rejected.
2. **Credential Stripping:** URLs containing embedded credentials (`http://user:pass@host`) are blocked.
3. **Blacklisted Hostnames:** Direct rejections for `localhost`, `*.localhost`, `*.internal`, `*.lan`, `metadata.google.internal`, and `instance-data`.
4. **Pre-Flight DNS Resolution:** Hostnames are resolved using `dns.promises.lookup` to inspect all destination IP addresses before socket creation.
5. **IP Range Restrictions:**
   - Loopback: `127.0.0.0/8`, `::1`
   - Private subnets (RFC 1918): `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
   - Link-local & Cloud Metadata: `169.254.0.0/16` (including `169.254.169.254` AWS/GCP/Azure metadata)
   - Carrier Grade NAT: `100.64.0.0/10`
   - Multicast & Reserved: `224.0.0.0/4`, `240.0.0.0/4`, `255.255.255.255`
6. **Redirect Verification:** Automated uninspected HTTP redirects are disabled. Each redirect hop is resolved and re-validated against the SSRF engine.
7. **Resource Caps:** Request timeouts (e.g. 10s) prevent slowloris or denial-of-service hanging.

---

## 10. Installation and Setup Instructions

### Prerequisites
- **Node.js** (v18 or higher recommended; tested on Node.js v25)
- **MongoDB** (Local MongoDB community service or MongoDB Atlas connection string)
- **Git**

### Step 1: Clone the Repository
```bash
git clone https://github.com/your-username/SiteSentinel.git
cd SiteSentinel
```

### Step 2: Install Server & Client Dependencies
```bash
# Install Server Dependencies
cd server
npm install

# Install Client Dependencies
cd ../client
npm install
cd ..
```

---

## 11. Environment Configuration

### Server Configuration (`server/.env`)
Copy `server/.env.example` to `server/.env`:
```bash
cp server/.env.example server/.env
```

Default configuration for local development:
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/sitesentinel
JWT_SECRET=sitesentinel_jwt_secret_dev_key_change_in_production_2026
CLIENT_URL=http://localhost:5173
MONITOR_INTERVAL_MINUTES=5
REQUEST_TIMEOUT_MS=10000

# Optional SMTP Settings (leave empty if email alerts are not required)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM="SiteSentinel Alerts" <no-reply@sitesentinel.local>
SMTP_SECURE=false
```

> **Using MongoDB Atlas:**  
> Replace `MONGODB_URI` with your connection string:  
> `MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/sitesentinel?retryWrites=true&w=majority`

### Client Configuration (`client/.env`)
Copy `client/.env.example` to `client/.env`:
```env
VITE_API_URL=http://localhost:5000/api
```

---

## 12. How to Run the Application

### Option A: Run Demo Seeder (Recommended for Evaluation)
To populate demo data and initial test targets for faculty presentation:
```bash
cd server
npm run seed
```
*Creates evaluator account: `demo.evaluator@sitesentinel.edu` / `demo123456` with live telemetry.*

### Option B: Start Server & Client
In Terminal 1 (Backend):
```bash
cd server
npm start
# Server starts on http://localhost:5000
```

In Terminal 2 (Frontend):
```bash
cd client
npm run dev
# Frontend starts on http://localhost:5173
```

Open your browser at `http://localhost:5173`.

---

## 13. Testing and Verification

### Run Automated Backend Test Suite
An automated integration test suite is provided to verify all core functionalities:
```bash
cd server
node test-suite.js
```

**Verified Test Cases:**
1. User registration with JWT issuance.
2. User authentication and credential matching.
3. SSRF rejection of localhost (`http://localhost:5000`), loopback (`127.0.0.1`), metadata (`169.254.169.254`), and private subnets (`192.168.1.1`, `10.0.0.1`).
4. Addition of legitimate public endpoints.
5. Manual HTTP health check probe execution and latency measurement.
6. Real MongoDB aggregation for dashboard metrics.
7. CSV export generation.
8. Monitoring pause/resume toggle.

---

## 14. UI/UX Walkthrough

1. **Login & 1-Click Demo:** Clean split-card layout with a dedicated *"Quick 1-Click Evaluator Demo Login"* button for faculty review.
2. **Main Dashboard:** 5 telemetry stat cards, Recharts response-time area chart, status distribution donut chart, live activity log, and incident timeline.
3. **Monitored Websites:** Filterable grid with latency pills, status badges, manual *"Check Now"* triggers, and pause/resume switches.
4. **Website Analytics & History:** Detailed latency trend charts, outage duration summaries, paginated HTTP check logs, and CSV export.
5. **Settings & Telemetry:** Account preferences, email alert toggles, and real-time backend/database diagnostics.
6. **Custom 404 Page:** Branded error view with return navigation.

---

## 15. Limitations & Future Scope

### Limitations
- **Host Process Dependency:** Monitoring is active while the backend Node.js process is executing.
- **Single-Region Probing:** Probes originate from the host server rather than globally distributed edge nodes.

### Future Scope
- **Multi-Region Probes:** Distribute worker nodes across AWS/GCP regions to measure geo-latency.
- **SSL Certificate Expiry Alerts:** Warn operators when TLS certificates are nearing expiration.
- **Webhook Integrations:** Dispatch notifications to Slack, Discord, and Telegram webhooks.
