import * as path from 'path'
import { oc } from 'ts-optchain'
import {
  ServerConfig_AccessOptions,
  ServerConfig,
  ServerConfig_PutSaver,
  OldServerConfig,
  ServerConfigSchema,
  OptionsSchema,
  NormalizeTreeItem,
  Schema,
} from './types'
const homedir = require('os').homedir()

declare const __non_webpack_require__: NodeRequire | undefined
const nodeRequire =
  typeof __non_webpack_require__ !== 'undefined' ? __non_webpack_require__ : require

function format(str: string, ...args: any[]) {
  while (args.length && str.indexOf('%s') !== -1) str = str.replace('%s', args.shift())
  args.unshift(str)
  return args.join(',')
}

function pathResolveWithUser(settingsDir: string, str: string) {
  if (str.startsWith('~')) return path.join(homedir, str.slice(1))
  else return path.resolve(settingsDir, str)
}

function is<T>(test: (a: typeof b) => boolean, b: any): b is T {
  return test(b)
}

function as<T>(obj: T) {
  return obj
}

function validateOptions(keypath: string[], opts: OptionsSchema[keyof OptionsSchema]) {
  const { $element } = opts
  if (typeof $element !== 'string') {
    throw new Error('Missing $element property in ' + keypath.join('.'))
  }
  if ($element !== 'auth' && $element !== 'putsaver' && $element !== 'index') {
    throw new Error('Invalid element ' + $element + ' found at ' + keypath.join('.'))
  }
}

export const normalizeTree = (
  settingsDir: string,
  item: NormalizeTreeItem,
  key: string | undefined,
  keypath: string[]
): any => {
  if (typeof item === 'object' && !item.$element) {
    if (Object.keys(item).findIndex(e => e.startsWith('$')) !== -1) {
      console.log(
        'Is this a mistake? Found keys starting with the dollar sign under /' + keypath.join('/')
      )
    }
    item = {
      $element: 'group',
      $children: item as any,
    } as Schema.GroupElement
  }

  if (typeof item === 'string' || item.$element === 'folder') {
    if (typeof item === 'string') item = { $element: 'folder', path: item } as Config.PathElement

    if (!item.path) {
      throw format(
        "  Error loading settings: path must be specified for folder item under '%s'",
        keypath.join(', ')
      )
    }

    item.path = pathResolveWithUser(settingsDir, item.path)
    key = key || path.basename(item.path)
    let $options = item.$options || []
    $options.forEach(e => validateOptions(keypath, e))

    return {
      $element: item.$element,
      $options,
      path: item.path,
      key,
      noTrailingSlash: !!item.noTrailingSlash,
      noDataFolder: !!item.noDataFolder,
    } as Config.PathElement
  }
  if (item.$element === 'group') {
    if (!key) key = (item as Schema.ArrayGroupElement).key
    if (!key) throw 'key not provided for group element at /' + keypath.join('/')
    let tc = item.$children
    let $options: Config.OptionElements[] = []
    let $children: (Config.PathElement | Config.GroupElement)[] = []
    if (Array.isArray(item.$children)) {
      $children = item.$children
        .filter((e: any): e is Schema.ArrayGroupElement | Schema.ArrayPathElement => {
          if (Config.isOption(e)) {
            throw 'specifying options in $children is unsupported at ' + keypath.join('.')
          } else {
            return true
          }
        })
        .map(e => normalizeTree(settingsDir, e, undefined, [...keypath, key ? key : '']))
        .filter(i => i)
      item.$options && $options.push(...item.$options)
    } else {
      if (item.$children.$options)
        throw 'specifying options in $children is unsupported at ' + keypath.join('.')
      $children = Object.keys(tc)
        .map(k =>
          k === '$options' ? undefined : normalizeTree(settingsDir, tc[k], k, [...keypath, k])
        )
        .filter((e): e is NonNullable<typeof e> => !!e)
      $options = (e => {
        if (typeof e !== 'undefined' && !Array.isArray(e))
          throw '$options is not an array at ' + keypath.join('.')
        return e || []
      })(item.$options)
    }
    key = is<Schema.ArrayGroupElement>(a => !!a.key, item) ? item.key : key
    $options.forEach(e => validateOptions(keypath, e))
    return as<Config.GroupElement>({
      $element: 'group',
      key,
      $children,
      $options,
      indexPath: item.indexPath ? pathResolveWithUser(settingsDir, item.indexPath) : false,
    })
  } else {
    return item
  }
}
export function normalizeTreeHost(settingsDir: string, host: Schema.HostElement) {
  if (host.$element !== 'host') throw 'Tree array must not mix host elements with other elements'
  return {
    ...host,
    $mount: normalizeTree(settingsDir, host.$mount as any, '$mount', []),
  }
}
export function normalizeSettingsTree(settingsDir: string, tree: ServerConfigSchema['tree']) {
  let defaultHost = (tree2: any): Config.HostElement => ({
    $element: 'host',
    // patterns: {
    // 	"ipv4": ["0.0.0.0/0"],
    // 	"domain": ["*"]
    // },
    // includeSubdomains: true,
    $mount: normalizeTree(settingsDir, tree2, '$mount', []),
  })
  if (typeof tree === 'string' && tree.endsWith('.xml')) {
    //read the xml file and parse it as the tree structure
  } else if (typeof tree === 'string' && (tree.endsWith('.js') || tree.endsWith('.json'))) {
    //require the json or js file and use it directly
    let filepath = pathResolveWithUser(settingsDir, tree)
    tree = nodeRequire(filepath).tree
  }
  //otherwise just assume we're using the value itself.
  //we are not implementing host-based routing yet. If TiddlyServer is
  //loaded as a module, the tree may be added to after the settings file
  //has been normalized and the preflighter may specify any index in the
  //host array.
  return [defaultHost(tree)]
}
export function normalizeSettingsAuthAccounts(auth: ServerConfigSchema['authAccounts']) {
  if (!auth) return {}
  let newAuth: ServerConfig['authAccounts'] = {}

  return newAuth
}

