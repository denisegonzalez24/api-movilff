// query-utils.js
import { executeQuery, toInt, isNonEmptyString, escapeLike } from "lightdata-tools";

/** Builder de WHERE + params */
export class SqlWhere {
    constructor() {
        this.clauses = [];
        this.params = [];
    }
    add(cond, ...vals) {
        if (cond) {
            this.clauses.push(cond);
            if (vals.length) this.params.push(...vals);
        }
        return this;
    }
    eq(col, val) {
        if (val !== undefined && val !== null) this.add(`${col} = ?`, val);
        return this;
    }
    neq(col, val) {
        if (val !== undefined && val !== null) this.add(`${col} <> ?`, val);
        return this;
    }
    in(col, arr) {
        if (Array.isArray(arr) && arr.length) {
            const marks = arr.map(() => "?").join(",");
            this.add(`${col} IN (${marks})`, ...arr);
        }
        return this;
    }
    likeCI(col, value) {
        if (isNonEmptyString(value)) {
            this.add(`LOWER(${col}) LIKE ?`, `%${String(value).toLowerCase()}%`);
        }
        return this;
    }
    likeEscaped(col, value, { caseInsensitive = false } = {}) {
        if (isNonEmptyString(value)) {
            const term = `%${escapeLike(value)}%`;
            if (caseInsensitive) {
                this.add(`LOWER(${col}) LIKE LOWER(?) ESCAPE '\\\\'`, term);
            } else {
                this.add(`${col} LIKE ? ESCAPE '\\\\'`, term);
            }
        }
        return this;
    }
    finalize() {
        const whereSql = this.clauses.length ? `WHERE  ${this.clauses.join(" AND ")}` : "";
        return { whereSql, params: this.params };
    }
}

/** Paginación segura (clamp + LIMIT/OFFSET) */
export function makePagination(
    q,
    { pageKey = "page", pageSizeKey = "page_size", defaultPage = 1, defaultPageSize = 10, maxPageSize = 100 } = {}
) {
    const page = Math.max(1, toInt(q?.[pageKey], defaultPage));
    const ps = Math.max(1, Math.min(toInt(q?.[pageSizeKey], defaultPageSize), maxPageSize));
    const offset = (page - 1) * ps;
    return { page, pageSize: ps, offset, limitSql: "LIMIT ? OFFSET ?", limitParams: [ps, offset] };
}

/** Orden seguro (whitelist) */
export function makeSort(q, sortMap, { defaultKey = Object.keys(sortMap)[0], byKey = "sort_by", dirKey = "sort_dir" } = {}) {
    const sortBy = String(q?.[byKey] ?? "").trim();
    const col = sortMap[sortBy] || sortMap[defaultKey] || defaultKey;
    const dir = String(q?.[dirKey] ?? "asc").trim().toLowerCase() === "desc" ? "DESC" : "ASC";
    return { orderSql: `ORDER BY ${col} ${dir}` };
}

/** Ejecuta SELECT + COUNT con mismos WHERE/PARAMS */
export async function runPagedQuery(db, { select, from, whereSql, orderSql, params, pageSize, offset }) {
    const dataSql = `SELECT ${select} ${from} ${whereSql} ${orderSql} LIMIT ? OFFSET ?`;
    const rows = await executeQuery({ db, query: dataSql, values: [...params, pageSize, offset], log: true });

    const countSql = `SELECT COUNT(*) AS total ${from} ${whereSql}`;
    const [{ total = 0 } = {}] = await executeQuery({ db, query: countSql, values: params });

    return { rows, total };
}

/** Construye meta estándar */
export function buildMeta({ page, pageSize, totalItems, filters }) {
    const totalPages = totalItems === 0 ? 0 : Math.max(1, Math.ceil(totalItems / pageSize));
    const meta = { timestamp: new Date().toISOString(), page, pageSize, totalPages, totalItems };
    if (filters && Object.keys(filters).length) meta.filters = filters;
    return meta;
}
