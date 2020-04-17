import * as JSON5 from 'json5'
import * as path from 'path'
import * as fs from 'fs'
import { Stats } from 'fs'
import { promisify } from 'util'
import * as ipcalc from '../ipcalc'
import {
  PathResolverResult,
  DirectoryIndexOptions,
  DirectoryIndexData,
  JsonError,
  StatPathResult,
  TreePathResult,
} from './types'
import { generateDirectoryListing } from '../generate-directory-listing'
import { Config } from './config'
import { OptionsConfig } from './types'
import { StateObject } from '../state-object'
import { hostIPv4reg } from '../constants'

export const getHumanSize = (size: number) => {
  const TAGS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let power = 0
  while (size >= 1024) {
    size /= 1024
    power++
  }
  return size.toFixed(1) + TAGS[power]
}

/**
 * Calls the onerror handler if there is a JSON error. Returns whatever the error handler
 * returns. If there is no error handler, undefined is returned.
 * The string "undefined" is not a valid JSON document.
 */
export const tryParseJSON = <T extends unknown>(
  str: string,
  onerror?: (e: JsonError) => T | never | void
): T => {
  function findJSONError(message: string, json: string) {
    console.log(message)
    const res: string[] = []
    const match = /at (\d+):(\d+)/gi.exec(message)
    if (!match) return ''
    const position = [+match[1], +match[2]]
    const lines = json.split('\n')
    res.push(...lines.slice(0, position[0]))
    res.push(new Array(position[1]).join('-') + '^  ' + message)
    res.push(...lines.slice(position[0]))
    return res.join('\n')
  }
  str = str.replace(/\t/gi, '    ').replace(/\r\n/gi, '\n') || ''
  let parsed: any = {}
  try {
    parsed = JSON5.parse(str)
  } catch (e) {
    let err = new JsonError(findJSONError(e.message, str), e)
    if (onerror) onerror(err)
  }
  return parsed
}

export const keys = <T>(o: T): (keyof T)[] => {
  return Object.keys(o) as (keyof T)[]
}

export const padLeft = (str: any, pad: number | string, padStr?: string): string => {
  var item = str.toString()
  if (typeof padStr === 'undefined') padStr = ' '
  if (typeof pad === 'number') {
    pad = new Array(pad + 1).join(padStr)
  }
  //pad: 000000 val: 6543210 => 654321
  return pad.substr(0, Math.max(pad.length - item.length, 0)) + item
}

export const sortBySelector = <T extends { [k: string]: string }>(key: (e: T) => any) => {
  return function(a: T, b: T) {
    var va = key(a)
    var vb = key(b)

    if (va > vb) return 1
    else if (va < vb) return -1
    else return 0
  }
}

export const isError = (obj: any): obj is Error => {
  return !!obj && obj.constructor === Error
}

export const as = <T>(obj: T) => {
  return obj
}

/**
 * Returns the keys and paths from the PathResolverResult directory. If there
 * is an error it will be sent directly to the client and nothing will be emitted.
 *
 * @param {PathResolverResult} result
 * @returns
 */
export const getTreePathFiles = async (
  result: PathResolverResult,
  state: StateObject
): Promise<DirectoryIndexData> => {
  let dirpath = [result.treepathPortion.join('/'), result.filepathPortion.join('/')]
    .filter(e => e)
    .join('/')
  const type = Config.isGroup(result.item) ? 'group' : 'folder'
  if (Config.isGroup(result.item)) {
    let $c = result.item.$children
    const keys = $c.map(e => e.key)
    // const keys = Object.keys(result.item);
    const paths = $c.map(e => (Config.isPath(e) ? e.path : true))
    return Promise.resolve({
      keys,
      paths,
      dirpath,
      type: type as 'group' | 'folder',
    })
  } else {
    return promisify(fs.readdir)(result.fullfilepath)
      .then(keys => {
        const paths = keys.map(k => path.join(result.fullfilepath, k))
        return { keys, paths, dirpath, type: type as 'group' | 'folder' }
      })
      .catch(err => {
        if (!err) return Promise.reject(err)
        state.log(2, 'Error calling readdir on folder "%s": %s', result.fullfilepath, err.message)
        state.throw(500)
        return Promise.reject(false)
      })
  }
}

