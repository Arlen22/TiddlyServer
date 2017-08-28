# Features and ideas for future releases

Note: This is a place for committers to keep a list of features we want to work on. If anyone (not just committers) wants to work on a feature and submit a pull request, you are welcome to.

None of these features are implemented.

- Add an upload button to the directory listing to upload any file to the current directory.
- Add a create data folder button to create new data folders with specified plugins.
- Add authentication. 
- Add WebSockets that any file can make use of to build a chatroom or otherwise connect pages. Each file manages its own chatrooms or chatrooms can be declared in settings. A chatroom can be restricted to only allow certain URLs (although this can be circumverted by an attacker) or password protected. We could do private key encryption too if we wanted to. Or use a straight AES-256 end-to-end encryption with a preshared key, but the key could not be distributed by the server or it would not be secure.
  - http://socketcluster.io
  - https://github.com/sockjs/sockjs-node
- Add an admin page to manage settings, engines, and files, and add new files and data folders.
