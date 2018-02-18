import { StateObject, obs_readFile, tryParseJSON,  } from './server-types';
import send = require('../lib/send-lib');

export function tsloader(state: StateObject, mount: string, folder: string) {
	return obs_readFile()(folder, 'utf8').map(([err, data]) => {
		const json = tryParseJSON(data);
	})
}