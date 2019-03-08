# `settings.json`

TiddlyServer 2.1 uses a completely different `settings.json` format. The new format is detected by the presence of a `"$schema"` property in the JSON file which allows text editors to enable intellisense for the JSON file. 

The full interface in all its confusion and glory is defined in [server-config.ts](src/server-types.ts). The JSON schema is generated from `ServerConfigSchema`. 
