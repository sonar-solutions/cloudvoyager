#!/bin/bash

./dist/bin/cloudvoyager-macos-arm64 migrate -c migrate-config.json --auto-tune
./dist/bin/cloudvoyager-macos-arm64 verify -c migrate-config.json --auto-tune