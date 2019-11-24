# This takes one argument -- the domain name -- and issues an 
# RSA 4096 certificate using standalone authentication on port 80
# For other options, consult the acme documentation at http://acme.sh
# You're always welcome to issue a certificate some other way. 

/root/.acme.sh/acme.sh --issue \
--standalone --force -k 4096 \
-d $1
