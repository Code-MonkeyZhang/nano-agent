/**
 * @fileoverview Server startup entry point.
 */

import { initAllDirsAndFiles, Logger } from './util/index.js';
import { getLogsDir, getConfigPath } from './util/paths.js';
import { loadConfig } from './config/index.js';
import { startServer } from './server/index.js';

initAllDirsAndFiles();
const config = loadConfig(getConfigPath());
Logger.initialize(getLogsDir(), config.enableLogging);
const port = process.env['PORT'] ? parseInt(process.env['PORT'], 10) : 3000;
startServer(port);
