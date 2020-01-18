import { Writable } from "stream";
import { IncomingMessage, ServerResponse } from "http";

export function handler(options: {
  logFile?: string,
  stream?: Writable,
  logToConsole?: boolean,
  logColorsToFile?: boolean
}): (req: IncomingMessage, res: ServerResponse, next: (err?: any) => void) => void;