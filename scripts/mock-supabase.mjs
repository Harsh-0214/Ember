// Local stand-in for Supabase used ONLY for screenshots and e2e tests in
// environments without a real project. It runs the real migrations on PGlite
// and implements the small subset of PostgREST + GoTrue that Ember uses.
// Usage: node scripts/mock-supabase.mjs [port]
import http from "node:http";
import crypto from "node:crypto";
import { bootDb } from "./lib/pglite-db.mjs";

const PORT = Number(process.argv[2] ?? 54329);
const db = await bootDb();
let queue = Promise.resolve();
const serial = (fn) => (queue = queue.then(fn, fn));

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function makeToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub: user.id, email: user.email, role: "authenticated", aud: "authenticated", exp: now + 3600, iat: now, session_id: crypto.randomUUID() };
  return `${b64u({ alg: "HS256", typ: "JWT" })}.${b64u(payload)}.${crypto.randomBytes(16).toString("base64url")}`;
}
const parseToken = (t) => {
  try {
    return JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString());
  } catch {
    return null;
  }
};
const userJson = (u) => ({ id: u.id, aud: "authenticated", role: "authenticated", email: u.email, email_confirmed_at: new Date().toISOString(), app_metadata: { provider: "email" }, user_metadata: {}, created_at: new Date().toISOString() });
const session = (u) => ({ access_token: makeToken(u), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: `${u.id}.${crypto.randomUUID()}`, user: userJson(u) });

async function findOrCreateUser(email) {
  const r = await db.query("select id, email from auth.users where email = $1", [email]);
  if (r.rows[0]) return r.rows[0];
  const ins = await db.query("insert into auth.users (email) values ($1) returning id, email", [email]);
  return ins.rows[0];
}

// ---------------- PostgREST subset ----------------
const ident = (s) => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(s)) throw new Error(`bad identifier ${s}`);
  return `"${s}"`;
};
function splitTop(s) {
  const out = [];
  let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
const singular = (t) => t.replace(/ies$/, "y").replace(/s$/, "");

async function columnsOf(table) {
  const r = await db.query("select column_name from information_schema.columns where table_schema='public' and table_name=$1", [table]);
  return r.rows.map((x) => x.column_name);
}

async function selectSql(table, select, alias) {
  const items = splitTop(select || "*");
  const parts = [];
  for (const it of items) {
    const m = it.match(/^([a-z_]+)(?:!inner)?\((.*)\)$/i);
    if (!m) {
      parts.push(it === "*" ? `${alias}.*` : `${alias}.${ident(it.split(":")[0])}`);
      continue;
    }
    const rel = m[1];
    const sub = m[2];
    const relCols = await columnsOf(rel);
    const myCols = await columnsOf(table);
    const fkOnRel = `${singular(table)}_id`;
    const fkOnMe = `${singular(rel)}_id`;
    const a2 = `${alias}_${rel}`;
    const inner = await selectSql(rel, sub, a2);
    if (relCols.includes(fkOnRel)) {
      parts.push(`(select coalesce(json_agg(x), '[]'::json) from (select ${inner} from public.${ident(rel)} ${a2} where ${a2}.${ident(fkOnRel)} = ${alias}.id) x) as ${ident(rel)}`);
    } else if (myCols.includes(fkOnMe)) {
      parts.push(`(select row_to_json(x) from (select ${inner} from public.${ident(rel)} ${a2} where ${a2}.id = ${alias}.${ident(fkOnMe)}) x) as ${ident(rel)}`);
    } else throw new Error(`unknown relation ${rel}`);
  }
  return parts.join(", ");
}

function condition(col, expr, params, alias) {
  let negate = false;
  let e = expr;
  if (e.startsWith("not.")) {
    negate = true;
    e = e.slice(4);
  }
  const dot = e.indexOf(".");
  const op = e.slice(0, dot);
  const val = e.slice(dot + 1);
  const c = `${alias}.${ident(col)}`;
  const p = (v) => {
    params.push(v);
    return `$${params.length}`;
  };
  let sql;
  switch (op) {
    case "eq": sql = `${c}::text = ${p(val)}`; break;
    case "neq": sql = `${c}::text <> ${p(val)}`; break;
    case "gt": sql = `${c} > ${p(val)}`; break;
    case "gte": sql = `${c} >= ${p(val)}`; break;
    case "lt": sql = `${c} < ${p(val)}`; break;
    case "lte": sql = `${c} <= ${p(val)}`; break;
    case "like": sql = `${c} like ${p(val.replace(/\*/g, "%"))}`; break;
    case "ilike": sql = `${c} ilike ${p(val.replace(/\*/g, "%"))}`; break;
    case "is": sql = `${c} is ${val === "null" ? "null" : val === "true" ? "true" : "false"}`; break;
    case "in": sql = `${c}::text = any(${p(val.replace(/^\(|\)$/g, "").split(",").map((x) => x.replace(/^"|"$/g, "")))})`; break;
    default: throw new Error(`unsupported op ${op}`);
  }
  return negate ? `not (${sql})` : sql;
}

const SHARED = new Set(["foods", "food_servings", "exercise_types"]);
/** Emulates RLS: signed-in users only see their own rows (plus shared rows). */
async function rlsCondition(table, alias, params, userId) {
  if (!userId) return null; // service role bypasses RLS
  const cols = await columnsOf(table);
  if (!cols.includes("user_id")) return null;
  params.push(userId);
  const p = "$" + params.length;
  return SHARED.has(table) ? `(${alias}.user_id::text = ${p} or ${alias}.user_id is null)` : `${alias}.user_id::text = ${p}`;
}

function whereSql(sp, params, alias, extra = null) {
  const conds = extra ? [extra] : [];
  for (const [k, v] of sp.entries()) {
    if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(k)) continue;
    if (k === "or") {
      const inner = splitTop(v.replace(/^\(|\)$/g, "")).map((x) => {
        const i = x.indexOf(".");
        return condition(x.slice(0, i), x.slice(i + 1), params, alias);
      });
      conds.push(`(${inner.join(" or ")})`);
    } else conds.push(condition(k, v, params, alias));
  }
  return conds.length ? `where ${conds.join(" and ")}` : "";
}

