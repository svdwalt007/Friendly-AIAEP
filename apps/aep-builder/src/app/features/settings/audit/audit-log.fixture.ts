/**
 * Typed fixture: 20 realistic audit log entries for the Audit Log screen (B7).
 */
export type AuditAction =
  | 'login'
  | 'logout'
  | 'project.created'
  | 'project.deleted'
  | 'page.saved'
  | 'deploy.triggered'
  | 'deploy.completed'
  | 'deploy.failed'
  | 'settings.changed'
  | 'api_key.rotated'
  | 'user.invited'
  | 'user.removed';

export type AuditStatus = 'success' | 'failure' | 'pending';

export interface AuditEvent {
  id: string;
  timestamp: string; // ISO-8601
  user: string;
  action: AuditAction;
  resource: string;
  status: AuditStatus;
  detail?: string;
}

export const AUDIT_LOG_FIXTURE: AuditEvent[] = [
  {
    id: 'evt-001',
    timestamp: '2026-05-11T07:02:14Z',
    user: 'sean@friendly.io',
    action: 'login',
    resource: 'auth/session',
    status: 'success',
    detail: 'SSO login via Google Workspace',
  },
  {
    id: 'evt-002',
    timestamp: '2026-05-11T07:05:33Z',
    user: 'sean@friendly.io',
    action: 'project.created',
    resource: 'projects/proj-aiaep-001',
    status: 'success',
    detail: 'Project "Smart Metering Dashboard" created',
  },
  {
    id: 'evt-003',
    timestamp: '2026-05-11T07:12:55Z',
    user: 'sean@friendly.io',
    action: 'page.saved',
    resource: 'projects/proj-aiaep-001/pages/overview',
    status: 'success',
    detail: 'Layout saved — 4 widgets',
  },
  {
    id: 'evt-004',
    timestamp: '2026-05-11T07:30:01Z',
    user: 'priya@friendly.io',
    action: 'login',
    resource: 'auth/session',
    status: 'success',
  },
  {
    id: 'evt-005',
    timestamp: '2026-05-11T07:31:48Z',
    user: 'priya@friendly.io',
    action: 'deploy.triggered',
    resource: 'projects/proj-aiaep-001/builds/build-007',
    status: 'pending',
    detail: 'Triggered by merge to main',
  },
  {
    id: 'evt-006',
    timestamp: '2026-05-11T07:34:12Z',
    user: 'system',
    action: 'deploy.completed',
    resource: 'projects/proj-aiaep-001/builds/build-007',
    status: 'success',
    detail: 'Deployed to production — 3m 24s',
  },
  {
    id: 'evt-007',
    timestamp: '2026-05-11T08:00:00Z',
    user: 'sean@friendly.io',
    action: 'settings.changed',
    resource: 'settings/llm',
    status: 'success',
    detail: 'Provider changed from OpenAI to Anthropic; model set to claude-sonnet-4-5',
  },
  {
    id: 'evt-008',
    timestamp: '2026-05-11T08:15:22Z',
    user: 'marcos@friendly.io',
    action: 'login',
    resource: 'auth/session',
    status: 'failure',
    detail: 'Invalid credentials — account locked after 3 attempts',
  },
  {
    id: 'evt-009',
    timestamp: '2026-05-11T08:20:05Z',
    user: 'sean@friendly.io',
    action: 'user.invited',
    resource: 'users/marcos@friendly.io',
    status: 'success',
    detail: 'Invited as Editor',
  },
  {
    id: 'evt-010',
    timestamp: '2026-05-11T08:45:33Z',
    user: 'priya@friendly.io',
    action: 'project.created',
    resource: 'projects/proj-nb-tracker',
    status: 'success',
    detail: 'Project "NB-IoT Asset Tracker" created from template',
  },
  {
    id: 'evt-011',
    timestamp: '2026-05-11T09:03:17Z',
    user: 'priya@friendly.io',
    action: 'page.saved',
    resource: 'projects/proj-nb-tracker/pages/map-view',
    status: 'success',
    detail: 'Layout saved — 2 widgets',
  },
  {
    id: 'evt-012',
    timestamp: '2026-05-11T09:10:44Z',
    user: 'priya@friendly.io',
    action: 'deploy.triggered',
    resource: 'projects/proj-nb-tracker/builds/build-001',
    status: 'pending',
  },
  {
    id: 'evt-013',
    timestamp: '2026-05-11T09:13:59Z',
    user: 'system',
    action: 'deploy.failed',
    resource: 'projects/proj-nb-tracker/builds/build-001',
    status: 'failure',
    detail: 'Build error: missing environment variable MAPBOX_TOKEN',
  },
  {
    id: 'evt-014',
    timestamp: '2026-05-11T09:30:00Z',
    user: 'sean@friendly.io',
    action: 'api_key.rotated',
    resource: 'settings/api-keys/key-prod-001',
    status: 'success',
    detail: 'Production API key rotated — old key invalidated',
  },
  {
    id: 'evt-015',
    timestamp: '2026-05-11T10:00:00Z',
    user: 'marcos@friendly.io',
    action: 'login',
    resource: 'auth/session',
    status: 'success',
    detail: 'SSO login after account unlock',
  },
  {
    id: 'evt-016',
    timestamp: '2026-05-11T10:12:08Z',
    user: 'marcos@friendly.io',
    action: 'page.saved',
    resource: 'projects/proj-aiaep-001/pages/alerts',
    status: 'success',
    detail: 'Layout saved — 6 widgets',
  },
  {
    id: 'evt-017',
    timestamp: '2026-05-11T10:45:30Z',
    user: 'sean@friendly.io',
    action: 'settings.changed',
    resource: 'settings/billing',
    status: 'success',
    detail: 'Plan upgraded from Starter to Professional',
  },
  {
    id: 'evt-018',
    timestamp: '2026-05-11T11:00:00Z',
    user: 'priya@friendly.io',
    action: 'deploy.triggered',
    resource: 'projects/proj-nb-tracker/builds/build-002',
    status: 'pending',
    detail: 'Retry after adding MAPBOX_TOKEN to env',
  },
  {
    id: 'evt-019',
    timestamp: '2026-05-11T11:03:21Z',
    user: 'system',
    action: 'deploy.completed',
    resource: 'projects/proj-nb-tracker/builds/build-002',
    status: 'success',
    detail: 'Deployed to staging — 3m 21s',
  },
  {
    id: 'evt-020',
    timestamp: '2026-05-11T11:30:00Z',
    user: 'sean@friendly.io',
    action: 'logout',
    resource: 'auth/session',
    status: 'success',
  },
];
