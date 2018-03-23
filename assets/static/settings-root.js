//@ts-ignore
var app = angular.module('settings', []);
app.config(function ($locationProvider) {
    $locationProvider.html5Mode(false).hashPrefix('*');
});
app.run(function ($templateCache) {
    var templates = {
        string: "<input type=\"text\"      title=\"{{item.name}}\" name=\"{{item.name}}\" ng-disabled=\"readonly\" ng-model=\"outputs[item.name]\"/> <span ng-bind-html=\"description\"></span>",
        number: "<input type=\"number\"    title=\"{{item.name}}\" name=\"{{item.name}}\" ng-disabled=\"readonly\" ng-model=\"outputs[item.name]\"/> <span ng-bind-html=\"description\"></span>",
        boolean: "<input type=\"checkbox\" title=\"{{item.name}}\" name=\"{{item.name}}\" ng-disabled=\"readonly\" ng-model=\"outputs[item.name]\"/> <span ng-bind-html=\"description\"></span>",
        ifenabled: "\n<div ng-controller=\"IfEnabledCtrl\">\n\t<input type=\"checkbox\" title=\"{{item.name}} name=\"isenabled_{{item.name}}\" ng-disabled=\"readonly\" ng-model=\"outputs['isenabled_' + item.name]\"/> Enable {{item.name}}\n\t<div ng-include=\"'template-' + item.valueType\" ng-disabled=\"!outputs['isenabled_' + item.name]\"></div>\n</div>\n",
        "enum": "\n\t<select name=\"{{item.name}}\" value=\"\" ng-disabled=\"readonly\" title=\"{{item.name}}\" \n\t\tng-model=\"outputs[item.name]\" \n\t\tng-options=\"k for k in item.enumOpts\">\n\t</select>  <span ng-bind-html=\"description\"></span>\n",
        hashmapenum: "\n<label><span ng-bind-html=\"description._\"></span></label>\n<div ng-repeat=\"(i, key) in item.enumKeys track by $index\" ng-controller=\"HashmapEnumItemCtrl\">\n\t<div>{{key}}</div>\n\t<div ng-include=\"'template-' + item.fieldType\"></div>\n</div>\n",
        subpage: "<a href=\"{{item.name}}\">Please access this setting at the {{item.name}} subpage.</a>",
        "function": "\n<ng-include src=\"'template-function' + item.name\"></ng-include>\n\t\t",
        functiontypes: "Coming soon",
        settingsPage: "\n<fieldset ng-repeat=\"(i, item) in data\" ng-controller=\"SettingsPageItemCtrl\">\n<legend>{{item.name}}</legend>\n<div ng-include=\"'template-' + item.fieldType\"></div>\n</fieldset>\n\t\t"
    };
    for (var i in templates) {
        $templateCache.put("template-" + i, templates[i]);
    }
});
app.controller("HashmapEnumItemCtrl", function ($scope, $sce) {
    var parentItem = $scope.item;
    if (parentItem.fieldType !== "hashmapenum")
        return;
    $scope.item = {
        fieldType: parentItem.enumType,
        name: $scope.key,
        level: parentItem.level
    };
    if (typeof $scope.outputs[parentItem.name] !== "object")
        $scope.outputs[parentItem.name] = {};
    $scope.outputs = $scope.outputs[parentItem.name];
    $scope.description = $scope.description[$scope.key];
    if (typeof $scope.description === "string") {
        $scope.description = $sce.trustAsHtml($scope.description);
    }
});
app.controller("IfEnabledCtrl", function ($scope) {
    $scope.outputs["isenabled_" + $scope.item.name] = ($scope.outputs[$scope.item.name] !== false);
    // $scope.$watch(`outputs[${$scope.item.name}]`, (item, old) => {
    // 	$scope.outputs["isenabled_" + $scope.item.name] = item !== false;
    // })
});
app.controller("SettingsPageItemCtrl", function ($scope, $sce) {
    $scope.description = $scope.descriptions[$scope.item.name];
    if (typeof $scope.description === "string") {
        $scope.description = $sce.trustAsHtml($scope.description);
    }
    else if (typeof $scope.description === "object") {
        if ($scope.description._)
            $scope.description._ = $sce.trustAsHtml($scope.description._);
    }
    $scope.readonly = $scope.item.level > $scope.level;
});
app.controller("SettingsPageCtrl", function ($scope, $http) {
    var timeout;
    var saveWait = 1000;
    var oldSettings;
    function saveSettings() {
        var set = {};
        $scope.data.forEach(function (item) {
            var key = item.name, newval;
            if (item.fieldType === "ifenabled") {
                newval = JSON.stringify($scope.outputs["isenabled_" + key] ? $scope.outputs[key] : false);
            }
            else {
                newval = JSON.stringify($scope.outputs[key]);
            }
            console.log(newval, oldSettings[key]);
            if (oldSettings[key] !== newval) {
                if (item.level <= $scope.level)
                    set[key] = JSON.parse(newval);
                oldSettings[key] = newval;
            }
        });
        $http.put("?action=update", JSON.stringify(set));
    }
    $http.get('?action=getdata').then(function (res) {
        var _a = res.data, level = _a.level, data = _a.data, descriptions = _a.descriptions, settings = _a.settings;
        var timeout;
        $scope.$watch(function (s) { return JSON.stringify(s.outputs); }, function (item, old) {
            if (!old || item === old)
                return;
            if (timeout)
                clearTimeout(timeout);
            timeout = setTimeout(saveSettings, saveWait);
        });
        $scope.data = data;
        $scope.descriptions = descriptions;
        $scope.outputs = settings;
        $scope.level = level;
        oldSettings = {};
        data.forEach(function (item) {
            oldSettings[item.name] = JSON.stringify(settings[item.name]);
        });
        $scope.$broadcast('refresh');
    });
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
