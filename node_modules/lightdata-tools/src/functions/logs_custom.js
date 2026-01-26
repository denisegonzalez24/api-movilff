const isLocal = true;

export function logGreen(...args) {
    if (isLocal) console.log("\x1b[32m✅", ...args, "\x1b[0m");
}

export function logRed(...args) {
    if (isLocal) console.log("\x1b[31m❌", ...args, "\x1b[0m");
}

export function logBlue(...args) {
    if (isLocal) console.log("\x1b[34m🔵", ...args, "\x1b[0m");
}

export function logYellow(...args) {
    if (isLocal) console.log("\x1b[33m⚠️", ...args, "\x1b[0m");
}

export function logPurple(...args) {
    if (isLocal) console.log("\x1b[35m💜", ...args, "\x1b[0m");
}

export function logCyan(...args) {
    if (isLocal) console.log("\x1b[36m💎", ...args, "\x1b[0m");
}

export function logOrange(...args) {
    if (isLocal) console.log("\x1b[38;2;255;165;0m🟠", ...args, "\x1b[0m");
}

export function logGray(...args) {
    if (isLocal) console.log("\x1b[90m⚪", ...args, "\x1b[0m");
}