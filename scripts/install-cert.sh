/root/.acme.sh/acme.sh --install-cert -d $1 \
--cert-file      $2/tiddlyserver-cert.pem  \
--key-file       $2/tiddlyserver-key.pem  \
--fullchain-file $2/tiddlyserver-fullchain.pem \
--reloadcmd     "$3"