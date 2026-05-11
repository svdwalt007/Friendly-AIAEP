# User Journey & Workflow Diagrams

## 1. Complete User Journey - From Login to Deployed App

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                            USER JOURNEY WORKFLOW                                    │
│                  From Zero to Deployed IoT Application                              │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│  PHASE 1: AUTHENTICATION & ONBOARDING                                               │
└─────────────────────────────────────────────────────────────────────────────────────┘

    👤 User                        🖥️  aep-builder UI                  🔐 Gateway

    │                                     │                                │
    │  1. Navigate to platform            │                                │
    ├──────────────────────────────────>  │                                │
    │  https://builder.friendly-tech.ai   │                                │
    │                                     │                                │
    │                              ┌──────┴──────┐                         │
    │                              │ Login Screen │                        │
    │                              │ ┌──────────┐│                         │
    │                              │ │ Email    ││                         │
    │                              │ │ Password ││                         │
    │                              │ │ [Login]  ││                         │
    │                              │ └──────────┘│                         │
    │                              └──────┬──────┘                         │
    │  2. Enter credentials               │                                │
    ├──────────────────────────────────>  │                                │
    │     email: user@company.com         │  POST /api/v1/auth/login       │
    │     password: •••••••               ├───────────────────────────────>│
    │                                     │                                │
    │                                     │                          ┌─────┴──────┐
    │                                     │                          │ Validate   │
    │                                     │                          │ - Check DB │
    │                                     │                          │ - Hash pwd │
    │                                     │                          │ - Gen JWT  │
    │                                     │                          └─────┬──────┘
    │                                     │  { token, refreshToken }       │
    │                                     │ <──────────────────────────────┤
    │                              ┌──────┴──────┐                         │
    │                              │ Store token │                         │
    │                              │ in session  │                         │
    │                              └──────┬──────┘                         │
    │                                     │                                │
    │  ✓ Logged in successfully           │                                │
    │ <───────────────────────────────────┤                                │
    │                                     │                                │


┌─────────────────────────────────────────────────────────────────────────────────────┐
│  PHASE 2: PROJECT SETUP & CONFIGURATION                                            │
└─────────────────────────────────────────────────────────────────────────────────────┘

    👤 User                        🖥️  Builder Dashboard              📊 Backend

    │                              ┌─────────────────────────────────┐
    │                              │   FRIENDLY-AIAEP DASHBOARD      │
    │                              │                                 │
    │                              │  [+ New Project]                │
    │                              │                                 │
    │                              │  Recent Projects:               │
    │                              │  □ Fleet Manager (Draft)        │
    │                              │  □ Energy Monitor (Published)   │
    │                              └─────────────────────────────────┘
    │                                     │
    │  3. Click "New Project"             │
    ├──────────────────────────────────>  │
    │                                     │
    │                              ┌──────┴──────────────────────────┐
    │                              │  Create New Project Dialog      │
    │                              │  ┌────────────────────────────┐ │
    │                              │  │ Project Name: *            │ │
    │                              │  │ Smart Meter Dashboard      │ │
    │                              │  │                            │ │
    │                              │  │ Description:               │ │
    │                              │  │ Real-time monitoring of    │ │
    │                              │  │ 10,000 smart meters        │ │
    │                              │  │                            │ │
    │                              │  │ IoT Platform:              │ │
    │                              │  │ [v] Friendly One-IoT       │ │
    │                              │  │                            │ │
    │                              │  │ [ Cancel ]  [ Create AI ]  │ │
    │                              │  └────────────────────────────┘ │
    │                              └──────┬──────────────────────────┘
    │  4. Fill form & click "Create AI"   │
    ├──────────────────────────────────>  │
    │                                     │  POST /api/v1/projects
    │                                     ├────────────────────────>
    │                                     │                         Create project
    │                                     │                         record in DB
    │                                     │  { projectId: 456 }
    │                                     │ <───────────────────────
    │                                     │
    │                              ┌──────┴──────────────────────────┐
    │                              │  AI Agent Chat Interface        │
    │                              │  ┌────────────────────────────┐ │
    │                              │  │ 🤖 Assistant:              │ │
    │                              │  │ Hi! I'm your AI builder.   │ │
    │                              │  │ I'll help you create your  │ │
    │                              │  │ smart meter dashboard.     │ │
    │                              │  │                            │ │
    │                              │  │ What features do you need? │ │
    │                              │  └────────────────────────────┘ │
    │                              │  ┌────────────────────────────┐ │
    │                              │  │ [Type your message...]     │ │
    │                              │  └────────────────────────────┘ │
    │                              └─────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────────────┐
