---
id: serverjs
title: server.js
---

The server.js file is the equivelant of TiddlyWiki's tiddlywiki.js file. Except that it does more work. The file loads the settings file and parses it, then loads the preflighter, and passes them all to the `initServer` function. It also has an uncaughtException handler to log errors before the program crashes completely. 

This means that TiddlyServer could also be implemented as part of a larger system, allowing the ServerConfig to be generated at startup and updated at any time during the server's lifetime. Most settings are accessed for each request, or updated on the `settings` event, but the preflighter function, bind address info, and server listeners will not be changed until the server is restarted, which should be doable with a `serverClose` event and then a new call to `initServer`.

The preflighter is still going to be your weapon of choice, allowing you to syphon off requests, select a different host from the tree, change the auth account and username applied to the request, and whatever other abilities the request and response objects give you. 

The command line arguments are:

- `--dry-run`: Do everything except call server.listen(). Useful for checking settings. 
- `--stay-on-error`: Start a setInterval loop to keep the process from exiting.
