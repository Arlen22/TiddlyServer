const fetch = require("node-fetch").default;
if(!process.argv[2]) {
  throw "Please specify the host as argv[2]";
  // node server test/directory-index.json
  // node test/directory-index.js http://localhost:8080
}
((host) => Promise.all([
  fetch(host + "/test1/").then(res => { if (res.status !== 403) throw "1 not 403"; }),
  fetch(host + "/test2/").then(res => { if (res.status !== 403) throw "2 not 403"; }),
  fetch(host + "/test1").then(res => { if (!res.url.endsWith("/")) throw "1 not redirected"; }),
  fetch(host + "/test2").then(res => { if (!res.url.endsWith("/")) throw "2 not redirected"; })
]))(process.argv[2]).then(() => {
  console.log("done");
}).catch((err) => { 
  console.log(err);
});
