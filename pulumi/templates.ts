
import * as fs from 'fs';

export const serverTemplate = fs.readFileSync("../server-init.sh").toString();
export const agentTemplate = fs.readFileSync("../agent-init.sh").toString();
