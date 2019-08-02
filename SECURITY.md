## Security considerations

### The login cookie

The login cookie is generated using a public/private key pair which in turn is generated from the username and password. The main advantage of this is that the password is never sent to the server. Instead the client signs a string and then sends the string and the signature to the server. The server looks up the public key in ServerConfig and checks the signature on the cookie to verify that it originated from the correct private key (i.e the correct username and password). 

For the end-user, they assume they are using a username and password for authentication, so all standard password rules that they have learned apply. 

**For you, the reader, I need to warn you** that you must not be lulled into a false sense of security. The private key seed is generated from a hash of the username, password, and a salt that is the same for all TiddlyServer installations by default. It is then put through a PBKDF. It is designed to slow down brute-force attacks, but in the end the security is not better than a simple username+password combination with the password hashed on the server. The code is in `/assets/authenticate/authenticate-login.ts` if you are interested.

The only difference is that the password is not sent accross in the clear, but this does not imply that HTTPS is not required, because cookies can always be stolen, and data can always be read in the clear. 

Without HTTPS, there is no security outside of a LAN. I once tried to solve this problem without using HTTPS, and there is basically no way to do it without designing something that ends up looking a lot like SSH port forwarding with public key authentication and known host requirements. 

### The cookie suffix

The suffix is not a secure feature. An attacker could do several things.

- The cookie suffix allows all cookies for a user to be invalidated, requiring the user to login in again on all devices. The cookie is normally set statically with a JSON settings file, but if a JavaScript file is used for the settings, the suffix could also be set each time the server starts, which is more secure. 
- However, if the suffix is set based on the time, such as hashing the current time, an attacker could brute-force search the approximate time if the exact generation code and the approximate time of server startup is known. An attacker with read-only access to the JavaScript settings file could do this relatively easily unless a random salt is mixed in, in which case there is no point in using the time and the random salt should just be hashed directly. 
- An attacker with write access to the settings could re-validate a cookie by setting the suffix for that username and public key to the suffix contained in a stolen cookie. The only advantage of this method is that the public key does not need to be changed, which allows the user to continue using their username/password combination. There is no way to prevent this without keeping track of auth sessions on the server-side and using per-session salts, and it would require an auth store to persist between server restarts. 
