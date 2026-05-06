module.exports = {
  setTarget,
  beforeRequest,
  afterResponse,
};

function setTarget(requestParams, context, ee, next) {
  const target = process.env.TARGET_URL || 'https://staging.friendly-aiaep.com';
  requestParams.url = `${target}${requestParams.url}`;
  return next();
}

function beforeRequest(requestParams, context, ee, next) {
  // Add custom headers or modify request before sending
  requestParams.headers = requestParams.headers || {};
  requestParams.headers['X-Artillery-Test'] = 'true';
  requestParams.headers['X-Request-ID'] = `artillery-${Date.now()}-${Math.random()}`;

  return next();
}

function afterResponse(requestParams, response, context, ee, next) {
  // Custom metrics or validation after response
  if (response.statusCode >= 500) {
    ee.emit('counter', 'server_errors', 1);
  }

  if (response.timings && response.timings.response > 1000) {
    ee.emit('counter', 'slow_responses', 1);
  }

  return next();
}