export function normalizeSettings(_set: ServerConfigSchema, settingsFile) {
  const settingsDir = path.dirname(settingsFile)
  const set = oc(_set)
  if (!set?.tree) throw 'tree is required in ServerConfig'
  const localhostDetails = set?.bindInfo?.localAddressPermissions
    ? set.bindInfo.localAddressPermissions['localhost']
    : {}
  const wildcardDetails = set?.bindInfo?.localAddressPermissions
    ? set.bindInfo.localAddressPermissions['*']
    : {}

  let lap = {
    'localhost': {
      ...as<ServerConfig_AccessOptions>({
        writeErrors: true,
        mkdir: true,
        upload: true,
        websockets: true,
        registerNotice: true,
        putsaver: true,
        loginlink: true,
        transfer: false,
      }),
      ...localhostDetails,
    },
    '*': {
      ...as<ServerConfig_AccessOptions>({
        writeErrors: true,
        mkdir: false,
        upload: false,
        websockets: true,
        registerNotice: false,
        putsaver: true,
        loginlink: true,
        transfer: false,
      }),
      ...wildcardDetails,
    },
  }

  Object.keys(set.bindInfo.localAddressPermissions({})).forEach(k => {
    if (k === 'localhost' || k === '*') return
    lap[k] = set.bindInfo.localAddressPermissions[k](lap['*'])
    Object.keys(lap['*']).forEach(k2 => {
      if (lap[k][k2] === undefined) lap[k][k2] = lap['*'][k2]
    })
  })
  let newset: ServerConfig = {
    __dirname: '',
    __filename: '',
    __assetsDir: '',
    __targetTW: '',
    _devmode: !!set._devmode(),
    _datafoldertarget: set._datafoldertarget() || '',
    tree: normalizeSettingsTree(settingsDir, set.tree() as any),
    bindInfo: {
      bindAddress: set.bindInfo.bindAddress([]),
      bindWildcard: set.bindInfo.bindWildcard(false),
      enableIPv6: set.bindInfo.enableIPv6(false),
      filterBindAddress: set.bindInfo.filterBindAddress(false),
      port: set.bindInfo.port(8080),
      localAddressPermissions: lap,
      _bindLocalhost: set.bindInfo._bindLocalhost(false),
      https: !!set.bindInfo.https(''),
    },
    logging: {
      debugLevel: set.logging.debugLevel(0),
      logAccess: set.logging.logAccess(''),
      logError: set.logging.logError(''),
      logColorsToFile: set.logging.logColorsToFile(false),
      logToConsoleAlso: set.logging.logToConsoleAlso(true),
    },
    authAccounts: set.authAccounts({}),
    putsaver: {
      etagAge: set.putsaver.etagAge(3),
      backupFolder: set.putsaver.backupFolder(''),
      etag: set.putsaver.etag('optional'),
      enabled: set.putsaver.enabled(true),
      gzipBackups: set.putsaver.gzipBackups(true),
    },
    datafolder: set.datafolder({}),
    directoryIndex: {
      defaultType: set.directoryIndex.defaultType('html'),
      icons: {
        ...set.directoryIndex.icons({}),
        htmlfile: set.directoryIndex.icons['htmlfile'](['htm', 'html']),
      },
      types: {},
      mixFolders: set.directoryIndex.mixFolders(true),
      mimetypes: {},
    },
    authCookieAge: set.authCookieAge(2592000),
    maxTransferRequests: set.maxTransferRequests(0),
    $schema: './settings.schema.json',
  }

  Object.keys(newset.directoryIndex.icons).forEach(type => {
    newset.directoryIndex.icons[type].forEach(ext => {
      if (!newset.directoryIndex.types[ext]) {
        newset.directoryIndex.types[ext] = type
      } else {
        throw format(
          'Multiple types for extension %s: %s',
          ext,
          newset.directoryIndex.types[ext],
          type
        )
      }
    })
  })

  if (newset.putsaver && newset.putsaver.backupFolder)
    newset.putsaver.backupFolder = pathResolveWithUser(settingsDir, newset.putsaver.backupFolder)
  if (newset.logging.logAccess)
    newset.logging.logAccess = pathResolveWithUser(settingsDir, newset.logging.logAccess)
  if (newset.logging.logError)
    newset.logging.logError = pathResolveWithUser(settingsDir, newset.logging.logError)

  newset.__dirname = settingsDir
  newset.__filename = settingsFile

  if (newset.putsaver && newset.putsaver.etag === 'disabled' && !newset.putsaver.backupFolder) {
    console.log(
      'Etag checking is disabled, but a backup folder is not set. ' +
        'Changes made in multiple tabs/windows/browsers/computers can overwrite each ' +
        'other with stale information. SAVED WORK MAY BE LOST IF ANOTHER WINDOW WAS OPENED ' +
        'BEFORE THE WORK WAS SAVED. Instead of disabling Etag checking completely, you can ' +
        'also set the etagWindow setting to allow files to be modified if not newer than ' +
        'so many seconds from the copy being saved.'
    )
  }
  return newset
}