function orderSql(order, alias) {
  if (!order) return "";
  return `order by ${order.split(",").map((o) => {
    const [col, ...mods] = o.split(".");
    return `${alias}.${ident(col)} ${mods.includes("desc") ? "desc" : "asc"}${mods.includes("nullsfirst") ? " nulls first" : mods.includes("nullslast") ? " nulls last" : ""}`;
  }).join(", ")}`;
}

async function handleRest(req, res, url, body, userId) {
  const table = url.pathname.replace("/rest/v1/", "");
  const sp = url.searchParams;
  const wantsObject = (req.headers.accept ?? "").includes("vnd.pgrst.object");
  const prefer = req.headers.prefer ?? "";
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);

  if (table.startsWith("rpc/")) {
    const fn = table.slice(4);
    if (fn === "rate_limit_hit") return send(res, 200, true);
    return send(res, 404, { message: "rpc not mocked" });
  }

  const alias = "t";
  if (req.method === "GET" || req.method === "HEAD") {
    const params = [];
    const rls = await rlsCondition(table, alias, params, userId);
    const sql = `select coalesce(json_agg(r), '[]'::json) as data from (select ${await selectSql(table, sp.get("select"), alias)} from public.${ident(table)} ${alias} ${whereSql(sp, params, alias, rls)} ${orderSql(sp.get("order"), alias)} ${sp.get("limit") ? `limit ${Number(sp.get("limit"))}` : ""} ${sp.get("offset") ? `offset ${Number(sp.get("offset"))}` : ""}) r`;
    const rows = (await db.query(sql, params)).rows[0].data;
    if (wantsObject) return rows.length === 1 ? send(res, 200, rows[0]) : send(res, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: `Results contain ${rows.length} rows` });
    return send(res, 200, rows);
  }

  if (req.method === "POST") {
    const rows = Array.isArray(body) ? body : [body];
    if (!rows.length) return send(res, 201, []);
    const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const params = [];
    const values = rows.map((r) => `(${cols.map((c) => {
      if (!(c in r)) return "default";
      const v = r[c];
      params.push(v !== null && typeof v === "object" && !Array.isArray(v) ? JSON.stringify(v) : v);
      return `$${params.length}`;
    }).join(", ")})`);
    let conflict = "";
    const onConflict = sp.get("on_conflict");
    if (prefer.includes("resolution=ignore-duplicates")) conflict = `on conflict ${onConflict ? `(${onConflict.split(",").map(ident).join(",")})` : ""} do nothing`;
    else if (prefer.includes("resolution=merge-duplicates")) {
      const target = onConflict ? onConflict.split(",") : ["id"];
      const upd = cols.filter((c) => !target.includes(c));
      conflict = `on conflict (${target.map(ident).join(",")}) do ${upd.length ? `update set ${upd.map((c) => `${ident(c)} = excluded.${ident(c)}`).join(", ")}` : "nothing"}`;
    }
    const sql = `with ins as (insert into public.${ident(table)} (${cols.map(ident).join(", ")}) values ${values.join(", ")} ${conflict} returning *) select coalesce(json_agg(ins), '[]'::json) as data from ins`;
    let inserted = (await db.query(sql, params)).rows[0].data;
    // re-read with embeds if requested
    if (sp.get("select") && sp.get("select") !== "*" && inserted.length && inserted[0].id) {
      inserted = (await db.query(`select coalesce(json_agg(r), '[]'::json) as data from (select ${await selectSql(table, sp.get("select"), alias)} from public.${ident(table)} ${alias} where ${alias}.id::text = any($1)) r`, [inserted.map((r) => r.id)])).rows[0].data;
    }
    if (wantsObject) return send(res, 201, inserted[0] ?? null);
    return send(res, 201, prefer.includes("return=representation") ? inserted : null);
  }

  if (req.method === "PATCH") {
    const params = [];
    const sets = Object.entries(body).map(([c, v]) => {
      params.push(v !== null && typeof v === "object" && !Array.isArray(v) ? JSON.stringify(v) : v);
      return `${ident(c)} = $${params.length}`;
    });
    const rlsU = await rlsCondition(table, alias, params, userId);
    const where = whereSql(sp, params, alias, rlsU);
    const sql = `with up as (update public.${ident(table)} ${alias} set ${sets.join(", ")} ${where} returning ${alias}.*) select coalesce(json_agg(up), '[]'::json) as data from up`;
    const rows = (await db.query(sql, params)).rows[0].data;
    if (wantsObject) return rows.length === 1 ? send(res, 200, rows[0]) : send(res, 406, { code: "PGRST116", message: "no rows" });
    return send(res, 200, rows);
  }

  if (req.method === "DELETE") {
    const params = [];
    const rlsD = await rlsCondition(table, alias, params, userId);
    const sql = `with d as (delete from public.${ident(table)} ${alias} ${whereSql(sp, params, alias, rlsD)} returning ${alias}.*) select coalesce(json_agg(d), '[]'::json) as data from d`;
    const rows = (await db.query(sql, params)).rows[0].data;
    return send(res, 200, rows);
  }
  return send(res, 405, { message: "method not allowed" });
}

