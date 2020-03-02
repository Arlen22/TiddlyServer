type primitive = "string" | "number" | "boolean";
type SettingsPageItem = {
  level: 0 | 1 | 2;
  name: string;
  // valueType: string,
  // valueOptions?: any[]
};
type ValueType_function = {
  fieldType: "function";
  // validate: (level: number, upd: ServerConfig, current: ServerConfig) => { valid: boolean, value: any, changed: boolean }
} & SettingsPageItem;
type ValueType_primitive = {
  fieldType: primitive;
} & SettingsPageItem;
type ValueType_enum = {
  fieldType: "enum";
  enumType: primitive;
  enumOpts: any[];
  // valueOptions: ["number" | "string", (number | string)[]]
} & SettingsPageItem;
type ValueType_hashmapenum = {
  fieldType: "hashmapenum";
  enumType: primitive;
  enumKeys: string[];
} & SettingsPageItem;
type ValueType_subpage = {
  fieldType: "subpage";
  // handler: (state: StateObject) => void;
} & SettingsPageItem;
type ValueType_ifenabled = {
  fieldType: "ifenabled";
  valueType: primitive;
} & SettingsPageItem;
type SettingsPageItemTypes =
  | ValueType_function
  | ValueType_enum
  | ValueType_hashmapenum
  | ValueType_primitive
  | ValueType_subpage
  | ValueType_ifenabled;

interface RootScope extends angular.IScope {}

interface GlobalScope extends RootScope {}

//@ts-ignore
let app1 = angular.module("settings", []);
app1.config(function($locationProvider) {
  $locationProvider.html5Mode(false).hashPrefix("*");
});
app1.run(function($templateCache) {
  var templates = {
    string: `<input type="text"      title="{{item.name}}" name="{{item.name}}" ng-disabled="readonly" ng-model="outputs[item.name]"/> <span ng-bind-html="description"></span>`,
    number: `<input type="number"    title="{{item.name}}" name="{{item.name}}" ng-disabled="readonly" ng-model="outputs[item.name]"/> <span ng-bind-html="description"></span>`,
    boolean: `<input type="checkbox" title="{{item.name}}" name="{{item.name}}" ng-disabled="readonly" ng-model="outputs[item.name]"/> <span ng-bind-html="description"></span>`,
    ifenabled: `
<div ng-controller="IfEnabledCtrl">
	<input type="checkbox" title="{{item.name}} name="isenabled_{{item.name}}" ng-disabled="readonly" ng-model="outputs['isenabled_' + item.name]"/> Enable {{item.name}}
	<div ng-include="'template-' + item.valueType" ng-disabled="!outputs['isenabled_' + item.name]"></div>
</div>
`,
    enum: `
	<select name="{{item.name}}" value="" ng-disabled="readonly" title="{{item.name}}" 
		ng-model="outputs[item.name]" 
		ng-options="k for k in item.enumOpts">
	</select>  <span ng-bind-html="description"></span>
`,
    hashmapenum: `
<label><span ng-bind-html="description._"></span></label>
<div ng-repeat="(i, key) in item.enumKeys track by $index" ng-controller="HashmapEnumItemCtrl">
	<div>{{key}}</div>
	<div ng-include="'template-' + item.fieldType"></div>
</div>
`,
    subpage: `<a href="{{item.name}}">Please access this setting at the {{item.name}} subpage.</a>`,
    function: `
<ng-include src="'template-function' + item.name"></ng-include>
		`,
    functiontypes: `Coming soon`,
    settingsPage: `
<fieldset ng-repeat="(i, item) in data" ng-controller="SettingsPageItemCtrl">
<legend>{{item.name}}</legend>
<div ng-include="'template-' + item.fieldType"></div>
</fieldset>
		`
  };

  for (var i in templates) {
    $templateCache.put("template-" + i, templates[i]);
  }
});
interface HashmapEnumItemCtrlScope extends SettingsPageItemCtrlScope {
  key: string;
}
app1.controller("HashmapEnumItemCtrl", function(
  $scope: HashmapEnumItemCtrlScope,
  $sce: angular.ISCEService
) {
  let parentItem: SettingsPageItemTypes = $scope.item;
  if (parentItem.fieldType !== "hashmapenum") return;
  $scope.item = {
    fieldType: parentItem.enumType,
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
app1.controller("IfEnabledCtrl", function($scope: SettingsPageItemCtrlScope) {
  $scope.outputs["isenabled_" + $scope.item.name] =
    $scope.outputs[$scope.item.name] !== false;
  // $scope.$watch(`outputs[${$scope.item.name}]`, (item, old) => {
  // 	$scope.outputs["isenabled_" + $scope.item.name] = item !== false;
  // })
});
interface SettingsPageItemCtrlScope extends SettingsPageCtrlScope {
  item: SettingsPageItemTypes;
  description: string | Hashmap<any>;
  readonly: boolean;
}
app1.controller("SettingsPageItemCtrl", function(
  $scope: SettingsPageItemCtrlScope,
  $sce: angular.ISCEService
) {
  $scope.description = $scope.descriptions[$scope.item.name];
  if (typeof $scope.description === "string") {
    $scope.description = $sce.trustAsHtml($scope.description);
  } else if (typeof $scope.description === "object") {
    if ($scope.description._)
      $scope.description._ = $sce.trustAsHtml($scope.description._);
  }
  $scope.readonly = $scope.item.level > $scope.level;
});
interface SettingsPageCtrlScope extends RootScope {
  data: SettingsPageItemTypes[];
  descriptions: Hashmap<string | Hashmap<any>>;
  outputs: Hashmap<any>;
  level: number;
}
app1.controller("SettingsPageCtrl", function(
  $scope: SettingsPageCtrlScope,
  $http: angular.IHttpService
) {
  let timeout: number;
  let saveWait = 1000;
  let oldSettings: Hashmap<string>;
  function saveKey(set: any, key: string, val: any, allowed: boolean) {
    let newval = JSON.stringify(val);
    console.log(newval, oldSettings[key]);
    if (oldSettings[key] !== newval) {
      if (allowed) set[key] = JSON.parse(newval);
      oldSettings[key] = newval;
    }
  }
  function saveSettings() {
    let set = {};

    $scope.data.forEach(item => {
      let key = item.name,
        allowed = item.level <= $scope.level;
      if (item.fieldType === "ifenabled") {
        saveKey(
          set,
          key,
          $scope.outputs["isenabled_" + key] && $scope.outputs[key],
          allowed
        );
      } else {
        saveKey(set, key, $scope.outputs[key], allowed);
      }
    });
    $http.put("?action=update", JSON.stringify(set));
  }

  $http.get("?action=getdata").then(res => {
    let { level, data, descriptions, settings } = res.data as any;
    let timeout;

    // @ts-ignore
    $scope.$watch(
      // @ts-ignore
      (s: SettingsPageCtrlScope) => JSON.stringify(s.outputs),
      (item, old) => {
        if (!old || item === old) return;
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(saveSettings, saveWait);
      }
    );

    $scope.data = data;
    $scope.descriptions = descriptions;
    $scope.outputs = settings;
    $scope.level = level;
    oldSettings = {};
    data.forEach(item => {
      oldSettings[item.name] = JSON.stringify(settings[item.name]);
    });
    $scope.$broadcast("refresh");
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
