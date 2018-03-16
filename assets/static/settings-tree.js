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
        "enum": "\n\t<select name=\"{{item.name}}\" value=\"\" ng-disabled=\"readonly\" title=\"{{item.name}}\" \n\t\tng-model=\"outputs[item.name]\" \n\t\tng-options=\"k for k in item.valueOptions[1]\">\n\t</select>  <span ng-bind-html=\"description\"></span>\n",
        hashmapenum: "\n<div ng-repeat=\"(i, key) in item.valueOptions[1] track by $index\" \n\tng-controller=\"HashmapEnumItemCtrl\" \n\tng-include=\"'template-' + item.valueType\"></div>\n",
        subpage: "<a href=\"{{item.name}}\">Please access this setting at the {{item.name}} subpage.</a>",
        "function": "\n<ng-include src=\"'template-function' + item.name\"></ng-include>\n\t\t",
        functiontypes: "Coming soon",
        settingsPage: "\n<fieldset ng-repeat=\"(i, item) in data\" ng-controller=\"SettingsPageItemCtrl\">\n<legend>{{item.name}}</legend>\n<div ng-include=\"'template-' + item.valueType\"></div>\n</fieldset>\n\t\t"
    };
    for (var i in templates) {
        $templateCache.put("template-" + i, templates[i]);
    }
});
app.controller("HashmapEnumItemCtrl", function ($scope, $sce) {
    var parentItem = $scope.item;
    if (parentItem.valueType !== "hashmapenum")
        return;
    $scope.item = {
        valueType: parentItem.valueOptions[0][0],
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
app.controller("SettingsPageItemCtrl", function ($scope, $sce) {
    $scope.description = $scope.descriptions[$scope.item.name];
    if (typeof $scope.description === "string") {
        $scope.description = $sce.trustAsHtml($scope.description);
    }
    $scope.readonly = $scope.item.level > $scope.level;
});
app.controller("SettingsPageCtrl", function ($scope, $http) {
    $http.get('?action=getdata').then(function (res) {
        var _a = res.data, level = _a.level, data = _a.data, descriptions = _a.descriptions, settings = _a.settings;
        $scope.data = data;
        $scope.descriptions = descriptions;
        $scope.outputs = settings;
        $scope.level = level;
        $scope.$broadcast('refresh');
    });
});
