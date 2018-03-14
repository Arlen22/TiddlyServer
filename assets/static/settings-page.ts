type SettingsPageItem = {
	type: 0 | 1 | 2,
	name: string,
	// valueType: string,
	// valueOptions?: any[]
};
type ValueType = {
	valueType: "function",
	// valueOptions: [(defValue: any, keys: string[], readOnly: boolean, description: any) => string]
} | {
		valueType: "string" | "number" | "boolean"
	} | {
		valueType: "enum",
		valueOptions: ["number" | "string", (number | string)[]]
	} | {
		valueType: "hashmapenum",
		valueOptions: [("string" | "number" | "boolean")[], string[]]
	}

interface RootScope extends angular.IScope {

}

interface GlobalScope extends RootScope {

}
angular.module('json-editor', [

]).config(function ($locationProvider) {
	$locationProvider.html5Mode(false).hashPrefix('*');
}).run(function ($templateCache) {
	var templates = {
		string: `<input type="text"      name="{{item.name}}" ng-model="outputs[item.name]"/>`,
		number: `<input type="number"    name="{{item.name}}" ng-model="outputs[item.name]"/>`,
		boolean: `<input type="checkbox" name="{{item.name}}" ng-model="outputs[item.name]"/>`,
		enum: `
	<select name="{{item.name}}" value="" ng-disabled="readonly"} 
		ng-model="outputs[item.name]" 
		ng-options="k for k in item.valueOptions[1]">
	</select> {{description}}
`,
		hashmapenum: `
<fieldset>
	<legend></legend>
	<div ng-repeat="(i, key) in item.valueOptions[1] track by $index" 
		ng-controller="HashmapEnumItemCtrl" 
		ng-include="'template-' + item.valueType"></div>
</fieldset>`,
		function: `
<ng-include src="'template-function' + item.name"></ng-include>
		`,
		functiontree: ``,
		settingsPage: `
<fieldset ng-repeat="(i, item) in data" ng-controller="SettingsPageItemCtrl">
<legend>{{item.name}}</legend>
<div ng-include="'template-' + item.valueType"></div>
</fieldset>
		`
	}
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
	for (var i in templates) {
		$templateCache.put(i, templates[i]);
	}
}).controller("HashmapEnumItemCtrl", function ($scope) {
	let parentItem: SettingsPageItem & ValueType = $scope.item;
	if (parentItem.valueType !== "hashmapenum") return;
	$scope.item = {
		valueType: parentItem.valueOptions[0][0],
		name: $scope.key,
		type: parentItem.type
	} as SettingsPageItem & ValueType;
	if (typeof $scope.outputs[parentItem.name] !== "object")
		$scope.outputs[parentItem.name] = {};
	$scope.outputs = $scope.outputs[parentItem.name];
	$scope.description = $scope.description[parentItem.name];
});





angular.module("settings", [

]).controller("globalCtrl", function ($scope: GlobalScope, $http: angular.IHttpService) {
	$http.get("?")
})