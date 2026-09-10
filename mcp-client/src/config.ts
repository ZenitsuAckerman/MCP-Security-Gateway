import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const config = {
  // Path to the calculator server (built JS file)
  calculatorServerPath: resolve(__dirname, '../../calculator-server/dist/index.js'),
  emailServerPath: resolve(__dirname, '../../email-server/dist/index.js')
};
