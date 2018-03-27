
type Hashmap<T> = { [K: string]: T };

interface RootScope extends angular.IScope {

}

interface GlobalScope extends RootScope {

}

let app = angular.module('settings', []);
app.config(function ($locationProvider) {
	$locationProvider.html5Mode(false).hashPrefix('*');
});
app.run(function ($templateCache) {
	var templates = {
		string: `<input type="text"      title="{{item.name}}" name="{{item.name}}" ng-disabled="readonly" ng-model="outputs[item.name]"/> <span ng-bind-html="description"></span>`,
		number: `<input type="number"    title="{{item.name}}" name="{{item.name}}" ng-disabled="readonly" ng-model="outputs[item.name]"/> <span ng-bind-html="description"></span>`,
		boolean: `<input type="checkbox" title="{{item.name}}" name="{{item.name}}" ng-disabled="readonly" ng-model="outputs[item.name]"/> <span ng-bind-html="description"></span>`,
		settingsPage: `<p>Coming soon...`
	}

	for (var i in templates) {
		$templateCache.put("template-" + i, templates[i]);
	}
});

interface SettingsPageCtrlScope extends RootScope {

}
app.controller("SettingsPageCtrl", function ($scope: SettingsPageCtrlScope, $http: angular.IHttpService) {

})




