#! /usr/local/bin/node

//@ts-check
const path = require("path");
const cp = require("child_process");
const httpsjsonfile = path.resolve(process.argv[2]);
/**
 * @type {import ("./https.json")}
 */
const { restart_cmd, privatekey, certificate, fullchain, host } = require(httpsjsonfile);

const resolveFile = (file) => path.resolve(path.dirname(httpsjsonfile), file);

if (process.argv[3] === "issue") {

  let issue = `~/.acme.sh/acme.sh --issue --standalone -k 4096 -d ${host}`;

  console.log('Follow the instructions on the acme.sh project page to issue a certificate');
  console.log("https://github.com/Neilpang/acme.sh\n");
  console.log("If you want to use standalone mode on port 80, run this command\n");
  console.log("  " + issue);
} else if (process.argv[3] === "install") {


  let install = `\
~/.acme.sh/acme.sh --install-cert -d ${host} \
--cert-file      ${resolveFile(certificate)}  \
--key-file       ${resolveFile(privatekey)}  \
--fullchain-file ${resolveFile(fullchain)} \
--reloadcmd     "${restart_cmd}"`

let run = cp.exec("sh -");
run.stdin.write(install);
run.stdin.end();

}
