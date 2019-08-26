## Features and ideas to consider

* Ability to change configuration from inside the interface. 
* Remove every need to reboot except for absolute crashes.
* An app launcher for Mac, a 'better' launcher for Windows (icons etc.)
* Pack with nexe as a single executable (still needs some research).
* Create folders, upload files, insert predefined empties, and create server editions with full configuration.
* Add a default `settings.json` to the repo that works so that it can be launched without needing to create it first.
* Add authentication. 
* Add WebSockets that any file can make use of to build a chatroom or otherwise connect pages. Each file manages its own chatrooms or chatrooms can be declared in settings. A chatroom can be restricted to only allow certain URLs (although this can be circumverted by an attacker) or password protected. We could do private key encryption too if we wanted to. Or use a straight AES-256 end-to-end encryption with a preshared key, but the key could not be distributed by the server or it would not be secure.
** http://socketcluster.io
** https://github.com/sockjs/sockjs-node
** npm ws
* Add an admin page to manage settings, engines, and files, and add new files and data folders.
* Allow individual settings for tree mount paths such as credentials and backups.
