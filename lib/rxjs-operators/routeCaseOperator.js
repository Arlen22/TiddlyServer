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
