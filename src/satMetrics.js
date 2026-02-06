// satMetrics.js
import os from "os";
import { execSync } from "child_process";
import fs from "fs";

function safeNumber(n) {
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
let lastAt = Date.now();

function cpuHostPercentSinceLast() {
    const now = readCpuTimes();
    const nowAt = Date.now();

    const idleDelta = now.idle - lastCpu.idle;
    const totalDelta = now.total - lastCpu.total;

    lastCpu = now;
    lastAt = nowAt;

    if (totalDelta <= 0) return null;
    const usage = 1 - idleDelta / totalDelta; // 0..1
    return Math.round(usage * 1000) / 10; // 1 decimal
}

function getDiskRoot() {
    // Linux/macOS: df -kP /
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

function getProcessCpuPercentApprox(sampleMs = 250) {
    // Aproximación: usa process.cpuUsage() en una ventana corta
    // Devuelve % total (puede ser >100 en multi-core).
    const start = process.cpuUsage();
    const startAt = process.hrtime.bigint();

    // Busy wait NO: mejor un sleep sync chiquito con Atomics
    const sab = new SharedArrayBuffer(4);
    const ia = new Int32Array(sab);
    Atomics.wait(ia, 0, 0, sampleMs);

    const end = process.cpuUsage(start);
    const endAt = process.hrtime.bigint();

    const elapsedUs = Number(endAt - startAt) / 1000; // microsegundos
    const usedUs = end.user + end.system;

    if (!Number.isFinite(elapsedUs) || elapsedUs <= 0) return null;
    const pct = (usedUs / elapsedUs) * 100;
    return Math.round(pct * 10) / 10;
}

export async function collectSatMetrics(options = {}) {
    const {
        serviceName = process.env.SERVICE_NAME || "node-service",
        includeProcessCpu = true,
        processCpuSampleMs = 150,
    } = options;

    const mem = process.memoryUsage();

    const hostCpuPct = cpuHostPercentSinceLast();
    const disk = getDiskRoot();
    const tempC = getTempC();

    const procCpuPct = includeProcessCpu
        ? getProcessCpuPercentApprox(processCpuSampleMs)
        : null;

    return {
        service: serviceName,
        ts: new Date().toISOString(),
        status: "ok",
        process: {
            pid: process.pid,
            uptime_sec: Math.round(process.uptime()),
            rss_bytes: mem.rss,
            heap_used_bytes: mem.heapUsed,
            heap_total_bytes: mem.heapTotal,
            cpu_pct_approx: procCpuPct, // % del proceso en ventana corta
        },
        host: {
            hostname: os.hostname(),
            platform: os.platform(),
            arch: os.arch(),
            cpus: os.cpus().length,
            loadavg_1_5_15: os.loadavg(),
            mem_total_bytes: os.totalmem(),
            mem_free_bytes: os.freemem(),
            cpu_usage_pct_estimate: hostCpuPct, // % host aprox (se estabiliza en 2+ llamadas)
            temp_c: safeNumber(tempC),
            disk_root: disk,
        },
    };
}
