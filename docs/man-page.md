---
id: man-page
title: TiddlyServer man page
---

## Name

**tiddlyserver** - Static file server that loads multiple datafolders and allows single file saving.

## Synopsis

**tiddlyserver** **--config-file** *config_file* [**--dry-run**] [**--stay-on-error**]

**tiddlyserver** **gunzip** *input_file* *output_file*

**tiddlyserver** **gen-schema** [*schema_file*]

**tiddlyserver** **--version|-v**

**tiddlyserver** **--help|-h**

## Description

**tiddlyserver** supports login, saving single file wikis, mounting data folders, and serves all files.

**tiddlyserver** allows you to load multiple data folders at once. Each folder is mounted and all requests are forwarded to the same TiddlyWiki server loaded by the `tiddlywiki --listen` command. If the plugins follow TiddlyWiki best practices, your data folder should just work. Single-file wikis already have a saver installed by default, which has been implemented to allow single file wikis to be saved as well.

## Commands

### **--config-file** *config-file* [**--dry-run**] [**--stay-on-error**]

Run **tiddlyserver**.

- *config-file*: The [ServerConfig](https://arlen22.github.io/tiddlyserver/docs/serverconfig) JSON file.
- --dry-run: Don't start the HTTP listeners, but do everything else. The NodeJS process will likely exit because nothing is active to keep it open. This is useful for checking your configuration. 
- --stay-on-error: Keep the NodeJS process open if there are errors (mostly useful on windows). This is independant of `--dry-run`.

### **gunzip** *input_file* *output_file*

Unzip backup files. If *output_file* exists, the **tiddlyserver** will throw an error.

### **gen-schema** [*schema_file*]

Generate a schema file to use in your config file. You can optionally specify the file to write the schema to, otherwise `tiddlyserver-2-2.schema.json` in the current folder is the default. 

### **--version|-v** 

Print the **tiddlyserver** version from package.json. 

### **--help|-h** 

Print a short help message.
