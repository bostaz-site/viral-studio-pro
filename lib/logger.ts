import pino from 'pino'

const base = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
})

/**
 * Thin wrapper around pino that also accepts console-style args:
 *   logger.error('msg', detail)  →  pino.error({ detail }, 'msg')
 *   logger.error({ key }, 'msg') →  pino.error({ key }, 'msg')   (pass-through)
 */
function wrap(level: 'info' | 'warn' | 'error' | 'debug') {
  return (...args: unknown[]) => {
    if (args.length === 0) return
    // Single string arg — standard pino call
    if (args.length === 1 && typeof args[0] === 'string') {
      base[level](args[0])
      return
    }
    // First arg is object — already pino-style
    if (typeof args[0] === 'object' && args[0] !== null && !(args[0] instanceof Error)) {
      base[level](args[0] as object, ...(args.slice(1) as [string]))
      return
    }
    // First arg is string + extra args — console-style, merge extras into context
    if (typeof args[0] === 'string') {
      const msg = args[0]
      const rest = args.slice(1)
      if (rest.length === 1 && rest[0] instanceof Error) {
        base[level]({ err: rest[0] }, msg)
      } else if (rest.length === 1) {
        base[level]({ detail: rest[0] }, msg)
      } else {
        base[level]({ details: rest }, msg)
      }
      return
    }
    // Fallback — Error as first arg
    if (args[0] instanceof Error) {
      base[level]({ err: args[0] }, args[0].message)
      return
    }
    base[level]({ detail: args[0] }, String(args[0]))
  }
}

export const logger = {
  info: wrap('info'),
  warn: wrap('warn'),
  error: wrap('error'),
  debug: wrap('debug'),
  child: base.child.bind(base),
}
