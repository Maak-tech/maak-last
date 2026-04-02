type LogLevel = "debug" | "info" | "warn" | "error";

const IS_DEV = process.env.NODE_ENV !== "production";

function log(level: LogLevel, message: string, data?: unknown, context?: string) {
  if (!IS_DEV && level === "debug") return;
  const prefix = context ? `[${context}]` : "";
  const formatted = `${prefix} ${message}`;
  switch (level) {
    case "debug": console.debug(formatted, data ?? ""); break;
    case "info":  console.info(formatted, data ?? "");  break;
    case "warn":  console.warn(formatted, data ?? "");  break;
    case "error": console.error(formatted, data ?? ""); break;
  }
}

export const logger = {
  debug: (msg: string, data?: unknown, ctx?: string) => log("debug", msg, data, ctx),
  info:  (msg: string, data?: unknown, ctx?: string) => log("info",  msg, data, ctx),
  warn:  (msg: string, data?: unknown, ctx?: string) => log("warn",  msg, data, ctx),
  error: (msg: string, data?: unknown, ctx?: string) => log("error", msg, data, ctx),
};
