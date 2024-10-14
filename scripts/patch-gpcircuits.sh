#!/bin/sh

sed -i.bak 's/\(^import\ .*".*\.json"\);/\1\ with { type: "json" };/' node_modules/.deno/@pcd+gpcircuits@0.1.5/node_modules/@pcd/gpcircuits/dist/esm/src/proto-pod-gpc.js
