#!/bin/sh

sed -i.bak 's/\(^\ *\)const\ stats.*/\1const stats = fs.fstatSync(fd.fd);/' node_modules/.deno/fastfile@0.0.20/node_modules/fastfile/src/osfile.js