export namespace Config {
  export type OptionElements = OptionsSchema[keyof OptionsSchema]

  export interface Options_Index {
    /**
     * Options related to the directory index (request paths that resolve to a folder
     * which is not a data folder). Option elements affect the group
     * they belong to and all children under that. Each property in an option element
     * replaces the key from parent option elements.
     */
    $element: 'index'
    /**
     * The format of the index generated if no index file is found, or "403" to
     * return a 403 Access Denied, or 404 to return a 404 Not Found. 403 is the
     * error code used by Apache and Nginx.
     */
    defaultType?: 'html' | 'json' | 403 | 404
    /**
     * Look for index files named exactly this or with one of the defaultExts added.
     * For example, a defaultFile of ["index"] and a defaultExts of ["htm","",html"] would
     * look for ["index.htm","index","index.html"] in that order.
     *
     * Only applies to folder elements, but may be set on a group element. An empty array disables this feature.
     * To use a .hidden file, put the full filename here, and set indexExts to `[""]`.
     */
    indexFile?: string[]
    /**
     * Extensions to add when looking for an index file. A blank string will set the order
     * to search for the exact indexFile name. The extensions are searched in the order specified.
     *
     * Only applies to folder elements, but may be set on a group element. An empty array disables this feature.
     * The default is `[""]`, which will search for an exact indexFile.
     */
    indexExts?: string[]
  }
  export interface Options_Auth {
    /**
     * Only allow requests using these authAccounts. Option elements affect the group they belong to and all children under that. Each property in an auth element replaces the key from parent auth elements.
     *
     * Anonymous requests are ALWAYS denied if an auth list applies to the requested path.
     *
     * Note that this does not change server authentication procedures. Data folders are always given the authenticated username regardless of whether there are auth elements in the tree.
     */
    $element: 'auth'
    /** Array of keys from authAccounts object that can access this resource. Null allows all, including anonymous. */
    authList?: string[] | null
    /**
     * Which error code to return for unauthorized (or anonymous) requests
     * - 403 Access Denied: Client is not granted permission to access this resouce.
     * - 404 Not Found: Client is told that the resource does not exist.
     */
    authError?: 403 | 404
  }
  export interface Options_Backups extends ServerConfig_PutSaver {
    /** Options related to backups for single-file wikis. Option elements affect the group they belong to and all children under that. Each property in a backups element replaces the key from parent backups elements. */
    $element: 'putsaver'
  }