export const getTreeOptions = (state: StateObject) => {
  // Nonsense we have to write because putsaver could be false
  // type putsaverT = Required<typeof state.settings.putsaver>;
  let putsaver = as<typeof state.settings.putsaver>({
    enabled: true,
    gzipBackups: true,
    backupFolder: '',
    etag: 'optional',
    etagAge: 3,
    ...(state.settings.putsaver || {}),
  })
  let options: OptionsConfig = {
    auth: { $element: 'auth', authError: 403, authList: null },
    putsaver: { $element: 'putsaver', ...putsaver },
    index: {
      $element: 'index',
      defaultType: state.settings.directoryIndex.defaultType,
      indexFile: [],
      indexExts: [],
    },
  }
  state.ancestry.forEach(e => {
    e.$options &&
      e.$options.forEach(f => {
        if (f.$element === 'auth' || f.$element === 'putsaver' || f.$element === 'index') {
          Object.keys(f).forEach(k => {
            if (f[k] === undefined) return
            options[f.$element][k] = f[k]
          })
        }
      })
  })
  return options
}

export const sendDirectoryIndex = async ([_r, options]: [
  DirectoryIndexData,
  DirectoryIndexOptions
]) => {
  let { keys, paths, dirpath, type } = _r
  let entries = await Promise.all(
    keys.map(async (key, i) => {
      let statpath = paths[i]
      let stat = statpath === true ? undefined : await statPath(statpath)
      return {
        name: key,
        path: key + (!stat || stat.itemtype === 'folder' ? '/' : ''),
        type: !stat
          ? 'group'
          : stat.itemtype === 'file'
          ? options.extTypes[key.split('.').pop() as string] || 'other'
          : (stat.itemtype as string),
        size: stat && stat.stat ? getHumanSize(stat.stat.size) : '',
      }
    })
  )
  if (options.format === 'json') {
    return JSON.stringify({ path: dirpath, entries, type, options }, null, 2)
  } else {
    let def = { path: dirpath, entries, type }
    return generateDirectoryListing(def, options)
  }
}

/**
 * If the path
 */
export const statWalkPath = async (test: PathResolverResult) => {
  if (!Config.isPath(test.item)) {
    console.log(test.item)
    throw 'property item must be a TreePath'
  }
  let n = { statpath: '', index: -1, endStat: false }
  let stats = [test.item.path, ...test.filepathPortion].map(e => {
    return (n = {
      statpath: path.join(n.statpath, e),
      index: n.index + 1,
      endStat: false,
    })
  })
  while (true) {
    let s = stats.shift()
    /* should never be undefined because we always do at least
     * 1 loop and then exit if stats.length is 0 */
    if (!s) throw new Error('PROGRAMMER ERROR')
    let res = await statPath(s)
    if (res.endStat || stats.length === 0) return res
  }
}

export const statsafe = async (p: string) => {
  return promisify(fs.stat)(p).catch(_x => undefined)
}

/**
 * returns the info about the specified path. endstat is true if the statpath is not
 * found or if it is a directory and contains a tiddlywiki.info file, or if it is a file.
 *
 * @param {({ statpath: string, index: number, endStat: boolean } | string)} s
 * @returns
 */
export const statPath = async (s: { statpath: string; index: number } | string) => {
  if (typeof s === 'string') s = { statpath: s, index: 0 }
  const { statpath, index } = s
  let stat = await statsafe(statpath)
  let endStat = !stat || !stat.isDirectory()
  let infostat: fs.Stats | undefined = undefined
  if (!endStat) {
    infostat = await statsafe(path.join(statpath, 'tiddlywiki.info'))
    endStat = !!infostat && infostat.isFile()
  }

  return {
    stat,
    statpath,
    index,
    endStat,
    itemtype: getItemType(stat, infostat),
    infostat: infostat && infostat.isFile() ? infostat : undefined,
  } as StatPathResult
}

