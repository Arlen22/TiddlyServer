---
id: security
title: Security Considerations
sidebar_label: Security Considerations
---

- Don't run as root (or sudo/su/etc.). Instead use 8080 and put a permanent port redirect in iptables if desired. 
- Don't run random datafolders that you download from the internet without looking through them first. They have full access to the file system. 
- Don't depend on login credentials unless you are using HTTPS. Without encryption, a login will just give you a false sense of security. 

> The list above applies to TiddlyWiki on NodeJS as well.

## Data folder authentication

TiddlyServer inserts it's own authenticator into the authenticator stack just before invoking the `th-server-command-post-start` hook. It checks if the wiki allows anonymous users, and returns a 403 error if it does not. Other than that it is only used to inform TiddlyWiki of the username and login status of the request. All TiddlyServer authentication happens prior to this and normally cannot be overridden by the datafolder. 

## The PUT saver

The put saver can modify any file it wants to, not just HTML files. It is possible to restrict it more securely using HTTPS, but otherwise it is just a wide-open door for grief if you try to use it on the internet. It can be disabled in the access options per-user or per-host or disabled completely in the server config. 

Note that it should be completely impossible to read or write anything inside a data folder because all requests to a data folder path will load the data folder and hand the request off to the TiddlyWiki request handler. 

## Multiple datafolders being loaded

If you don't trust a data folder, you shouldn't load it in TiddlyServer. The same goes for TiddlyWiki. The data folder mechanism is designed to run user code on the server. Therefore you must trust all your users and data folders or come up with an alternate implementation. There are a few ways this can be done, but none are fully implemented yet. One way to work around it is to load a data folder without the tiddlyweb and filesystem plugins, which will create a read-only data folder. 

Do not run TiddlyServer and TiddlyWiki as root (or using sudo/su/etc.). It's much better to set iptables to permenantly redirect port 80 to 8080 and 443 to 8443 and use them as the default ports rather than using sudo. 

Beware that data folder instances have full access to the file system, and all run under one process, so there is no good way to keep them from finding the settings file unless you use a shell script to chmod it after the server starts and it is owned by a different user than the node process is under. 

Data folders in TiddlyServer are completely separated and should not be able to access each other or any of the TiddlyServer code in the process. While I can't guarentee it, this is what I've tried to accomplish all along. TiddlyWiki also loads all modules in their own v8 context (on the server, but not in the browser). Because this causes a serious performance bottleneck, I've changed this to one context per TiddlyWiki instance. I don't consider this an important change because the browser side is basically setup this way as well. The startup time is reduced considerably by this change. 

Data folders cannot be completely secured, and timing attacks are always a consideration, but under normal circumstances data folder instances cannot access each other or loaded parts of TiddlyServer.

## The login cookie

The login cookie is generated using a public/private key pair which in turn is generated from the username and password. The main advantage of this is that the password is never sent to the server. Instead the client signs a string and then sends the string and the signature to the server. The server looks up the public key in ServerConfig and checks the signature on the cookie to verify that it originated from the correct private key (i.e the correct username and password). 

For the end-user, they assume they are using a username and password for authentication, so all standard password rules that they have learned apply. 

**For you, the reader, I need to warn you** that you must not be lulled into a false sense of security. The private key seed is generated from a hash of the username, password, and a salt that is the same for all TiddlyServer installations by default. It is then put through a PBKDF. It is designed to slow down brute-force attacks, but in the end the security is not better than a simple username+password combination with the password hashed on the server. The code is in `/assets/authenticate/authenticate-login.ts` if you are interested.

The only difference is that the password is not sent accross in the clear, but this does not imply that HTTPS is not required, because cookies can always be stolen, and data can always be read in the clear. 

Without HTTPS, there is no security outside of a LAN. I once tried to solve this problem without using HTTPS, and there is basically no way to do it without designing something that ends up looking a lot like SSH port forwarding with public key authentication and known host requirements. 

## The cookie suffix

The suffix is not a secure feature. An attacker could do several things to take advantage of it. HTTPS should always be used, but I am not requiring it because someone could also want to setup TiddlyServer behind an NGINX reverse proxy or some other HTTPS server. 

The cookie suffix allows all cookies for a user to be invalidated, requiring the user to login in again on all devices. The cookie is normally set statically with a JSON settings file, but if a JavaScript file is used for the settings, the suffix could also be set each time the server starts, which is more secure. 

However, if the suffix is set based on the time, such as hashing the current time, an attacker could brute-force search the approximate time if the exact generation code and the approximate time of server startup is known. An attacker with read-only access to the JavaScript settings file could do this relatively easily unless a random salt is mixed in, in which case there is no point in using the time and the random salt should just be hashed directly. 

An attacker with write access to the settings could re-validate a cookie by setting the suffix for that username and public key to the suffix contained in a stolen cookie. The only advantage of this method is that the public key does not need to be changed, which allows the user to continue using their username/password combination. There is no way to prevent this without keeping track of auth sessions on the server-side and using per-session salts, and it would require an auth store to persist between server restarts. 