│  PHASE 3: AI-POWERED BUILD PLANNING                                                 │
└─────────────────────────────────────────────────────────────────────────────────────┘

    👤 User                        🖥️  AI Chat Interface             🤖 Agent Runtime

    │                                     │                                │
    │  5. Describe requirements           │                                │
    ├──────────────────────────────────>  │                                │
    │  "I need a dashboard showing        │  WS /api/v1/agent/stream       │
    │   real-time power consumption       ├───────────────────────────────>│
    │   from 10,000 smart meters.         │  { message: "..." }            │
    │   Show alerts when power exceeds    │                                │
    │   threshold. Include daily/weekly   │                          ┌─────┴──────┐
    │   trends."                          │                          │ SUPERVISOR │
    │                                     │                          │   AGENT    │
    │                                     │                          │ Routes to: │
    │                                     │                          │ • Planning │
    │                                     │                          │ • IoT Dom. │
    │                                     │                          └─────┬──────┘
    │                              ┌──────┴──────────────────────┐        │
    │                              │ 🤖 Assistant:               │        │
    │                              │ 💭 Analyzing requirements...│        │ Claude API
    │                              └─────────────────────────────┘        │ (thinking)
    │                                     │ <──────────────────────────────┤
    │                                     │   stream: "agent_thinking"     │
    │                              ┌──────┴──────────────────────┐        │
    │                              │ 🤖 Assistant:               │        │
    │                              │ 🔧 Querying IoT devices...  │        │
    │                              └─────────────────────────────┘        │
    │                                     │                          ┌─────┴──────┐
    │                                     │                          │ IOT DOMAIN │
    │                                     │                          │   AGENT    │
    │                                     │                          │ Calls:     │
    │                                     │                          │ GetDevice  │
    │                                     │                          │ ListTool   │
    │                                     │                          └─────┬──────┘
    │                                     │                                │
    │                                     │                          Query IoT API
    │                                     │                          Found: 10,234
    │                                     │                          smart meters
    │                                     │                                │
    │                              ┌──────┴──────────────────────┐        │
    │                              │ 🤖 Assistant:               │        │
    │                              │ ✓ Found 10,234 smart meters │        │
    │                              │ ✓ Metrics: power, voltage,  │        │
    │                              │   current, frequency        │        │
    │                              └─────────────────────────────┘        │
    │                                     │ <──────────────────────────────┤
    │                                     │   stream: "tool_result"        │
    │                                     │                                │
    │                                     │                          ┌─────┴──────┐
    │                                     │                          │  PLANNING  │
    │                                     │                          │   AGENT    │
    │                                     │                          │ Generate   │
    │                                     │                          │ build plan │
    │                                     │                          └─────┬──────┘
    │                                     │                                │
    │                                     │                          Claude API
    │                                     │                          (planning)
    │                                     │                                │
    │                              ┌──────┴──────────────────────────────┐│
    │                              │ 🤖 Build Plan Generated:            ││
    │                              │                                     ││
    │                              │ Tasks:                              ││
    │                              │ ✓ 1. Create dashboard page          ││
    │                              │ ✓ 2. Add real-time power chart      ││
    │                              │ ✓ 3. Add alert widget (threshold)   ││
    │                              │ ✓ 4. Add trend analysis charts      ││
    │                              │ ✓ 5. Connect to InfluxDB            ││
    │                              │ ✓ 6. Setup alert notifications      ││
    │                              │                                     ││
    │                              │ Dependencies:                       ││
    │                              │ 1 → 2 → 5 (page → chart → data)    ││
    │                              │ 1 → 3 → 6 (page → alert → notify)  ││
    │                              │ 1 → 4 → 5 (page → trends → data)   ││
    │                              │                                     ││
    │                              │ [Review Plan] [Execute Build]       ││
    │                              └─────────────────────────────────────┘│
    │                                     │ <──────────────────────────────┤
    │                                     │   stream: "build_plan"         │
    │                                     │                                │


