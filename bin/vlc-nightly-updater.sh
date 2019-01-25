#!/usr/bin/env bash
pushd $(dirname "$(\realpath "$0")") &>/dev/null
npm start
popd &>/dev/null
