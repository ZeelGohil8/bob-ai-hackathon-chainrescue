'use strict';
/**
 * logger.js — Color-coded terminal alerts for the ChainRescue CLI.
 *
 * Uses ANSI escape codes only (no external dependencies) so the CLI can run
 * without a full `npm install`.  When stdout is not a TTY (e.g. piped output),
 * color codes are automatically stripped.
 */

const isTTY = process.stdout.isTTY;

// ── ANSI color codes ──────────────────────────────────────────────────────────
const RESET  = isTTY ? '\x1b[0m'  : '';
const BOLD   = isTTY ? '\x1b[1m'  : '';
const DIM    = isTTY ? '\x1b[2m'  : '';

// Foreground colors
const FG_RED     = isTTY ? '\x1b[31m' : '';
const FG_GREEN   = isTTY ? '\x1b[32m' : '';
const FG_YELLOW  = isTTY ? '\x1b[33m' : '';
const FG_BLUE    = isTTY ? '\x1b[34m' : '';
const FG_MAGENTA = isTTY ? '\x1b[35m' : '';
const FG_CYAN    = isTTY ? '\x1b[36m' : '';
const FG_WHITE   = isTTY ? '\x1b[37m' : '';

// ── Timestamp helper ──────────────────────────────────────────────────────────
function timestamp() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${DIM}${hh}:${mm}:${ss}${RESET}`;
}

// ── Logger methods ────────────────────────────────────────────────────────────

/**
 * Plain informational message — white text.
 */
function info(message) {
  process.stdout.write(`${timestamp()} ${FG_WHITE}${message}${RESET}\n`);
}

/**
 * Success / OK message — green text with ✔ prefix.
 */
function success(message) {
  process.stdout.write(`${timestamp()} ${FG_GREEN}${BOLD}✔ ${message}${RESET}\n`);
}

/**
 * Warning alert (e.g. high-severity breach) — yellow text with ⚠ prefix.
 */
function warn(message) {
  process.stderr.write(`${timestamp()} ${FG_YELLOW}${BOLD}⚠  ${message}${RESET}\n`);
}

/**
 * Error / critical alert — red text with ✖ prefix.
 */
function error(message) {
  process.stderr.write(`${timestamp()} ${FG_RED}${BOLD}✖ ${message}${RESET}\n`);
}

/**
 * Critical breach alert — bold red with blinking prefix for maximum visibility.
 * Use for temperature or weather events classified as 'critical'.
 */
function critical(message) {
  // \x1b[5m = blink (supported in most terminals)
  const blink = isTTY ? '\x1b[5m' : '';
  process.stderr.write(`${timestamp()} ${FG_RED}${BOLD}${blink}🚨 CRITICAL: ${RESET}${FG_RED}${BOLD}${message}${RESET}\n`);
}

/**
 * Debug/verbose message — dim cyan. Only printed when DEBUG=1 env var is set.
 */
function debug(message) {
  if (process.env.DEBUG !== '1') return;
  process.stdout.write(`${timestamp()} ${FG_CYAN}${DIM}[debug] ${message}${RESET}\n`);
}

/**
 * Section header separator — bold blue.
 */
function section(title) {
  const line = '─'.repeat(Math.max(0, 54 - title.length));
  process.stdout.write(`\n${FG_BLUE}${BOLD}── ${title} ${line}${RESET}\n`);
}

/**
 * Highlight a key/value pair — label in magenta, value in white.
 */
function kv(label, value) {
  process.stdout.write(`  ${FG_MAGENTA}${label.padEnd(18)}${RESET} ${FG_WHITE}${value}${RESET}\n`);
}

/**
 * Print a severity badge inline.
 * @param {'critical'|'high'|'medium'|'low'} sev
 * @returns {string}
 */
function severityBadge(sev) {
  const map = {
    critical: `${FG_RED}${BOLD}[CRITICAL]${RESET}`,
    high:     `${FG_YELLOW}${BOLD}[HIGH]${RESET}`,
    medium:   `${FG_BLUE}[MEDIUM]${RESET}`,
    low:      `${FG_GREEN}[LOW]${RESET}`,
  };
  return map[sev] || `[${sev.toUpperCase()}]`;
}

module.exports = { info, success, warn, error, critical, debug, section, kv, severityBadge };
