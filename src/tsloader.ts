import { StateObject, obs_readFile, tryParseJSON,  } from './server-types';
import send = require('../lib/send-lib');
import * as path from 'path';

export function tsloader(state: StateObject, mount: string, folder: string) {
	return obs_readFile()(path.join(folder, 'tiddlywiki.info'), 'utf8').map(([err, data]) => {
		const json = tryParseJSON(data);
		//load the core and specified plugins
		//load included wikis, specifying whether they are readonly or not
		//investigate how the file system adaptor handles this
		//loading the skinny tiddler list will read all tiddlers
		//tiddler requests will only touch the specified tiddler,
		//but how do we know what the filename is? Isn't there a way we 
		//can name them in a different way? Maybe there is a set pattern
		//that we can base it on. I have no idea.
	});
}