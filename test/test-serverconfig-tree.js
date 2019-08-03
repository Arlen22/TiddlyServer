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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdC1zZXJ2ZXJjb25maWctdHJlZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInRlc3Qtc2VydmVyY29uZmlnLXRyZWUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSx3REFBcUU7QUFDckUsK0JBQTRCO0FBQzVCLG1DQUFnRDtBQUVoRCxNQUFNLFdBQVcsR0FBRyxXQUFJLENBQUMsU0FBUyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0FBR2hELFNBQWdCLDJCQUEyQjtJQUN6QyxPQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUM7UUFDakIsT0FBTyxDQUFDLE9BQU8sQ0FBQyw2QkFBYSxDQUFDLFdBQVcsRUFBRTtZQUN6QyxRQUFRLEVBQUUsT0FBTztZQUNqQixTQUFTLEVBQUU7Z0JBQ1QsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLEdBQUcsRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRTtnQkFDekQsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLEdBQUcsRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRTtnQkFDekQsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLEdBQUcsRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRTtnQkFDekQsRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRTtnQkFDcEQsRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLFdBQVcsRUFBRSxHQUFHLEVBQUU7YUFDeEM7U0FDcUIsRUFBRSxPQUFPLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDbEQsWUFBWTtZQUNaLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUM7WUFDdkMsWUFBWTtZQUNaLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUM7WUFDckMsWUFBWTtZQUNaLElBQUksUUFBUSxHQUEyQztnQkFDckQsUUFBUSxFQUFFLE9BQU87Z0JBQ2pCLFFBQVEsRUFBRSxDQUFDO2dCQUNYLFNBQVMsRUFBRSxDQUFDO2dCQUNaLEdBQUcsRUFBRSxPQUFPO2FBRWIsQ0FBQztZQUNGLHdCQUFlLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQ2xDLENBQUMsQ0FBQztRQUVGLE9BQU8sQ0FBQyxPQUFPLENBQUMsNkJBQWEsQ0FBQyxXQUFXLEVBQUU7WUFDekMsUUFBUSxFQUFFLE9BQU87WUFDakIsd0JBQXdCO1lBQ3hCLFNBQVMsRUFBRTtnQkFDVCxrQkFBa0I7Z0JBQ2xCLFdBQVcsRUFBRSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRTtnQkFDcEQsV0FBVyxFQUFFLFNBQVM7Z0JBQ3RCLFdBQVcsRUFBRSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRTthQUNyRDtZQUNELFVBQVUsRUFBRTtnQkFDVixFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLEdBQUcsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFO2dCQUNwRCxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLEdBQUcsRUFBRTthQUN4QztTQUNxQixFQUFFLE9BQU8sRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUNsRCxZQUFZO1lBQ1osSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQztZQUN2QyxZQUFZO1lBQ1osSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQztZQUNyQyxZQUFZO1lBQ1osSUFBSSxRQUFRLEdBQTJDO2dCQUNyRCxRQUFRLEVBQUUsT0FBTztnQkFDakIsUUFBUSxFQUFFLENBQUM7Z0JBQ1gsU0FBUyxFQUFFLENBQUM7Z0JBQ1osR0FBRyxFQUFFLE9BQU87YUFFYixDQUFDO1lBQ0Ysd0JBQWUsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDbEMsQ0FBQyxDQUFDO0tBQ0gsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUN4QixDQUFDO0FBeERELGtFQXdEQyJ9