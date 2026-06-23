#!/usr/bin/env node
// bongle-cli entry point. Dependency-free; runs straight from a github
// install (`npx github:isaac-mason/bongle-cli`) with no build step.

import { deploy } from './deploy.mjs';

const USAGE = `bongle-cli — deploy bongle game bundles to the platform

Usage:
  bongle-cli deploy [options]

Options:
  --bundle <path>   bundle to upload (default: dist/bundle.zip)
  --api <url>       platform API base (default: $BONGLE_API_URL or https://api.bongle.io)
  --notes <str>     notes attached to the version
  --json            print the version row as JSON on success

Environment:
  BONGLE_DEPLOY_TOKEN   required — mint one in the game's "Deploy tokens" panel
  BONGLE_API_URL        optional — overrides the default API base
`;

const [, , cmd, ...rest] = process.argv;

if (cmd === 'deploy') {
    deploy(rest).catch((err) => {
        console.error(`bongle-cli: ${err.message}`);
        process.exit(1);
    });
} else if (cmd === '--help' || cmd === '-h' || cmd === 'help') {
    process.stdout.write(USAGE);
} else {
    console.error(`bongle-cli: unknown command ${cmd ? `'${cmd}'` : '(none)'}\n`);
    process.stderr.write(USAGE);
    process.exit(1);
}