┌─────────────────────────────────────────────────────────────────────────────────────┐
│  PHASE 4: VISUAL COMPOSITION & CODE GENERATION                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘

    👤 User                        🖥️  Page Composer                 ⚙️  Backend

    │                                     │                                │
    │  6. Click "Execute Build"           │                                │
    ├──────────────────────────────────>  │                                │
    │                                     │  POST /api/v1/projects/456/    │
    │                                     │       execute                  │
    │                                     ├───────────────────────────────>│
    │                                     │                                │
    │                              ┌──────┴──────────────────────────────┐│
    │                              │  Executing tasks... (1/6)           ││
    │                              │  ▓▓▓░░░░░░░░░░░░░░░░░░  15%        ││
    │                              │  Creating dashboard page...         ││
    │                              └─────────────────────────────────────┘│
    │                                     │                          Create Page
    │                                     │                          record in DB
    │                              ┌──────┴──────────────────────────────┐│
    │                              │  Executing tasks... (2/6)           ││
    │                              │  ▓▓▓▓▓▓░░░░░░░░░░░░░░  30%          ││
    │                              │  Adding real-time power chart...    ││
    │                              └─────────────────────────────────────┘│
    │                                     │                          ┌─────┴──────┐
    │                                     │                          │  codegen   │
    │                                     │                          │ Generate:  │
    │                                     │                          │ • .ts code │
    │                                     │                          │ • .html    │
    │                                     │                          │ • .scss    │
    │                                     │                          └─────┬──────┘
    │                                     │                                │
    │                              ┌──────┴──────────────────────────────┐│
    │                              │  ✓ Build complete!                  ││
    │                              │                                     ││
    │                              │  Generated:                         ││
    │                              │  • 1 Page (Meter Dashboard)         ││
    │                              │  • 3 Widgets (Chart, Alert, Trend)  ││
    │                              │  • 15 TypeScript files              ││
    │                              │  • 8 Angular components             ││
    │                              │                                     ││
    │                              │  [Preview] [Edit Manually]          ││
    │                              └─────────────────────────────────────┘│
    │                                     │ <──────────────────────────────┤
    │                                     │                                │
    │  7. Click "Preview"                 │                                │
    ├──────────────────────────────────>  │                                │
    │                                     │  POST /api/v1/projects/456/    │
    │                                     │       preview                  │
    │                                     ├───────────────────────────────>│
    │                                     │                          ┌─────┴──────┐
    │                                     │                          │  preview-  │
    │                                     │                          │  runtime   │
    │                                     │                          │ • Compile  │
    │                                     │                          │ • Docker   │
    │                                     │                          │ • Serve    │
    │                                     │                          └─────┬──────┘
    │                              ┌──────┴──────────────────────────────┐│
    │                              │  Preview ready!                     ││
    │                              │  http://localhost:46001              ││
    │                              │                                     ││
    │                              │  [Open Preview] [Edit] [Publish]    ││
    │                              └─────────────────────────────────────┘│
    │                                     │ <──────────────────────────────┤
    │                                     │   { previewUrl: "..." }        │
    │                                     │                                │


