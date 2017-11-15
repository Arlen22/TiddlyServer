### Master

* Add the option to partially or completely disable etag checking. 
* Remove the trailing slash from data folders in order to allow relative links in tiddlers imported from single file wikis to continue to work without changing the folder structure. Data folders are opaque and appear to the user to be identical to a single file TiddlyWiki, therefore the relative links should also work the same.

### 2.0.8

* TiddlyServer now correctly uses the username specified in `settings.json` for signing edits in data folders.
* Improve the error message in the console when a stale single file wiki is PUT to the server. It is also known as error 412 Edit Conflict and indicates a file edit conflict, not a tiddler edit conflict within the file. 

### 2.0.7

* A new favicon inspired by the NodeJS icon. This might not be the final icon. I posted a request for comments on the Google Group: https://groups.google.com/forum/#!topic/tiddlywiki/0Jl6EaH6rQM
* The source code installation method has changed, and no longer uses `npm install`. The readme has been updated to reflect this.
* A custom error message has been added to indicate exactly where the problem is when `settings.json` fails to parse. Usually the error is either an extra comma or bracket, so you may need to look at the previous line to the one indicated in the error message to find the actual source of the problem.
* Under the hood, the files have been modified somewhat to support compiling using nexe. This is still in the testing stage but it should be stable, so if you're interested you can download the "nexe" version for your OS. The executable is inside the `dist` folder.
* A mac app launcher script has been added, and users are welcome to test it and let me know how it works. To use it, rename the TiddlyServer folder to Contents, then place it inside another folder and name that folder `Tiddlyserver.app`. You should now be able to double-click it to launch TiddlyServer. To open the folder, right click on it and click Examine Package Contents (or something like that). This is very much experimental so all feedback is welcome.

