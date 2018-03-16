
type Hashmap<T> = { [K: string]: T };
type SettingsPageItem = {
	level: 0 | 1 | 2,
	name: string,
	// valueType: string,
	// valueOptions?: any[]
};
type ValueType_function = {
	valueType: "function",
	// valueOptions: [(defValue: any, keys: string[], readOnly: boolean, description: any) => string]
} & SettingsPageItem;
type ValueType_primitive = {
	valueType: "string" | "number" | "boolean"
} & SettingsPageItem;
type ValueType_enum = {
	valueType: "enum",
	valueOptions: ["number" | "string", (number | string)[]]
} & SettingsPageItem;
type ValueType_hashmapenum = {
	valueType: "hashmapenum",
	valueOptions: [("string" | "number" | "boolean")[], string[]]
} & SettingsPageItem;
type ValueType_subpage = {
	valueType: "subpage",
	valueOptions: {}
} & SettingsPageItem;
type SettingsPageItemTypes = ValueType_function | ValueType_enum | ValueType_hashmapenum | ValueType_primitive | ValueType_subpage;

interface RootScope extends angular.IScope {

}

interface GlobalScope extends RootScope {

}



//@ts-ignore
let app = angular.module('settings', [

]);
app.config(function ($locationProvider) {
	$locationProvider.html5Mode(false).hashPrefix('*');
});
app.run(function ($templateCache) {
	var templates = {
		string: `<input type="text"      title="{{item.name}}" name="{{item.name}}" ng-disabled="readonly" ng-model="outputs[item.name]"/> <span ng-bind-html="description"></span>`,
		number: `<input type="number"    title="{{item.name}}" name="{{item.name}}" ng-disabled="readonly" ng-model="outputs[item.name]"/> <span ng-bind-html="description"></span>`,
		boolean: `<input type="checkbox" title="{{item.name}}" name="{{item.name}}" ng-disabled="readonly" ng-model="outputs[item.name]"/> <span ng-bind-html="description"></span>`,
		enum: `
	<select name="{{item.name}}" value="" ng-disabled="readonly" title="{{item.name}}" 
		ng-model="outputs[item.name]" 
		ng-options="k for k in item.valueOptions[1]">
	</select>  <span ng-bind-html="description"></span>
`,
		hashmapenum: `
<div ng-repeat="(i, key) in item.valueOptions[1] track by $index" 
	ng-controller="HashmapEnumItemCtrl" 
	ng-include="'template-' + item.valueType"></div>
`,
		subpage: `<a href="{{item.name}}">Please access this setting at the {{item.name}} subpage.</a>`,
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
	}

	for (var i in templates) {
		$templateCache.put("template-" + i, templates[i]);
	}
});
interface HashmapEnumItemCtrlScope extends SettingsPageItemCtrlScope {
	key: string;
}
app.controller("HashmapEnumItemCtrl", function ($scope: HashmapEnumItemCtrlScope, $sce: angular.ISCEService) {
	let parentItem: SettingsPageItemTypes = $scope.item;
	if (parentItem.valueType !== "hashmapenum") return;
	$scope.item = {
		valueType: parentItem.valueOptions[0][0],
		name: $scope.key,
		level: parentItem.level
	} as SettingsPageItemTypes;
	if (typeof $scope.outputs[parentItem.name] !== "object")
		$scope.outputs[parentItem.name] = {};
	$scope.outputs = $scope.outputs[parentItem.name];
	$scope.description = $scope.description[$scope.key];
	if (typeof $scope.description === "string") {
		$scope.description = $sce.trustAsHtml($scope.description);
	}
});
interface SettingsPageItemCtrlScope extends SettingsPageCtrlScope {
	item: SettingsPageItemTypes;
	description: string | Hashmap<any>;
	readonly: boolean;
}
app.controller("SettingsPageItemCtrl", function ($scope: SettingsPageItemCtrlScope, $sce: angular.ISCEService) {

	$scope.description = $scope.descriptions[$scope.item.name];
	if (typeof $scope.description === "string") {
		$scope.description = $sce.trustAsHtml($scope.description);
	}
	$scope.readonly = $scope.item.level > $scope.level;

});
interface SettingsPageCtrlScope extends RootScope {
	data: SettingsPageItemTypes[];
	descriptions: Hashmap<string | Hashmap<any>>;
	outputs: Hashmap<any>;
	level: number;
}
app.controller("SettingsPageCtrl", function ($scope: SettingsPageCtrlScope, $http: angular.IHttpService) {
	$http.get('?action=getdata').then(res => {
		let { level, data, descriptions, settings } = res.data as any;
		$scope.data = data;
		$scope.descriptions = descriptions;
		$scope.outputs = settings;
		$scope.level = level;
		$scope.$broadcast('refresh');
	});
})