┌─────────────────────────────────────────────────────────────────────────────────────┐
│  PHASE 5: PREVIEW & REFINEMENT                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘

    👤 User                        🖥️  Preview Window                 📊 Live Data

    │                                     │                                │
    │  8. Click "Open Preview"            │                                │
    ├──────────────────────────────────>  │                                │
    │                                     │                                │
    │  New browser window opens:          │                                │
    │  http://localhost:46001              │                                │
    │                                     │                                │
    │                              ┌──────┴──────────────────────────────────────────┐
    │                              │  ════════════════════════════════════════════   │
    │                              │  SMART METER DASHBOARD                          │
    │                              │  ════════════════════════════════════════════   │
    │                              │                                                 │
    │                              │  Fleet Status: 10,234 meters online ●           │
    │                              │  Last updated: 2 seconds ago                    │
    │                              │                                                 │
    │                              │  ┌─────────────────────────────────────────┐   │
    │                              │  │ REAL-TIME POWER CONSUMPTION             │   │
    │                              │  │ ┌───────────────────────────────────┐   │   │
    │                              │  │ │     ╱╲      ╱╲                    │   │   │
    │                              │  │ │    ╱  ╲    ╱  ╲    ╱╲             │   │   │
    │                              │  │ │   ╱    ╲  ╱    ╲  ╱  ╲            │   │   │
    │                              │  │ │  ╱      ╲╱      ╲╱    ╲           │   │   │
    │                              │  │ │ ─────────────────────────────     │   │   │
    │                              │  │ │ 00:00  06:00  12:00  18:00       │   │   │
    │                              │  │ │                                   │   │   │
    │                              │  │ │ Current: 145.2 MW   Peak: 178 MW │   │   │
    │                              │  │ └───────────────────────────────────┘   │   │
    │                              │  └─────────────────────────────────────────┘   │
    │                              │                                                 │
    │                              │  ┌─────────────────┐ ┌─────────────────────┐   │
    │                              │  │ ACTIVE ALERTS   │ │ DAILY TRENDS        │   │
    │                              │  │ ┌─────────────┐ │ │ ┌─────────────────┐ │   │
    │                              │  │ │ ⚠ High Load │ │ │ │ Mon  ████████░░ │ │   │
    │                              │  │ │   Sector 5  │ │ │ │ Tue  ██████░░░░ │ │   │
    │                              │  │ │   182 MW    │ │ │ │ Wed  ███████░░░ │ │   │
    │                              │  │ │   CRITICAL  │ │ │ │ Thu  ████████░░ │ │   │
    │                              │  │ │             │ │ │ │ Fri  █████████░ │ │   │
    │                              │  │ │ [Ack][View] │ │ │ │ Sat  ██████░░░░ │ │   │
    │                              │  │ └─────────────┘ │ │ │ Sun  █████░░░░░ │ │   │
    │                              │  └─────────────────┘ │ └─────────────────┘ │   │
    │                              │                      └─────────────────────┘   │
    │                              │                                                 │
    │                              │  [Refresh] [Export PDF] [Settings]              │
    │                              └─────────────────────────────────────────────────┘
    │                                     │                                │
    │                                     │  Query InfluxDB every 5s       │
    │                                     │ <──────────────────────────────┤
    │                                     │  SELECT mean(power) FROM ...   │
    │                                     │                                │
    │  ✓ Looks good!                      │                                │
    │                                     │                                │
    │  9. Request changes (optional)      │                                │
    ├──────────────────────────────────>  │                                │
    │  "Add a filter for specific         │                                │
    │   meter groups"                     │                                │
    │                                     │                                │
    │                                     │  (AI agent makes changes)      │
    │                                     │  (Preview auto-refreshes)      │
    │                                     │                                │


