import { normalizeTree, Schema, Config } from "../src/server-config";
import { join } from "path";
import { deepStrictEqual, equal } from "assert";

const SETTINGSDIR = join(__dirname, "settings");


export function normalizeTree_GroupElement_() {
  return Promise.all([
    Promise.resolve(normalizeTree(SETTINGSDIR, {
      $element: "group",
      $children: [
        { $element: "folder", key: "test1sub1", path: "~/test1" },
        { $element: "folder", key: "test1sub2", path: "~/test1" },
        { $element: "folder", key: "test1sub3", path: "~/test1" },
        { $element: "auth", authError: 404, authList: null },
        { $element: "index", defaultType: 404 },
      ]
    } as Schema.GroupElement, "test1", [])).then(test => {
      //@ts-ignore
      test.$children = test.$children.length;
      //@ts-ignore
      test.$options = test.$options.length;

      let expected: Record<keyof Config.GroupElement, any> = {
        $element: "group",
        $options: 2,
        $children: 3,
        key: "test1",
        indexPath: undefined
      };
      deepStrictEqual(test, expected);
    }),

    Promise.resolve(normalizeTree(SETTINGSDIR, {
      $element: "group",

      $children: {
        // "$element": "",
        "test1sub1": { $element: "folder", path: "~/test1" },
        "test1sub2": "~/test2",
        "test1sub3": { $element: "folder", path: "~/test1" },
        "$options": [
          { $element: "auth", authError: 404, authList: null },
          { $element: "index", defaultType: 404 }
        ]
      }
    } as Schema.GroupElement, "test1", [])).then(test => {
      //@ts-ignore
      test.$children = test.$children.length;
      //@ts-ignore
      test.$options = test.$options.length;

      let expected: Record<keyof Config.GroupElement, any> = {
        $element: "group",
        $options: 2,
        $children: 3,
        key: "test1",
        indexPath: undefined
      };
      deepStrictEqual(test, expected);
    })
  ]).then(() => "done");
}