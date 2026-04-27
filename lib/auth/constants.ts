/**
 * Auth constants — pure (no Node APIs)
 * แยกออกมาเพื่อให้ middleware (Edge runtime) import ได้โดยไม่ pull in 'crypto'
 */
export const SESSION_COOKIE = "lp_session";
export const SESSION_IDLE_MIN = 60;
export const SESSION_COOKIE_MAX_AGE_DAYS = 7;