┌─────────────────────────────────────────────────────────────────────────────────────┐
│  PHASE 6: PUBLISH & DEPLOY                                                          │
└─────────────────────────────────────────────────────────────────────────────────────┘

    👤 User                        🖥️  Builder UI                     ☁️  Deployment

    │                                     │                                │
    │  10. Click "Publish"                │                                │
    ├──────────────────────────────────>  │                                │
    │                                     │                                │
    │                              ┌──────┴──────────────────────────────┐│
    │                              │  Publish Configuration              ││
    │                              │  ┌────────────────────────────────┐ ││
    │                              │  │ Version: v1.0.0                │ ││
    │                              │  │ Environment: Production        │ ││
    │                              │  │                                │ ││
    │                              │  │ Deploy to:                     │ ││
    │                              │  │ [✓] Kubernetes Cluster         │ ││
    │                              │  │ [ ] Docker Swarm               │ ││
    │                              │  │                                │ ││
    │                              │  │ Git Repository:                │ ││
    │                              │  │ github.com/tenant/meter-dash   │ ││
    │                              │  │                                │ ││
    │                              │  │ [Cancel] [Publish & Deploy]    │ ││
    │                              │  └────────────────────────────────┘ ││
    │                              └─────────────────────────────────────┘│
    │                                     │                                │
    │  11. Confirm publish                │                                │
    ├──────────────────────────────────>  │                                │
    │                                     │  POST /api/v1/projects/456/    │
    │                                     │       publish                  │
    │                                     ├───────────────────────────────>│
    │                                     │                          ┌─────┴──────┐
    │                                     │                          │ publish-   │
    │                                     │                          │ service    │
    │                                     │                          └─────┬──────┘
    │                              ┌──────┴──────────────────────────────┐│
    │                              │  Publishing... (1/5)                ││
    │                              │  ▓▓▓░░░░░░░░░░░░░░░░░░  20%        ││
    │                              │  Committing to GitHub...            ││
    │                              └─────────────────────────────────────┘│
    │                                     │                          git commit
    │                                     │                          git push
    │                              ┌──────┴──────────────────────────────┐│
    │                              │  Publishing... (2/5)                ││
    │                              │  ▓▓▓▓▓▓░░░░░░░░░░░░░░  40%          ││
    │                              │  Generating Docker image...         ││
    │                              └─────────────────────────────────────┘│
    │                                     │                          ┌─────┴──────┐
    │                                     │                          │  docker-   │
    │                                     │                          │  generator │
    │                                     │                          │ Create     │
    │                                     │                          │ Dockerfile │
    │                                     │                          └─────┬──────┘
    │                              ┌──────┴──────────────────────────────┐│
    │                              │  Publishing... (3/5)                ││
    │                              │  ▓▓▓▓▓▓▓▓▓░░░░░░░░░░  60%           ││
    │                              │  Generating Helm charts...          ││
    │                              └─────────────────────────────────────┘│
    │                                     │                          ┌─────┴──────┐
    │                                     │                          │  helm-     │
    │                                     │                          │  generator │
    │                                     │                          │ Create K8s │
    │                                     │                          │ manifests  │
    │                                     │                          └─────┬──────┘
    │                              ┌──────┴──────────────────────────────┐│
    │                              │  Publishing... (4/5)                ││
    │                              │  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░  80%            ││
    │                              │  Uploading artifacts to MinIO...    ││
    │                              └─────────────────────────────────────┘│
    │                                     │                          Upload to
    │                                     │                          MinIO bucket
    │                              ┌──────┴──────────────────────────────┐│
    │                              │  Publishing... (5/5)                ││
    │                              │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  100%           ││
    │                              │  Deploying to Kubernetes...         ││
    │                              └─────────────────────────────────────┘│
    │                                     │                          Trigger
    │                                     │                          kubectl apply
    │                                     │                          Deploy pods
    │                              ┌──────┴──────────────────────────────┐│
    │                              │  ✓ Published successfully!          ││
    │                              │                                     ││
    │                              │  Production URL:                    ││
    │                              │  https://meter-dash.tenant.app      ││
    │                              │                                     ││
    │                              │  Deployment:                        ││
    │                              │  • 3 pods running                   ││
    │                              │  • Load balancer: active            ││
    │                              │  • Health checks: passing           ││
    │                              │                                     ││
    │                              │  [View App] [Monitor] [Rollback]    ││
    │                              └─────────────────────────────────────┘│
    │                                     │ <──────────────────────────────┤
    │                                     │                                │


┌─────────────────────────────────────────────────────────────────────────────────────┐
│  PHASE 7: MONITORING & ANALYTICS                                                    │
└─────────────────────────────────────────────────────────────────────────────────────┘

    👤 User                        📊 Grafana Dashboard              📈 Metrics

    │                                     │                                │
    │  12. Click "Monitor"                │                                │
    ├──────────────────────────────────>  │                                │
    │                                     │                                │
    │  Navigate to Grafana:               │                                │
    │  https://grafana.friendly-tech.ai   │                                │
    │                                     │                                │
    │                              ┌──────┴──────────────────────────────────────────┐
    │                              │  ═══════════════════════════════════════════    │
    │                              │  METER DASHBOARD - PRODUCTION MONITORING        │
    │                              │  ═══════════════════════════════════════════    │
    │                              │                                                 │
    │                              │  Time range: Last 24 hours ▼   [Auto-refresh: 5s]│
    │                              │                                                 │
    │                              │  ┌─────────────────────────────────────────┐   │
    │                              │  │ APPLICATION PERFORMANCE                 │   │
    │                              │  │ • Requests/sec: 1,247                   │   │
    │                              │  │ • Avg response time: 45ms               │   │
    │                              │  │ • Error rate: 0.01%                     │   │
    │                              │  │ • Active users: 234                     │   │
    │                              │  └─────────────────────────────────────────┘   │
    │                              │                                                 │
    │                              │  ┌─────────────────────────────────────────┐   │
    │                              │  │ IOT DEVICE METRICS                      │   │
    │                              │  │ • Devices online: 10,234 / 10,234       │   │
    │                              │  │ • Data points/min: 612,040              │   │
    │                              │  │ • Alert triggers: 3 (last hour)         │   │
    │                              │  └─────────────────────────────────────────┘   │
    │                              │                                                 │
    │                              │  ┌─────────────────────────────────────────┐   │
    │                              │  │ LLM USAGE & COSTS (This Project)        │   │
    │                              │  │ • Total tokens: 45,230                  │   │
    │                              │  │ • Cost today: $5.42                     │   │
    │                              │  │ • Avg tokens/request: 1,250             │   │
    │                              │  └─────────────────────────────────────────┘   │
    │                              │                                                 │
    │                              │  ┌─────────────────────────────────────────┐   │
    │                              │  │ SYSTEM RESOURCES                        │   │
    │                              │  │ CPU:    [▓▓▓▓▓░░░░░] 45%               │   │
    │                              │  │ Memory: [▓▓▓▓▓▓▓░░░] 62%               │   │
    │                              │  │ Disk:   [▓▓░░░░░░░░] 23%               │   │
    │                              │  └─────────────────────────────────────────┘   │
    │                              │                                                 │
    │                              └─────────────────────────────────────────────────┘
    │                                     │                                │
    │                                     │  Query PostgreSQL, InfluxDB    │
    │                                     │ <──────────────────────────────┤
    │                                     │  Prometheus metrics            │
    │                                     │                                │
    │  ✓ App is running smoothly!         │                                │
    │                                     │                                │


