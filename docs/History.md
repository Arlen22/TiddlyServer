---
id: history
title: The History of TiddlyServer
---

The inspiration for TiddlyServer came from some discussions between several TiddlyWiki developers about a new version of Firefox that was to be released in the middle of 2017. It was a massive rewrite and no longer had some of the features that we needed to be able to save TiddlyWiki files in Firefox. 

I had worked with NodeJS and Apache servers for a few years already and so I got the idea to create a file server that would let you load your wikis from various places on your computer and edit and save them in any browser, not just Firefox. 

Another TiddlyWiki enthusiast (mklauber) had written TiddlyServer 1.x which had the ability to load data folders as separate node instances and proxy them alongside single file wikis. It was based on TiddlyDesktop, but was still running into bugs. This inspired me to try to build a file server which would serve data folders, but without using the somewhat cumbersome and error-prone port proxying of TiddlyServer 1. I had already done this with ExpressJS and liked the result.

With the Firefox 57 Apocolypse looming, I smashed together a working prototype and posted it on the TiddlyWiki Google Group. The response was overwhelmingly positive, and the feedback was very helpful. That's when mklauber and I agreed to call it TiddlyServer 2. So now you know what happened to version 1. 