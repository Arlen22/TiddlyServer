"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_config_1 = require("../src/server-config");
const path_1 = require("path");
const assert_1 = require("assert");
const SETTINGSDIR = path_1.join(__dirname, "settings");
function normalizeTree_GroupElement_() {
    return Promise.all([
        Promise.resolve(server_config_1.normalizeTree(SETTINGSDIR, {
            $element: "group",
            $children: [
                { $element: "folder", key: "test1sub1", path: "~/test1" },
                { $element: "folder", key: "test1sub2", path: "~/test1" },
                { $element: "folder", key: "test1sub3", path: "~/test1" },
                { $element: "auth", authError: 404, authList: null },
                { $element: "index", defaultType: 404 },
            ]
        }, "test1", [])).then(test => {
            //@ts-ignore
            test.$children = test.$children.length;
            //@ts-ignore
            test.$options = test.$options.length;
            //@ts-ignore
            let expected = {
                $element: "group",
                $options: 2,
                $children: 3,
                key: "test1",
            };
            assert_1.deepStrictEqual(test, expected);
        }),
        Promise.resolve(server_config_1.normalizeTree(SETTINGSDIR, {
            $element: "group",
            // indexPath: undefined,
            $children: {
                // "$element": "",
                "test1sub1": { $element: "folder", path: "~/test1" },
                "test1sub2": "~/test2",
                "test1sub3": { $element: "folder", path: "~/test1" },
            },
            "$options": [
                { $element: "auth", authError: 404, authList: null },
                { $element: "index", defaultType: 404 }
            ]
        }, "test1", [])).then(test => {
            //@ts-ignore
            test.$children = test.$children.length;
            //@ts-ignore
            test.$options = test.$options.length;
            //@ts-ignore
            let expected = {
                $element: "group",
                $options: 2,
                $children: 3,
                key: "test1",
            };
            assert_1.deepStrictEqual(test, expected);
        })
    ]).then(() => "done");
}
exports.normalizeTree_GroupElement_ = normalizeTree_GroupElement_;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdC1zZXJ2ZXJjb25maWctdHJlZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3Rlc3QvdGVzdC1zZXJ2ZXJjb25maWctdHJlZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLHdEQUFxRTtBQUNyRSwrQkFBNEI7QUFDNUIsbUNBQWdEO0FBRWhELE1BQU0sV0FBVyxHQUFHLFdBQUksQ0FBQyxTQUFTLEVBQUUsVUFBVSxDQUFDLENBQUM7QUFJaEQsU0FBZ0IsMkJBQTJCO0lBQ3pDLE9BQU8sT0FBTyxDQUFDLEdBQUcsQ0FBQztRQUNqQixPQUFPLENBQUMsT0FBTyxDQUFDLDZCQUFhLENBQUMsV0FBVyxFQUFFO1lBQ3pDLFFBQVEsRUFBRSxPQUFPO1lBQ2pCLFNBQVMsRUFBRTtnQkFDVCxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsR0FBRyxFQUFFLFdBQVcsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFO2dCQUN6RCxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsR0FBRyxFQUFFLFdBQVcsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFO2dCQUN6RCxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsR0FBRyxFQUFFLFdBQVcsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFO2dCQUN6RCxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLEdBQUcsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFO2dCQUNwRCxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLEdBQUcsRUFBRTthQUN4QztTQUNxQixFQUFFLE9BQU8sRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUNsRCxZQUFZO1lBQ1osSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQztZQUN2QyxZQUFZO1lBQ1osSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQztZQUNyQyxZQUFZO1lBQ1osSUFBSSxRQUFRLEdBQTJDO2dCQUNyRCxRQUFRLEVBQUUsT0FBTztnQkFDakIsUUFBUSxFQUFFLENBQUM7Z0JBQ1gsU0FBUyxFQUFFLENBQUM7Z0JBQ1osR0FBRyxFQUFFLE9BQU87YUFFYixDQUFDO1lBQ0Ysd0JBQWUsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDbEMsQ0FBQyxDQUFDO1FBRUYsT0FBTyxDQUFDLE9BQU8sQ0FBQyw2QkFBYSxDQUFDLFdBQVcsRUFBRTtZQUN6QyxRQUFRLEVBQUUsT0FBTztZQUNqQix3QkFBd0I7WUFDeEIsU0FBUyxFQUFFO2dCQUNULGtCQUFrQjtnQkFDbEIsV0FBVyxFQUFFLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFO2dCQUNwRCxXQUFXLEVBQUUsU0FBUztnQkFDdEIsV0FBVyxFQUFFLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFO2FBQ3JEO1lBQ0QsVUFBVSxFQUFFO2dCQUNWLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUUsR0FBRyxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUU7Z0JBQ3BELEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxXQUFXLEVBQUUsR0FBRyxFQUFFO2FBQ3hDO1NBQ3FCLEVBQUUsT0FBTyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ2xELFlBQVk7WUFDWixJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDO1lBQ3ZDLFlBQVk7WUFDWixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDO1lBQ3JDLFlBQVk7WUFDWixJQUFJLFFBQVEsR0FBMkM7Z0JBQ3JELFFBQVEsRUFBRSxPQUFPO2dCQUNqQixRQUFRLEVBQUUsQ0FBQztnQkFDWCxTQUFTLEVBQUUsQ0FBQztnQkFDWixHQUFHLEVBQUUsT0FBTzthQUViLENBQUM7WUFDRix3QkFBZSxDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztRQUNsQyxDQUFDLENBQUM7S0FDSCxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ3hCLENBQUM7QUF4REQsa0VBd0RDIn0=