┌─────────────────────────────────────────────────────────────────────────────────────┐
│  PHASE 8: BILLING & USAGE TRACKING                                                  │
└─────────────────────────────────────────────────────────────────────────────────────┘

    👤 User                        💰 Billing Dashboard              💳 Stripe

    │                                     │                                │
    │  13. View usage & billing           │                                │
    ├──────────────────────────────────>  │                                │
    │                                     │  GET /api/v1/billing/usage     │
    │                                     ├───────────────────────────────>│
    │                              ┌──────┴──────────────────────────────┐│
    │                              │  BILLING & USAGE                    ││
    │                              │                                     ││
    │                              │  Current Plan: Professional         ││
    │                              │  $2,499/month                       ││
    │                              │                                     ││
    │                              │  This Month (Apr 2026):             ││
    │                              │  • LLM tokens: 2.4M / 10M (24%)     ││
    │                              │  • API calls: 145K / 500K (29%)     ││
    │                              │  • Projects: 12 / 50 (24%)          ││
    │                              │                                     ││
    │                              │  Cost Breakdown:                    ││
    │                              │  • Base subscription: $2,499        ││
    │                              │  • LLM usage: $287.50               ││
    │                              │  • Overage: $0                      ││
    │                              │  Total: $2,786.50                   ││
    │                              │                                     ││
    │                              │  Next billing: May 1, 2026          ││
    │                              │                                     ││
    │                              │  [View Invoice] [Upgrade Plan]      ││
    │                              └─────────────────────────────────────┘│
    │                                     │ <──────────────────────────────┤
    │                                     │                                │


SUCCESS! 🎉

User has successfully:
✓ Created an IoT application using AI agents
✓ Deployed to production Kubernetes
✓ Monitored in real-time with Grafana
✓ Tracked usage and billing

