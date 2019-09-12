#!/bin/bash
#
# This assumes all of the OS-level configuration has been completed and git repo has already been cloned
#
# This script should be run from the repo's deployment directory
# cd deployment
# ./run-unit-tests.sh
#

# Get reference for all important folders
template_dir="$PWD"
source_dir="$template_dir/../source"

echo "------------------------------------------------------------------------------"
echo "[Init] Clean old dist and node_modules folders"
echo "------------------------------------------------------------------------------"
echo "find $source_dir/services -iname "node_modules" -type d -exec rm -r "{}" \; 2> /dev/null"
find $source_dir/services -iname "node_modules" -type d -exec rm -r "{}" \; 2> /dev/null
echo "find $source_dir/services -iname "dist" -type d -exec rm -r "{}" \; 2> /dev/null"
find $source_dir/services -iname "dist" -type d -exec rm -r "{}" \; 2> /dev/null
echo "find ../ -type f -name 'package-lock.json' -delete"
find $source_dir/services -type f -name 'package-lock.json' -delete
echo "find $source_dir/resources -iname "node_modules" -type d -exec rm -r "{}" \; 2> /dev/null"
find $source_dir/resources -iname "node_modules" -type d -exec rm -r "{}" \; 2> /dev/null
echo "find $source_dir/resources -iname "dist" -type d -exec rm -r "{}" \; 2> /dev/null"
find $source_dir/resources -iname "dist" -type d -exec rm -r "{}" \; 2> /dev/null
echo "find ../ -type f -name 'package-lock.json' -delete"
find $source_dir/resources -type f -name 'package-lock.json' -delete

echo "------------------------------------------------------------------------------"
echo "[Test] Services - Admin"
echo "------------------------------------------------------------------------------"
cd $source_dir/services/api/admin
npm install
npm test

echo "------------------------------------------------------------------------------"
echo "[Test] Services - Command"
echo "------------------------------------------------------------------------------"
cd $source_dir/services/api/command
npm install
npm test

echo "------------------------------------------------------------------------------"
echo "[Test] Services - Event"
echo "------------------------------------------------------------------------------"
cd $source_dir/services/api/event
npm install
npm test

echo "------------------------------------------------------------------------------"
echo "[Test] Services - Registration"
echo "------------------------------------------------------------------------------"
cd $source_dir/services/api/registration
npm install
npm test

echo "------------------------------------------------------------------------------"
echo "[Test] Services - Status"
echo "------------------------------------------------------------------------------"
cd $source_dir/services/api/status
npm install
npm test

echo "------------------------------------------------------------------------------"
echo "[Test] Services - Device"
echo "------------------------------------------------------------------------------"
cd $source_dir/services/api/device
npm install
npm test

echo "------------------------------------------------------------------------------"
echo "[Test] Services - JITR"
echo "------------------------------------------------------------------------------"
cd $source_dir/services/jitr
npm install
npm test

echo "------------------------------------------------------------------------------"
echo "[Test] Services - Message Proxy"
echo "------------------------------------------------------------------------------"
cd $source_dir/services/event-proxy
npm install
npm test

echo "------------------------------------------------------------------------------"
echo "[Test] Services - Notification"
echo "------------------------------------------------------------------------------"
cd $source_dir/services/notification
npm install
npm test

echo "------------------------------------------------------------------------------"
echo "[Test] Services - Telemetry"
echo "------------------------------------------------------------------------------"
cd $source_dir/services/telemetry
npm install
npm test

echo "------------------------------------------------------------------------------"
echo "[Test] Services - Command Status"
echo "------------------------------------------------------------------------------"
cd $source_dir/services/command-status
npm install
npm test

echo "------------------------------------------------------------------------------"
echo "[Test] Resources - Helper"
echo "------------------------------------------------------------------------------"
cd $source_dir/resources/helper
npm install
npm test

echo "------------------------------------------------------------------------------"
echo "[Test] Resources - Cognito"
echo "------------------------------------------------------------------------------"
cd $source_dir/resources/cognito
npm install
npm test
