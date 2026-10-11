import { json } from "./_lib.js";

// Reaching this means the middleware accepted the session.
export const onRequestGet = () => json({ ok: true });