Total time: ~15 minutes (from concept to production)
Traditional development: ~2-3 weeks
```

---

## 2. AI Agent Decision Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                       AI AGENT ORCHESTRATION FLOW                                   │
│                         LangGraph State Machine                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘

USER MESSAGE: "Build a dashboard for 10,000 smart meters"
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  ENTRY POINT: agent-runtime/createAgentGraph()                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
     │
     │ Initialize StateGraph
     │ state = { messages: [], next: "supervisor" }
     ▼
╔═════════════════════════════════════════════════════════════════════════════════════╗
║                          SUPERVISOR AGENT (Orchestrator)                            ║
║  Role: Route requests to specialized agents                                         ║
╚═════════════════════════════════════════════════════════════════════════════════════╝
     │
     │ LLM: Claude Opus 4.6
     │ System Prompt: "You are the supervisor. Analyze the user request and route
     │                 to appropriate specialist agents."
     │
     │ Input: "Build a dashboard for 10,000 smart meters"
     │
     │ 🤖 Thinking...
     │ • Detected keywords: "dashboard", "smart meters"
     │ • Domain: IoT + Builder
     │ • Required agents: Planning, IoT Domain
     │
     ├─────────────────────────┬─────────────────────────┐
     │                         │                         │
     ▼                         ▼                         ▼
┌──────────────┐      ┌──────────────┐       ┌──────────────────┐
│   PLANNING   │      │  IOT DOMAIN  │       │  (Other agents   │
│    AGENT     │      │    AGENT     │       │   available but  │
│              │      │              │       │   not needed)    │
│  Role:       │      │  Role:       │       │                  │
│  Generate    │      │  Query IoT   │       │  • Page Composer │
│  build plan  │      │  devices     │       │  • Widget Builder│
│  with tasks  │      │  Get metrics │       │  • CodeGen       │
│              │      │  Provide     │       │  • Docker Gen    │
│              │      │  insights    │       │  • Helm Gen      │
└──────┬───────┘      └──────┬───────┘       └──────────────────┘
       │                     │
       │ Wait for IoT data   │
       │ ◄───────────────────┤
       │                     │
       │              ┌──────▼────────────────────────────────────┐
       │              │  IoT Domain Agent Execution               │
       │              │                                           │
       │              │  1. Tool Selection:                       │
       │              │     Available tools from iot-tool-funcs:  │
       │              │     • GetDeviceListTool                   │
       │              │     • GetDeviceDetailsTool                │
       │              │     • GetDeviceTelemetryTool              │
       │              │     • RegisterWebhookTool                 │
       │              │     • GetKPIMetricsTool                   │
       │              │                                           │
       │              │  2. LLM Decision:                         │
       │              │     "I need to call GetDeviceListTool     │
       │              │      to find smart meters"                │
       │              │                                           │
       │              │  3. Tool Call:                            │
       │              │     GetDeviceListTool.invoke({            │
       │              │       filters: { type: "smart_meter" },   │
       │              │       limit: 10000                        │
       │              │     })                                    │
       │              │                                           │
       │              │  4. Result:                               │
       │              │     {                                     │
       │              │       devices: [                          │
       │              │         { id: 1, type: "meter", ... },    │
       │              │         ... (10,234 total)                │
       │              │       ],                                  │
       │              │       total: 10234                        │
       │              │     }                                     │
       │              │                                           │
       │              │  5. Follow-up Tool Call:                  │
       │              │     GetKPIMetricsTool.invoke({            │
       │              │       metrics: ["power", "voltage"]       │
       │              │     })                                    │
       │              │                                           │
       │              │  6. Analysis:                             │
       │              │     "Found 10,234 smart meters.           │
       │              │      Key metrics: power, voltage.         │
       │              │      Recommend real-time charts."         │
       │              └───────────────────────────────────────────┘
       │                     │
       │  IoT insights ready │
       │ ◄───────────────────┘
       │
┌──────▼─────────────────────────────────────────────────────────────┐
│  Planning Agent Execution                                          │
│                                                                    │
│  Input from IoT Agent:                                             │
│  • 10,234 smart meters found                                       │
│  • Metrics: power, voltage, current                                │
│  • Real-time data available                                        │
│                                                                    │
│  LLM: Claude Opus 4.6                                              │
│  System Prompt: "Generate a structured build plan with tasks      │
│                  and dependencies. Output as JSON."                │
│                                                                    │
│  🤖 Generating plan...                                             │
│                                                                    │
│  Output:                                                           │
│  {                                                                 │
│    "project": {                                                    │
│      "name": "Smart Meter Dashboard",                              │
│      "description": "Real-time monitoring for 10,234 meters"       │
│    },                                                              │
│    "tasks": [                                                      │
│      {                                                             │
│        "id": "task-1",                                             │
│        "type": "page",                                             │
│        "action": "create_page",                                    │
│        "config": {                                                 │
│          "name": "Meter Dashboard",                                │
│          "layout": "grid"                                          │
│        },                                                          │
│        "dependencies": []                                          │
│      },                                                            │
│      {                                                             │
│        "id": "task-2",                                             │
│        "type": "widget",                                           │
│        "action": "add_widget",                                     │
│        "config": {                                                 │
│          "widget": "line-chart",                                   │
│          "title": "Real-time Power",                               │
│          "dataSource": {                                           │
│            "type": "influxdb",                                     │
│            "query": "SELECT mean(power) FROM telemetry"            │
│          },                                                        │
│          "refreshInterval": 5000                                   │
│        },                                                          │
│        "dependencies": ["task-1"]                                  │
│      },                                                            │
│      {                                                             │
│        "id": "task-3",                                             │
│        "type": "widget",                                           │
│        "action": "add_widget",                                     │
│        "config": {                                                 │
│          "widget": "alert-panel",                                  │
│          "title": "High Load Alerts",                              │
│          "threshold": { "power": 180 }                             │
│        },                                                          │
│        "dependencies": ["task-1"]                                  │
│      },                                                            │
│      {                                                             │
│        "id": "task-4",                                             │
│        "type": "datasource",                                       │
│        "action": "connect_datasource",                             │
│        "config": {                                                 │
│          "type": "influxdb",                                       │
│          "connection": "tenant-influx-default"                     │
│        },                                                          │
│        "dependencies": ["task-2"]                                  │
│      }                                                             │
│    ],                                                              │
│    "dependency_graph": {                                           │
│      "task-1": [],                                                 │
│      "task-2": ["task-1", "task-4"],                               │
│      "task-3": ["task-1"],                                         │
│      "task-4": []                                                  │
│    }                                                               │
│  }                                                                 │
└────────────────────────────────────────────────────────────────────┘
       │
       │ Return to Supervisor
       ▼
╔═════════════════════════════════════════════════════════════════════╗
║  SUPERVISOR AGENT (Final Step)                                      ║
║  • Collect results from all agents                                  ║
║  • Validate build plan completeness                                 ║
║  • Format response for user                                         ║
╚═════════════════════════════════════════════════════════════════════╝
       │
       │ state.next = END
       │ Save checkpoint to PostgreSQL
       │ Track LLM usage → billing-service
       │ Log action → audit-service
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STREAM TO CLIENT (WebSocket)                                       │
│                                                                     │
│  Events sent:                                                       │
│  1. { type: "agent_thinking", agent: "supervisor" }                 │
│  2. { type: "agent_switch", agent: "iot_domain" }                   │
│  3. { type: "agent_tool_call", tool: "GetDeviceListTool" }          │
│  4. { type: "tool_result", result: { devices: 10234 } }             │
│  5. { type: "agent_switch", agent: "planning" }                     │
│  6. { type: "build_plan", plan: { tasks: [...] } }                  │
│  7. { type: "completion", message: "Build plan ready!" }            │
└─────────────────────────────────────────────────────────────────────┘
       │
       ▼
     USER INTERFACE
     Displays build plan with:
     • Task list (4 tasks)
     • Dependency graph visualization
     • [Execute] button
```

