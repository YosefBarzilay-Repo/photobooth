/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/**
 * @param {number | null} timerId
 */
export function clearTimer(timerId) {
  if (timerId !== null) {
    window.clearTimeout(timerId);
  }
}

/**
 * @param {number | null} timerId
 */
export function clearIntervalTimer(timerId) {
  if (timerId !== null) {
    window.clearInterval(timerId);
  }
}
