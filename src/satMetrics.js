// satMetrics.js
import os from "os";
import { execSync } from "child_process";
import fs from "fs";

function safeNumber(n) {
    return Number.isFinite(n) ? n : null;
}

function round1(n) {
    return Math.round(n * 10) / 10;
}

function parsePercent(v) {
    if (typeof v !== "string") return null;
    const n = Number(v.replace("%", "").trim());
    return Number.isFinite(n) ? n : null;
}

function readCpuTimes() {
    const cpus = os.cpus();
    let user = 0, nice = 0, sys = 0, idle = 0, irq = 0;
    for (const c of cpus) {
        user += c.times.user;
        nice += c.times.nice;
        sys += c.times.sys;
        idle += c.times.idle;
        irq += c.times.irq;
    }
    const total = user + nice + sys + idle + irq;
    return { user, nice, sys, idle, irq, total };
}

// Estado interno para estimar CPU host %
let lastCpu = readCpuTimes();

function cpuHostPercentSinceLast() {
    const now = readCpuTimes();

    const idleDelta = now.idle - lastCpu.idle;
    const totalDelta = now.total - lastCpu.total;

    lastCpu = now;

    if (totalDelta <= 0) return null;
    const usage = 1 - idleDelta / totalDelta; // 0..1
    return Math.round(usage * 1000) / 10; // 1 decimal
}

function getDiskRoot() {
    try {
        const out = execSync("df -kP /").toString().trim().split("\n");
        const parts = out[1].split(/\s+/);
        return {
            filesystem: parts[0],
            total_kb: Number(parts[1]),
            used_kb: Number(parts[2]),
            avail_kb: Number(parts[3]),
            use_pct: parts[4],
            mount: parts[5],
        };
    } catch {
        return null;
    }
}

function getTempC() {
    // 1) Linux thermal_zone
    try {
        const zones = fs.readdirSync("/sys/class/thermal").filter((d) =>
            d.startsWith("thermal_zone")
        );
        for (const z of zones) {
            const p = `/sys/class/thermal/${z}/temp`;
            if (fs.existsSync(p)) {
                const raw = fs.readFileSync(p, "utf8").trim();
                const v = Number(raw);
                if (Number.isFinite(v)) return v > 200 ? v / 1000 : v;
            }
        }
    } catch {
        // ignore
    }

    // 2) Fallback a `sensors` si existe
    try {
        const out = execSync("sensors 2>/dev/null | head -n 50").toString();
        const m = out.match(/([-+]?\d+(\.\d+)?)°C/);
        if (m) return Number(m[1]);
    } catch {
        // ignore
    }

    return null;
}

function getProcessCpuPercentApprox(sampleMs = 150) {
    const start = process.cpuUsage();
    const startAt = process.hrtime.bigint();

    // sleep sync corto
    const sab = new SharedArrayBuffer(4);
    const ia = new Int32Array(sab);
    Atomics.wait(ia, 0, 0, sampleMs);

    const end = process.cpuUsage(start);
    const endAt = process.hrtime.bigint();

    const elapsedUs = Number(endAt - startAt) / 1000;
    const usedUs = end.user + end.system;

    if (!Number.isFinite(elapsedUs) || elapsedUs <= 0) return null;
    const pct = (usedUs / elapsedUs) * 100;
    return Math.round(pct * 10) / 10;
}

function buildSimple(raw) {
    const host = raw.host ?? {};
    const proc = raw.process ?? {};
    const disk = host.disk_root ?? {};

    const memTotal = Number(host.mem_total_bytes ?? 0);
    const memFree = Number(host.mem_free_bytes ?? 0);

    const usoRamPct =
        memTotal > 0 ? round1(((memTotal - memFree) / memTotal) * 100) : null;

    const libreRamPct =
        memTotal > 0 ? round1((memFree / memTotal) * 100) : null;

    const usoDiscoPct = parsePercent(disk.use_pct);

    return {
        servicio: raw.service,
        timestamp: raw.ts,
        estado: raw.status,

        // Host
        host: host.hostname ?? null,
        cpuCores: host.cpus ?? null,
        usoCpuPct: host.cpu_usage_pct_estimate ?? null,
        carga1m: host.loadavg_1_5_15?.[0] ?? null,

        usoRamPct,
        libreRamPct,

        usoDiscoPct,
        tempC: host.temp_c ?? null,

        // Proceso
        pid: proc.pid ?? null,
        uptimeSec: proc.uptime_sec ?? null,
        usoCpuProcesoPct: proc.cpu_pct_approx ?? null,
        ramProcesoMB:
            typeof proc.rss_bytes === "number"
                ? round1(proc.rss_bytes / 1024 / 1024)
                : null,
        heapUsadoMB:
            typeof proc.heap_used_bytes === "number"
                ? round1(proc.heap_used_bytes / 1024 / 1024)
                : null,
    };
}

export async function collectSatMetrics(options = {}) {
    const {
        serviceName = process.env.SERVICE_NAME || "node-service",
        includeProcessCpu = true,
        processCpuSampleMs = 150,

        // si querés SOLO simple, poné returnRaw: false
        returnRaw = true,
    } = options;

    const mem = process.memoryUsage();

    const raw = {
        service: serviceName,
        ts: new Date().toISOString(),
        status: "ok",
        process: {
            pid: process.pid,
            uptime_sec: Math.round(process.uptime()),
            rss_bytes: mem.rss,
            heap_used_bytes: mem.heapUsed,
            heap_total_bytes: mem.heapTotal,
            cpu_pct_approx: includeProcessCpu
                ? getProcessCpuPercentApprox(processCpuSampleMs)
                : null,
        },
        host: {
            hostname: os.hostname(),
            platform: os.platform(),
            arch: os.arch(),
            cpus: os.cpus().length,
            loadavg_1_5_15: os.loadavg(),
            mem_total_bytes: os.totalmem(),
            mem_free_bytes: os.freemem(),
            cpu_usage_pct_estimate: cpuHostPercentSinceLast(),
            temp_c: safeNumber(getTempC()),
            disk_root: getDiskRoot(),
        },
    };

    const simple = buildSimple(raw);

    return returnRaw ? { simple, raw } : simple;
}
