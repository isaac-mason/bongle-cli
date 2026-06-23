// `bongle-cli deploy` — push a built bundle to the platform via the
// token-auth deploy API. Flow mirrors what the creator UI does, but
// authed by a Bearer `mcd_*` deploy token (the game is resolved from
// the token, so no slug is needed):
//   1. presign           POST /api/creators/deploy/version-upload
//   2. upload            PUT  <presigned url>   (Content-Type: application/zip)
//   3. finalize          POST /api/creators/deploy/version-upload/finalize
//   4. poll validation   GET  /api/creators/deploy/version-upload/:jobId
//   5. fetch version row GET  /api/creators/deploy/game-versions/:id
//
// The uploaded version lands in `draft`; set it live from the game's
// Versions panel (token-auth publish is a separate, later step).

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const DEFAULT_API = 'https://api.bongle.io';
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

function parseArgs(argv) {
    const args = {
        bundle: 'dist/bundle.zip',
        api: process.env.BONGLE_API_URL ?? DEFAULT_API,
        notes: null,
        json: false,
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--bundle') args.bundle = argv[++i];
        else if (a === '--api') args.api = argv[++i];
        else if (a === '--notes') args.notes = argv[++i];
        else if (a === '--json') args.json = true;
        else throw new Error(`unknown flag: ${a}`);
    }
    if (!args.bundle || !args.api) throw new Error('--bundle and --api must have values');
    return args;
}

export async function deploy(argv) {
    const args = parseArgs(argv);

    const token = process.env.BONGLE_DEPLOY_TOKEN;
    if (!token) {
        throw new Error(
            "BONGLE_DEPLOY_TOKEN is not set — mint one in the game's \"Deploy tokens\" panel",
        );
    }

    const api = args.api.replace(/\/+$/, '');
    const bundlePath = resolve(process.cwd(), args.bundle);

    let bytes;
    try {
        bytes = await readFile(bundlePath);
    } catch {
        throw new Error(`bundle not found at ${bundlePath} — run \`npm run build\` first`);
    }

    const auth = { Authorization: `Bearer ${token}` };
    const log = (msg) => {
        if (!args.json) console.error(msg);
    };

    // 1. presign
    log('[deploy] requesting upload url...');
    const { uploadUrl, uploadKey } = await apiPost(`${api}/api/creators/deploy/version-upload`, auth);

    // 2. upload the bytes directly to storage
    log(`[deploy] uploading ${(bytes.length / 1024 / 1024).toFixed(2)} MB...`);
    const put = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/zip' },
        body: bytes,
    });
    if (!put.ok) throw new Error(`bundle upload failed: HTTP ${put.status}`);

    // 3. finalize — queues server-side validation
    log('[deploy] finalizing...');
    const { jobId, versionId } = await apiPost(
        `${api}/api/creators/deploy/version-upload/finalize`,
        auth,
        { uploadKey, notes: args.notes },
    );

    // 4. poll validation
    log(`[deploy] validating (job ${jobId})...`);
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let status = 'pending';
    while (Date.now() < deadline) {
        const job = await apiGet(`${api}/api/creators/deploy/version-upload/${jobId}`, auth);
        status = job.status;
        if (status === 'done') break;
        if (status === 'failed') {
            throw new Error(`validation failed: ${job.failedReason ?? 'unknown reason'}`);
        }
        await sleep(POLL_INTERVAL_MS);
    }
    if (status !== 'done') throw new Error('timed out waiting for validation');

    // 5. confirm the version row
    const version = await apiGet(`${api}/api/creators/deploy/game-versions/${versionId}`, auth);

    if (args.json) {
        process.stdout.write(`${JSON.stringify(version)}\n`);
    } else {
        log(`[deploy] done — version ${versionId} (${version.status})`);
        log("[deploy] set it live from the game's Versions panel.");
    }
}

async function apiPost(url, headers, body) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    });
    return handle(res, url);
}

async function apiGet(url, headers) {
    return handle(await fetch(url, { headers }), url);
}

async function handle(res, url) {
    if (res.status === 401) {
        throw new Error('unauthorized — check BONGLE_DEPLOY_TOKEN');
    }
    if (!res.ok) {
        let detail = '';
        try {
            const body = await res.json();
            if (body?.error) detail = ` (${body.error})`;
        } catch {
            // non-json error body; ignore
        }
        throw new Error(`${url} → HTTP ${res.status}${detail}`);
    }
    return res.json();
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
