import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');
const TARGET_URL = __ENV.TARGET_URL || 'https://staging.friendly-aiaep.com';
const SCENARIO = __ENV.SCENARIO || 'normal-load';
const DURATION = __ENV.DURATION || '5m';

// Define scenarios
const scenarios = {
  'normal-load': {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 10 },
      { duration: DURATION, target: 10 },
      { duration: '1m', target: 0 },
    ],
  },
  'peak-load': {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 50 },
      { duration: DURATION, target: 50 },
      { duration: '2m', target: 0 },
    ],
  },
  'stress-test': {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 100 },
      { duration: '5m', target: 100 },
      { duration: '2m', target: 200 },
      { duration: '5m', target: 200 },
      { duration: '2m', target: 0 },
    ],
  },
};

export const options = {
  scenarios: {
    [SCENARIO]: scenarios[SCENARIO],
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.1'],
  },
};

export default function () {
  // Test health endpoint
  let healthRes = http.get(`${TARGET_URL}/health`);
  let healthCheck = check(healthRes, {
    'health status is 200': (r) => r.status === 200,
    'health response time < 200ms': (r) => r.timings.duration < 200,
  });
  errorRate.add(!healthCheck);

  sleep(1);

  // Test API endpoints
  let apiRes = http.get(`${TARGET_URL}/api/docs`);
  let apiCheck = check(apiRes, {
    'api docs status is 200': (r) => r.status === 200,
    'api response time < 500ms': (r) => r.timings.duration < 500,
  });
  errorRate.add(!apiCheck);

  sleep(1);

  // Test builder application
  let builderRes = http.get(`${TARGET_URL}/builder`);
  let builderCheck = check(builderRes, {
    'builder status is 200 or 404': (r) => r.status === 200 || r.status === 404,
    'builder response time < 1000ms': (r) => r.timings.duration < 1000,
  });
  errorRate.add(!builderCheck);

  sleep(2);
}

export function handleSummary(data) {
  return {
    'k6-summary.json': JSON.stringify(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const indent = options?.indent || '';
  const enableColors = options?.enableColors || false;

  let summary = `
${indent}${enableColors ? '\x1b[36m' : ''}
${indent}     /\\      |‾‾| /‾‾/   /‾‾/
${indent}    /  \\     |  |/  /   /  /
${indent}   /    \\    |     (   /   ‾‾\\
${indent}  /      \\   |  |\\  \\ |  (‾)  |
${indent} /   \/   \\  |__| \\__\\ \\_____/ .io
${indent}${enableColors ? '\x1b[0m' : ''}

${indent}execution: local
${indent}script: k6-tests.js
${indent}output: -

${indent}scenarios: (100.00%) 1 scenario, ${data.metrics.vus_max?.values.value} max VUs, ${DURATION} duration
${indent}default: ${data.metrics.iterations?.values.count} iterations

${indent}✓ checks.........................: ${(data.metrics.checks?.values.rate * 100).toFixed(2)}% ✓ ${data.metrics.checks?.values.passes} ✗ ${data.metrics.checks?.values.fails}
${indent}data_received..................: ${formatBytes(data.metrics.data_received?.values.count)}
${indent}data_sent......................: ${formatBytes(data.metrics.data_sent?.values.count)}
${indent}http_req_blocked...............: avg=${data.metrics.http_req_blocked?.values.avg.toFixed(2)}ms min=${data.metrics.http_req_blocked?.values.min.toFixed(2)}ms
${indent}http_req_connecting............: avg=${data.metrics.http_req_connecting?.values.avg.toFixed(2)}ms min=${data.metrics.http_req_connecting?.values.min.toFixed(2)}ms
${indent}http_req_duration..............: avg=${data.metrics.http_req_duration?.values.avg.toFixed(2)}ms min=${data.metrics.http_req_duration?.values.min.toFixed(2)}ms
${indent}  { expected_response:true }...: avg=${data.metrics['http_req_duration{expected_response:true}']?.values.avg.toFixed(2)}ms
${indent}http_req_failed................: ${(data.metrics.http_req_failed?.values.rate * 100).toFixed(2)}% ✓ ${data.metrics.http_req_failed?.values.passes} ✗ ${data.metrics.http_req_failed?.values.fails}
${indent}http_req_receiving.............: avg=${data.metrics.http_req_receiving?.values.avg.toFixed(2)}ms min=${data.metrics.http_req_receiving?.values.min.toFixed(2)}ms
${indent}http_req_sending...............: avg=${data.metrics.http_req_sending?.values.avg.toFixed(2)}ms min=${data.metrics.http_req_sending?.values.min.toFixed(2)}ms
${indent}http_req_tls_handshaking.......: avg=${data.metrics.http_req_tls_handshaking?.values.avg.toFixed(2)}ms min=${data.metrics.http_req_tls_handshaking?.values.min.toFixed(2)}ms
${indent}http_req_waiting...............: avg=${data.metrics.http_req_waiting?.values.avg.toFixed(2)}ms min=${data.metrics.http_req_waiting?.values.min.toFixed(2)}ms
${indent}http_reqs......................: ${data.metrics.http_reqs?.values.count} ${(data.metrics.http_reqs?.values.rate).toFixed(2)}/s
${indent}iteration_duration.............: avg=${data.metrics.iteration_duration?.values.avg.toFixed(2)}ms min=${data.metrics.iteration_duration?.values.min.toFixed(2)}ms
${indent}iterations.....................: ${data.metrics.iterations?.values.count} ${(data.metrics.iterations?.values.rate).toFixed(2)}/s
${indent}vus............................: ${data.metrics.vus?.values.value} min=${data.metrics.vus?.values.min} max=${data.metrics.vus?.values.max}
${indent}vus_max........................: ${data.metrics.vus_max?.values.value} min=${data.metrics.vus_max?.values.min} max=${data.metrics.vus_max?.values.max}
`;

  return summary;
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}
