let debugEnabled = false;

export function setDebug(enabled) {
  debugEnabled = enabled;
}

export function log(...args) {
  if (debugEnabled) {
    console.log(...args);
  }
}

export function warn(...args) {
  if (debugEnabled) {
    console.warn(...args);
  }
}

export function error(...args) {
  console.error(...args);
}
