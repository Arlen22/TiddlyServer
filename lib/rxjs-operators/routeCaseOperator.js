"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rx_1 = require("../rx");
/**
 *
 */
class RouteCaseOperator {
    /**
     *
     * @param selector A function that returns a string specifying the route to use.
     * If there is no route for that string, the item is sent to defaultRoute instead.
     * @param routes A hashmap of routes.
     * @param defaultRoute The route used if the string returned by selector is not a
     * property of routes.
     */
    constructor(selector, routes, defaultRoute) {
        this.selector = selector;
        this.routes = routes;
        this.defaultRoute = defaultRoute;
        this.outputs = [];
        this.inputs = {};
        this.stack = new Error();
    }
    call(subs, source) {
        this.keys = Object.keys(this.routes);
        this.keys.forEach(key => {
            const input = new rx_1.Subject();
            this.inputs[key] = input;
            this.outputs.push(this.routes[key](input));
        });
        this.defInput = new rx_1.Subject();
        this.outputs.push(this.defaultRoute(this.defInput));
        source.multicast(new rx_1.Subject()).refCount().subscribe(item => {
            const select = this.selector(item);
            if (this.inputs[select])
                this.inputs[select].next(item);
            else
                this.defInput.next(item);
        });
        this.keys.forEach((e, i) => this.keys[i] = [i, e].join('-'));
        this.keys.push('default');
        var bads = this.outputs.map((e, i) => [e, this.keys[i]])
            .filter(e => typeof e[0] !== 'object' || e[0] === null);
        if (bads.length > 0)
            throw 'These routes returned undefined: ' + bads.map(e => (e[1])).join(', ');
        rx_1.Observable.from(this.outputs).mergeAll().subscribe(subs);
    }
}
exports.RouteCaseOperator = RouteCaseOperator;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGVDYXNlT3BlcmF0b3IuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJyb3V0ZUNhc2VPcGVyYXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLDhCQUFnRjtBQUVoRjs7R0FFRztBQUNIO0lBUUk7Ozs7Ozs7T0FPRztJQUNILFlBQ1ksUUFBNEIsRUFDNUIsTUFBc0UsRUFDdEUsWUFBbUQ7UUFGbkQsYUFBUSxHQUFSLFFBQVEsQ0FBb0I7UUFDNUIsV0FBTSxHQUFOLE1BQU0sQ0FBZ0U7UUFDdEUsaUJBQVksR0FBWixZQUFZLENBQXVDO1FBRTNELElBQUksQ0FBQyxPQUFPLEdBQUcsRUFBRSxDQUFDO1FBQ2xCLElBQUksQ0FBQyxNQUFNLEdBQUcsRUFBRSxDQUFDO1FBQ2pCLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxLQUFLLEVBQUUsQ0FBQztJQUM3QixDQUFDO0lBRUQsSUFBSSxDQUFDLElBQW1CLEVBQUUsTUFBdUI7UUFDN0MsSUFBSSxDQUFDLElBQUksR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNyQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHO1lBQ2pCLE1BQU0sS0FBSyxHQUFHLElBQUksWUFBTyxFQUFFLENBQUM7WUFDNUIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxLQUFLLENBQUM7WUFDekIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQy9DLENBQUMsQ0FBQyxDQUFDO1FBQ0gsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLFlBQU8sRUFBRSxDQUFDO1FBQzlCLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUE7UUFFbkQsTUFBTSxDQUFDLFNBQVMsQ0FBTSxJQUFJLFlBQU8sRUFBRSxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUk7WUFDMUQsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNuQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3hELElBQUk7Z0JBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbEMsQ0FBQyxDQUFDLENBQUE7UUFFRixJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQTtRQUM1RCxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUMxQixJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2FBQ25ELE1BQU0sQ0FBQyxDQUFDLElBQUksT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssUUFBUSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxJQUFJLENBQUMsQ0FBQztRQUU1RCxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztZQUNoQixNQUFNLG1DQUFtQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFakYsZUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzdELENBQUM7Q0FFSjtBQXJERCw4Q0FxREMifQ==