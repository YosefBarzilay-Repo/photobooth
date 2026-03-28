import { invokeDesktop, isDesktopApp } from "./desktopService.js";

let pendingWrite = Promise.resolve();

function normalizeContext(context) {
  if (context === undefined || context === null) {
    return "";
  }

  if (context instanceof Error) {
    return JSON.stringify({
      name: context.name,
      message: context.message,
      stack: context.stack || ""
    });
  }

  if (typeof context === "string") {
    return context;
  }

  try {
    return JSON.stringify(context);
  } catch {
    return String(context);
  }
}

function writeConsole(level, action, contextText) {
  const payload = contextText ? `${action} | ${contextText}` : action;
  if (level === "ERROR") {
    console.error(payload);
    return;
  }

  if (level === "WARN") {
    console.warn(payload);
    return;
  }

  console.log(payload);
}

async function appendDesktopLog(level, action, contextText) {
  await invokeDesktop("append_app_log", {
    level,
    message: action,
    context: contextText || null
  });
}

export function logEvent(level, action, context) {
  const normalizedLevel = String(level || "INFO").toUpperCase();
  const normalizedAction = String(action || "Unknown action").trim() || "Unknown action";
  const contextText = normalizeContext(context);

  writeConsole(normalizedLevel, normalizedAction, contextText);

  if (!isDesktopApp()) {
    return Promise.resolve();
  }

  pendingWrite = pendingWrite
    .catch(() => undefined)
    .then(() => appendDesktopLog(normalizedLevel, normalizedAction, contextText))
    .catch((error) => {
      const fallback = error instanceof Error ? error.message : String(error);
      console.error(`Failed to write app log: ${fallback}`);
    });

  return pendingWrite;
}

export function logError(action, error, context = {}) {
  const payload = {
    ...context,
    errorName: error instanceof Error ? error.name : undefined,
    errorMessage: error instanceof Error ? error.message : typeof error === "string" ? error : undefined,
    errorStack: error instanceof Error ? error.stack || "" : undefined
  };

  return logEvent("ERROR", action, payload);
}

export const logger = {
  debug(action, context) {
    return logEvent("DEBUG", action, context);
  },
  info(action, context) {
    return logEvent("INFO", action, context);
  },
  warn(action, context) {
    return logEvent("WARN", action, context);
  },
  error(action, context) {
    return logEvent("ERROR", action, context);
  },
  audit(action, context) {
    return logEvent("AUDIT", action, context);
  },
  exception(action, error, context) {
    return logError(action, error, context);
  }
};
