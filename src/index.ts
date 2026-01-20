#!/usr/bin/env node

import { run } from "./cli.js";

// Main Entry
run().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
