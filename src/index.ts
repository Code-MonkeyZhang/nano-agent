/**
 * @fileoverview Server startup entry point.
 */

import { initAllDirsAndFiles, Logger } from './util/index.js';
import { getLogsDir } from './util/paths.js';
import { startServer } from './server/index.js';

initAllDirsAndFiles();
Logger.initialize(getLogsDir(), false);
startServer(3000);