---

## 3. Multi-Tenant Deployment Flow

```
DEPLOYMENT_MODE=multi-tenant

┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Tenant A       │     │   Tenant B       │     │   Tenant C       │
│   (Startup)      │     │   (Enterprise)   │     │   (Mid-size)     │
│                  │     │                  │     │                  │
│   Plan: Starter  │     │   Plan: Enter.   │     │   Plan: Pro      │
│   Rate: 100/min  │     │   Rate: 2000/min │     │   Rate: 500/min  │
└────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘
         │                        │                        │
         │  All traffic routes through shared gateway      │
         └────────────────────────┼────────────────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │   aep-api-gateway         │
                    │   (Shared)                │
                    │   • Extract tenantId      │
                    │   • Check tier limits     │
                    │   • Route to services     │
                    └─────────────┬─────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│ Tenant A Data   │      │ Tenant B Data   │      │ Tenant C Data   │
│ PostgreSQL      │      │ PostgreSQL      │      │ PostgreSQL      │
│ (Filtered by    │      │ (Filtered by    │      │ (Filtered by    │
│  tenantId)      │      │  tenantId)      │      │  tenantId)      │
└─────────────────┘      └─────────────────┘      └─────────────────┘

All tenants share:
• Same API gateway instance
• Same database (row-level isolation via tenantId)
• Same LLM provider pool
• Same monitoring (Grafana with tenant filters)

Each tenant gets:
• Isolated data (automatic WHERE tenantId = ?)
• Tier-specific rate limits
• Separate billing tracking
• Custom LLM configuration overrides
```