function getItemType(stat: Stats | undefined, infostat: Stats | undefined) {
  let itemtype: string = ''
  if (!stat) itemtype = 'error'
  else if (stat.isDirectory()) itemtype = !!infostat ? 'datafolder' : 'folder'
  else if (stat.isFile() || stat.isSymbolicLink()) itemtype = 'file'
  else itemtype = 'error'

  return itemtype
}

export const treeWalker = (tree: Config.GroupElement | Config.PathElement, reqpath: any) => {
  var item = tree
  var ancestry: Config.MountElement[] = []
  var folderPathFound = Config.isPath(item)
  for (var end = 0; end < reqpath.length; end++) {
    if (Config.isPath(item)) {
      folderPathFound = true
      break
    }
    let t = item.$children.find(
      (e): e is Config.GroupElement | Config.PathElement =>
        (Config.isGroup(e) || Config.isPath(e)) && e.key === reqpath[end]
    )
    if (t) {
      ancestry.push(item)
      item = t
    } else {
      break
    }
  }
  return { item, end, folderPathFound, ancestry } as TreePathResult
}

export const resolvePath = (
  state: StateObject | string[],
  tree: Config.MountElement
): PathResolverResult | undefined => {
  let reqpath: any
  if (Array.isArray(state)) {
    reqpath = state
  } else {
    reqpath = state.path
  }

  reqpath = decodeURI(
    reqpath
      .slice()
      .filter((a: any) => a)
      .join('/')
  )
    .split('/')
    .filter(a => a)

  if (!reqpath.every((a: any) => a !== '..' && a !== '.')) return

  var result = treeWalker(tree, reqpath)

  if (reqpath.length > result.end && !result.folderPathFound) return

  //get the remainder of the path
  let filepathPortion = reqpath.slice(result.end).map((a: any) => a.trim())

  const fullfilepath = result.folderPathFound
    ? path.join(result.item.path, ...filepathPortion)
    : Config.isPath(result.item)
    ? result.item.path
    : ''

  return {
    item: result.item,
    ancestry: result.ancestry,
    treepathPortion: reqpath.slice(0, result.end),
    filepathPortion,
    reqpath,
    fullfilepath,
  }
}

/** to be used with concatMap, mergeMap, etc. */
// TODO: fix spelling error
export const recieveBody = (
  state: StateObject,
  parseJSON: boolean,
  sendError?: true | ((e: JsonError) => void)
) => {
  //get the data from the request
  return state.recieveBody(parseJSON, sendError)
}

/**
 *
 *
 * @param {string} ip x.x.x.x
 * @param {string} range x.x.x.x
 * @param {number} netmask 0-32
 */
export const testAddress = (ip: string, range: string, netmask: number) => {
  let netmaskBinStr = ipcalc.IPv4_bitsNM_to_binstrNM(netmask)
  let addressBinStr = ipcalc.IPv4_intA_to_binstrA(ipcalc.IPv4_dotquadA_to_intA(ip))
  let netaddrBinStr = ipcalc.IPv4_intA_to_binstrA(ipcalc.IPv4_dotquadA_to_intA(range))
  let netaddrBinStrMasked = ipcalc.IPv4_Calc_netaddrBinStr(netaddrBinStr, netmaskBinStr)
  let addressBinStrMasked = ipcalc.IPv4_Calc_netaddrBinStr(addressBinStr, netmaskBinStr)
  return netaddrBinStrMasked === addressBinStrMasked
}

export const parseHostList = (hosts: string[]) => {
  let hostTests = hosts.map(e => hostIPv4reg.exec(e) || e)
  return (addr: string) => {
    let usable = false
    let lastMatch = -1
    hostTests.forEach((test, i) => {
      if (Array.isArray(test)) {
        let allow = !test[1]
        let ip = test[2]
        let netmask = +test[3]
        if (netmask < 0 || netmask > 32) console.log('Host %s has an invalid netmask', test[0])
        if (testAddress(addr, ip, netmask)) {
          usable = allow
          lastMatch = i
        }
      } else {
        let ip = test.startsWith('-') ? test.slice(1) : test
        let deny = test.startsWith('-')
        if (ip === addr) {
          usable = !deny
          lastMatch = i
        }
      }
    })
    return { usable, lastMatch }
  }
}
