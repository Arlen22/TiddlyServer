
# This takes three arguments: 
# (1) The domain name the certificate is issued for (see issue-cert to issue a new certificate)
# (2) the export directory where the server will load the certificates from
# (3) the server reload command to run when the certificates are renewed

/root/.acme.sh/acme.sh --install-cert -d $1 \
--cert-file      $2/tiddlyserver-cert.pem  \
--key-file       $2/tiddlyserver-key.pem  \
--fullchain-file $2/tiddlyserver-fullchain.pem \
--reloadcmd     "$3"
