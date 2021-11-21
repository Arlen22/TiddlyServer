import { xml2js, xml2json, js2xml, Attributes, DeclarationAttributes, json2xml } from "xml-js";

const keys = {
  // nameKey: "$element",
  elementsKey: "$children",
  attributesKey: "$attrs"
}
interface Element {
  declaration?: {
    attributes?: DeclarationAttributes
  }
  instruction?: string
  $attrs?: Attributes
  cdata?: string
  doctype?: string
  comment?: string
  text?: string | number | boolean
  type?: string
  name?: string
  $children?: Array<Element>
}
function convertFromXMLinner(e: Element | undefined): { $element: string, $children: any[] } | string | number | boolean | undefined {
  if (!e) return undefined;
  // console.log(e);
  if (e.type === "element") {
    let $children = e.$children?.map(convertFromXMLinner) || [];
    return {
      $element: e.name as string,
      ...e.$attrs,
      $children
    };
  } else if (e.type === "text") {
    return e.text;
  } else if (e.type === "cdata") {
    return e.cdata;
  }
  return undefined;
}
function convertToXMLinner(e: any) {
  if (typeof e === "object" && e.$element) {
    return {
      type: "element",
      name: e.$element,
      $attrs: { ...e, $element: undefined, $children: undefined },
      $children: e.$children?.map(f => convertToXMLinner(f)) || []
    }
  } else if (typeof e === "object") {
    return undefined;
  } else {
    return {
      type: "text",
      text: e.toString()
    }
  }
}
// export interface xmlTree extends xmlBase 
// export interface xmlBase {
//   [k: string]: string;
// }
export type xmlTree = {
  $element: string;
  $children: (xmlTree | string)[];
} & {
  [k: string]: unknown;
}

export function toXML(input: xmlTree, declaration: boolean = true) {
  let inter = JSON.stringify({
    // declaration: { "$attrs": { "version": "1.0" } },
    $children: [convertToXMLinner(input)]
  });
  return json2xml(inter, { compact: false, ...keys, });
}
export function fromXML(docStr: string, root: string[]) {
  let doc = xml2js(docStr, {
    compact: false,
    alwaysArray: true,
    alwaysChildren: true,
    nativeType: true,
    ...keys
  }) as Element;
  if (doc.$children) {
    let index = doc.$children.findIndex(e => e.name && root.indexOf(e.name) !== -1);
    if (index === -1) return false;
    else return convertFromXMLinner(doc.$children[index]);
  } else {
    return false;
  }
}
type ret = { $element: string, $children: (ret | string)[] };
/**
 * Convert an object into a JSON document, or an array if the key is specified
 * @param obj The basic JS object to convert to an XML document, arrays require the key param 
 * @param key The node name, depending on the type of obj param
 * @returns An array of $children or an array with a root element
 */
export function expandNodeTree(obj: any): (string | xmlTree)[];
export function expandNodeTree(obj: any, key: string): xmlTree[];
export function expandNodeTree(obj: any, key?: string): (string | xmlTree)[] {
  if (!obj) return [];
  if (Array.isArray(obj)) {
    if (!key) throw new Error("key is required in expandNodeTree array branch");
    return obj.map(e => ({
      $element: key,
      $children: expandNodeTree(e)
    }));
  } else if (typeof obj === "object") {
    let $children: ret[] = Object.keys(obj).reduce((n, e) =>
      [...n, ...expandNodeTree(obj[e], e)], [] as ret[]);
    return key ? [{ $element: key, $children } as ret] : $children;
  } else {
    let $children = [obj.toString()];
    return key ? [{ $element: key, $children }] : $children;
  }
}
