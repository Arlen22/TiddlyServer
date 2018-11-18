"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_types_1 = require("./server-types");
let settings = {
    tree: {
        "dbx-media": "C:\\Users\\Arlen\\Dropbox\\Media\\Embassy Institute",
        "dbx-tw": "C:\\Users\\Arlen\\Dropbox\\TiddlyWiki",
        "arlen22.github.io": "../arlen22.github.io",
        "projects": {
            "tw5-angular": "..\\tw5-angular",
            "tw5-dropbox": "..\\tw5-dropbox",
            "monacotw5": "C:\\ArlenStuff\\TiddlyWiki-Monaco-Editor",
            "fol": "C:\\Users\\Arlen\\Dropbox\\FOL\\tw5-notes",
            "lambda-client": "C:\\ArlenProjects\\aws-tiddlyweb\\lambda-client",
            "twcloud-dropbox": "..\\twcloud\\dropbox",
            "twcloud-datafolder": "..\\twcloud\\datafolder",
            "tiddlypouch": "..\\tiddlypouch-develop",
            "pouchdb-dropbox": "..\\pouchdb-dropbox"
        }
    }
};
server_types_1.normalizeSettings(settings, __dirname + "/test.json");
console.log(JSON.stringify(settings, null, 2));
console.log(server_types_1.resolvePath(["dbx-media"], settings.tree));
console.log(server_types_1.resolvePath(["dbx-media", "Hogan-NobleMen-01-SD.mp4"], settings.tree));
console.log(server_types_1.resolvePath(["dbx-media", "THISFILEDOESNOTEXIST"], settings.tree));
console.log(server_types_1.resolvePath(["projects", "fol"], settings.tree));
console.log(server_types_1.resolvePath(["projects", "fol", "test file"], settings.tree));
