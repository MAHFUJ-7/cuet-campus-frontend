// Ported from describeApiError() in api_client.dart — identical messages.

/**
 * Turn any thrown error into a short, user-presentable message.
 * `error` may be an ApiError (with .type/.status/.serverMessage), a TypeError
 * from fetch (network failure), or anything else.
 */
export function describeApiError(error) {
  if (!error) return 'An unexpected error occurred.';

  // Pre-normalized API errors carry a ready message.
  if (error.userMessage) return error.userMessage;

  if (error.name === 'AbortError') {
    return 'Connection timed out. Check your internet and try again.';
  }

  if (error instanceof TypeError) {
    // fetch() throws TypeError for connection-level failures.
    return 'No internet connection.';
  }

  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

/** Humanize an HTTP status (mirrors _handleBadResponse). */
export function messageForStatus(status, serverMessage) {
  if (serverMessage) return serverMessage;
  switch (status) {
    case 400:
      return 'Invalid request.';
    case 401:
      return 'Session expired. Please login again.';
    case 403:
      return 'You do not have access to this resource.';
    case 404:
      return 'Not found.';
    case 409:
      return 'Already exists.';
    case 500:
    case 502:
    case 503:
      return 'Server error. Please try again later.';
    default:
      return `Something went wrong (${status}).`;
  }
}
