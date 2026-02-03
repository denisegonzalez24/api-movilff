import crypto from "crypto";

const expected = "a8a80b645902138ee6d5cc80d8c45a0497c924fce2e354aab8e2605c1c9303f1";

for (const candidate of [
    "nuriaquejona",
    "NuriaQuejona",
    "NURIAQUEJONA",
    "nuriaquejona\n",
    "nuriaquejona\r\n",
    " nuriaquejona",
    "nuriaquejona ",
]) {
    const hash = crypto
        .createHash("sha256")
        .update(candidate, "utf8")
        .digest("hex")
        .toLowerCase();

    console.log(candidate.replace(/\n/g, "\\n").replace(/\r/g, "\\r"), hash, hash === expected ? "✅ MATCH" : "");
}