function send(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*" });
  res.end(data === null || data === undefined ? "" : JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, null);
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () =>
    serial(async () => {
      const url = new URL(req.url, `http://localhost:${PORT}`);
      let body = {};
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        /* ignore */
      }
      const auth = (req.headers.authorization ?? "").replace(/^Bearer /, "");
      const claims = parseToken(auth);
      const userId = claims?.role === "authenticated" ? claims.sub : null;
      try {
        if (url.pathname === "/auth/v1/token") {
          const grant = url.searchParams.get("grant_type");
          if (grant === "password") {
            if (!body.password || body.password.length < 6) return send(res, 400, { error: "invalid_grant", error_description: "Invalid login credentials" });
            return send(res, 200, session(await findOrCreateUser(String(body.email).toLowerCase())));
          }
          if (grant === "refresh_token") {
            const id = String(body.refresh_token ?? "").split(".")[0];
            const r = await db.query("select id, email from auth.users where id::text = $1", [id]);
            return r.rows[0] ? send(res, 200, session(r.rows[0])) : send(res, 400, { error: "invalid_grant" });
          }
        }
        if (url.pathname === "/auth/v1/signup") return send(res, 200, session(await findOrCreateUser(String(body.email).toLowerCase())));
        if (url.pathname === "/auth/v1/user") {
          if (!userId) return send(res, 401, { message: "invalid JWT" });
          const r = await db.query("select id, email from auth.users where id::text = $1", [userId]);
          return r.rows[0] ? send(res, 200, userJson(r.rows[0])) : send(res, 401, { message: "user not found" });
        }
        if (url.pathname === "/auth/v1/logout") return send(res, 204, null);
        if (url.pathname === "/auth/v1/otp") return send(res, 200, {});
        if (url.pathname.startsWith("/auth/v1/.well-known")) return send(res, 200, { keys: [] });
        if (url.pathname.startsWith("/rest/v1/")) {
          // the service role (no user) is allowed everything, like the real thing
          return await handleRest(req, res, url, body, userId);
        }
        if (url.pathname === "/__reset") {
          await db.exec("delete from auth.users");
          return send(res, 200, { ok: true });
        }
        return send(res, 404, { message: `not mocked: ${url.pathname}` });
      } catch (e) {
        console.error("[mock]", req.method, url.pathname, url.search, e.message);
        return send(res, 400, { code: e.code ?? "PGRST", message: e.message });
      }
    }),
  );
});
server.listen(PORT, () => console.log(`mock supabase on http://127.0.0.1:${PORT}`));