  export function isOption(a: any): a is OptionElements {
    return !!a.$element && ['auth', 'backups', 'index'].indexOf(a.$element) !== -1
  }
  export function isElement(
    a: any
  ): a is GroupElement | PathElement | HostElement | OptionElements {
    return typeof a === 'object' && typeof a['$element'] === 'string'
  }
  export function isGroup(a: any): a is GroupElement {
    return isElement(a) && a.$element === 'group'
  }
  export function isPath(a: any): a is PathElement {
    return isElement(a) && a.$element === 'folder'
  }
  export type MountElement = GroupElement | PathElement
  export interface HostElement {
    $element: 'host'
    $mount: GroupElement | PathElement
  }
  export interface GroupElement {
    $element: 'group'
    key: string
    indexPath: string | false
    $children: MountElement[]
    $options: OptionElements[]
  }
  export interface PathElement {
    $element: 'folder'
    key: string
    path: string
    noTrailingSlash: boolean
    noDataFolder: boolean
    // $children: never;
    $options: OptionElements[]
  }
}
export function OldDefaultSettings(set: OldServerConfig) {
  if (!set.port) set.port = 8080
  if (!set.host) set.host = '127.0.0.1'
  if (!set.types)
    set.types = {
      htmlfile: ['htm', 'html'],
    }
  if (!set.etag) set.etag = ''
  if (!set.etagWindow) set.etagWindow = 0
  if (!set.useTW5path) set.useTW5path = false
  if (typeof set.debugLevel !== 'number') set.debugLevel = -1
  ;['allowNetwork', 'allowLocalhost'].forEach((key: string) => {
    if (!set[key]) set[key] = {} as any
    if (!set[key].mkdir) set[key].mkdir = false
    if (!set[key].upload) set[key].upload = false
    if (!set[key].settings) set[key].settings = false
    if (!set[key].WARNING_all_settings_WARNING) set[key].WARNING_all_settings_WARNING = false
  })

  if (!set.logColorsToFile) set.logColorsToFile = false
  if (!set.logToConsoleAlso) set.logToConsoleAlso = false

  if (!set.maxAge) set.maxAge = {} as any
  if (typeof set.maxAge.tw_plugins !== 'number') set.maxAge.tw_plugins = 60 * 60 * 24 * 365 * 1000 //1 year of milliseconds
}

export function ConvertSettings(set: OldServerConfig): ServerConfigSchema {
  return {
    _devmode: set._devmode,
    _datafoldertarget: undefined,
    tree: set.tree,
    bindInfo: {
      bindAddress: set.host === '0.0.0.0' || set.host === '::' ? undefined : [set.host],
      filterBindAddress: undefined,
      enableIPv6: set.host === '::',
      port: set.port,
      bindWildcard: set.host === '0.0.0.0' || set.host === '::',
      localAddressPermissions: {
        'localhost': set.allowLocalhost,
        '*': set.allowNetwork,
      },
      https: undefined,
      _bindLocalhost: set._disableLocalHost === false,
    },
    logging: {
      logAccess: set.logAccess,
      logError: set.logError,
      logColorsToFile: set.logColorsToFile,
      logToConsoleAlso: set.logToConsoleAlso,
      debugLevel: set.debugLevel,
    },
    putsaver: {
      etag: set.etag || 'optional',
      etagAge: set.etagWindow,
      backupFolder: '',
    },
    datafolder: {},
    authAccounts: {},
    directoryIndex: {
      defaultType: 'html',
      icons: set.types,
      mixFolders: set.mixFolders,
    },
    authCookieAge: 2592000,
    $schema: './settings-2-1.schema.json',
  }
}
