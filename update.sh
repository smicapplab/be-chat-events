#!/bin/bash

echo "Upgrading dependencies"
rm -rvf node_modules/
rm package-lock.json
ncu -u
npm install

cd lambda-layers/framework/nodejs
rm -rvf node_modules/
rm package-lock.json
ncu -u
npm install

cd ../../aws/nodejs/
rm -rvf node_modules/
rm package-lock.json
ncu -u
npm install