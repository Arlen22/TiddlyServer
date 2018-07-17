### server

Sets up the server listener, settings object, and the static routes. The server.js file in the root directory loads this file and calls the initServer function with the appropriate arguments. 

### tiddlyserver

Handles requests and determines what kind of folder or file is being requested. Handles serving and saving all static files and hands off TW Folder requests to datafolder.

### datafolder

Loads and handles all TiddlyWiki related requests including serving plugins and loading data folders.