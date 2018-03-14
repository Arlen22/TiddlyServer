angular.module('settings', []).config(function ($locationProvider) {
    $locationProvider.html5Mode(false).hashPrefix('*');
}).run(function ($templateCache) {
    var templates = {
        string: `<input type="text"      name="{{item.name}}" ng-model="outputs[item.name]"/> <span ng-bind-html="description"></span>`,
        number: `<input type="number"    name="{{item.name}}" ng-model="outputs[item.name]"/> <span ng-bind-html="description"></span>`,
        boolean: `<input type="checkbox" name="{{item.name}}" ng-model="outputs[item.name]"/> <span ng-bind-html="description"></span>`,
        enum: `
	<select name="{{item.name}}" value="" ng-disabled="readonly"} 
		ng-model="outputs[item.name]" 
		ng-options="k for k in item.valueOptions[1]">
	</select>  <span ng-bind-html="description"></span>
`,
        hashmapenum: `
<fieldset>
	<legend></legend>
	<div ng-repeat="(i, key) in item.valueOptions[1] track by $index" 
		ng-controller="HashmapEnumItemCtrl" 
		ng-include="'template-' + item.valueType"></div>
</fieldset>`,
        subpage: `Please go to <a href="{{item.name}}">{{item.name}}</a> for details on changing this setting`,
        function: `
<ng-include src="'template-function' + item.name"></ng-include>
		`,
        functiontypes: `Coming soon`,
        settingsPage: `
<fieldset ng-repeat="(i, item) in data" ng-controller="SettingsPageItemCtrl">
<legend>{{item.name}}</legend>
<div ng-include="'template-' + item.valueType"></div>
</fieldset>
		`
    };
    for (var i in templates) {
        $templateCache.put("template-" + i, templates[i]);
    }
}).controller("HashmapEnumItemCtrl", function ($scope, $sce) {
    let parentItem = $scope.item;
    if (parentItem.valueType !== "hashmapenum")
        return;
    $scope.item = {
        valueType: parentItem.valueOptions[0][0],
        name: $scope.key,
        type: parentItem.type
    };
    if (typeof $scope.outputs[parentItem.name] !== "object")
        $scope.outputs[parentItem.name] = {};
    $scope.outputs = $scope.outputs[parentItem.name];
    $scope.description = $scope.description[$scope.key];
    if (typeof $scope.description === "string") {
        $scope.description = $sce.trustAsHtml($scope.description);
    }
}).controller("SettingsPageItemCtrl", function ($scope, $sce) {
    $scope.description = $scope.description[$scope.item.name];
    if (typeof $scope.description === "string") {
        $scope.description = $sce.trustAsHtml($scope.description);
    }
}).controller("SettingsPageCtrl", function ($scope) {
    $scope.outputs = {
        "tree": {
            "ArlenNotes": "C:\\Users\\Arlen\\Dropbox\\ArlenNotes",
            "ArlenStorage": "C:\\ArlenNotesStorage",
            "ArlenJournal": "G:/",
            "dropbox": "C:\\Users\\Arlen\\Dropbox\\TiddlyWiki",
            "projects": {
                "tw5-angular": "..\\tw5-angular",
                "monacotw5": "C:\\ArlenStuff\\TiddlyWiki-Monaco-Editor",
                "wavenet": "C:\\Users\\Arlen\\Dropbox\\Projects\\WaveNet",
                "tiddlywiki": "C:\\ArlenStuff\\TiddlyWiki5-5.1.14",
                "fol": "C:\\Users\\Arlen\\Dropbox\\FOL\\tw5-notes",
                "lambda-client": "C:\\ArlenProjects\\aws-tiddlyweb\\lambda-client"
            },
            "wef-reports": "c:\\ArlenProjects\\wef-reports",
            "tesol": "C:\\Users\\Arlen\\Dropbox\\TESOL",
            "tw5-dropbox": "C:\\ArlenStuff\\tw5-dropbox",
            "twcloud-dropbox": "C:\\ArlenStuff\\twcloud\\dropbox",
            "genyoutube": "C:\\Users\\Arlen\\Music\\GenYoutube",
            "sock.pac": "C:\\sock.pac"
        },
        "types": {
            "htmlfile": [
                "htm",
                "html"
            ]
        },
        "port": 80,
        "host": "0.0.0.0",
        "backupDirectory": "",
        "etag": "",
        "etagWindow": 3,
        "useTW5path": false,
        "allowNetwork": {
            "settings": true
        }
    };
    $scope.data = [
        { type: 2, name: "tree", valueType: "subpage", },
        { type: 0, name: "types", valueType: "function", },
        { type: 1, name: "host", valueType: "string" },
        { type: 1, name: "port", valueType: "number" },
        { type: 1, name: "username", valueType: "string" },
        { type: 1, name: "password", valueType: "string" },
        { type: 0, name: "backupDirectory", valueType: "string" },
        { type: 0, name: "etag", valueType: "enum", valueOptions: ["string", ["", "disabled", "required"]] },
        { type: 0, name: "etagWindow", valueType: "number" },
        { type: 1, name: "useTW5path", valueType: "boolean" },
        { type: 0, name: "debugLevel", valueType: "enum", valueOptions: ["number", [4, 3, 2, 1, 0, -1, -2, -3, -4]] },
        {
            type: 1,
            name: "allowNetwork",
            valueType: "hashmapenum",
            valueOptions: [
                ["boolean"],
                ["mkdir", "upload", "settings", "WARNING_all_settings_WARNING"]
            ]
        },
    ];
    $scope.description = {
        tree: "The mount structure of the server",
        types: "Specifies which extensions get used for each icon",
        host: "The IP address to listen on for requests. 0.0.0.0 listens on all IP addresses. "
            + "127.0.0.1 only listens on localhost. <br/>"
            + "TECHNICAL: 127.0.0.1 is always bound to even when another IP is specified.",
        port: "The port number to listen on.",
        username: "The basic auth username to use. Also forwarded to data folders for signing edits.",
        password: "The basic auth password to use.",
        etag: "disabled (Don't check etags), "
            + "required (Require etags to be used), "
            + "&lt;not specified&gt; (only check etag if sent by the client)",
        etagWindow: "If the etag gets checked, allow a file to be saved if the etag is not stale by more than this many seconds.",
        backupDirectory: "The directory to save backup files in from single file wikis. Data folders are not backed up.",
        debugLevel: "Print out messages with this debug level or higher. <a href=\"https://github.com/Arlen22/TiddlyServer#debuglevel\">See the readme for more detail.</a>",
        useTW5path: "Mount data folders as the directory index (like NodeJS: /mydatafolder/) instead of as a file (like single-file wikis: /mydatafolder). It is recommended to leave this off unless you need it.",
        allowNetwork: {
            mkdir: "Allow network users to create directories and datafolders.",
            upload: "Allow network users to upload files.",
            settings: "Allow network users to change non-critical settings.",
            WARNING_all_settings_WARNING: "Allow network users to change critical settings: "
                + `<code>${$scope.data.filter(e => e.type > 0).map(e => e.name).join(', ')}</code>`
        },
        maxAge: "",
        tsa: "",
        _disableLocalHost: "",
        __dirname: "READONLY: Directory of currently loaded settings file",
        __assetsDir: ""
    };
});
// angular.module("settings", [
// ]).controller("globalCtrl", function ($scope: GlobalScope, $http: angular.IHttpService) {
// 	$http.get("?")
// })
// 	const old = {
// 		"template-children":/* just some green */ `
// <div ng-repeat="(i, item) in item.children track by $index" 
// 	ng-class="[item.classes, 'type-' + item.type, 'output-' + item.output].join(' ')" 
// 	ng-include="'template-' + item.type"></div>`,
// 		"template-repeater":/* just some green */ `
// <div ng-repeat="(j, outputs) in outputs[item.output]"  
// 	ng-class="item.repeaterClasses" 
// 	ng-include="'template-children'"></div>`,
// 		"template-hashmap-item":/* just some green */ `
// <li ng-repeat="(j, outputs) in outputs">
// 	<code style="min-width: 200px;">{{j}}</code>
// 	<ul ng-if="typeof(outputs) == 'object'" ng-include="'template-hashmap-item'"></ul>
// 	<code ng-if="typeof(outputs) == 'string'">{{outputs}}</code>
// </li>`,
// 		'template-hashmap':/* just some green */ `
// <ul ng-include="'template-hashmap-item'" ></ul>
// <input type="text" ng-model="outputs[item.output]['$add']" />
// <button ng-click="outputs[item.output][outputs[item.output]['$add']] = ''">+ Item</button>
// <button ng-click="outputs[item.output][outputs[item.output]['$add']] = {}">+ Hash</button>
// `,
// 		'template-text-row':/* just some green */ `
// <span style="display:inline-block; width:200px">{{item.name}}</span>
// <input type="text" ng-model="outputs[item.output]"/>
// `
// 	} 
