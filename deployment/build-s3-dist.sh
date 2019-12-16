#!/bin/bash
#
# This assumes all of the OS-level configuration has been completed and git repo has already been cloned
#
# This script should be run from the repo's deployment directory
# cd deployment
# ./build-s3-dist.sh source-bucket-base-name trademarked-solution-name version-code
#
# Paramenters:
#  - source-bucket-base-name: Name for the S3 bucket location where the template will source the Lambda
#    code from. The template will append '-[region_name]' to this bucket name.
#    For example: ./build-s3-dist.sh solutions my-solution v1.0.0
#    The template will then expect the source code to be located in the solutions-[region_name] bucket
#
#  - trademarked-solution-name: name of the solution for consistency
#
#  - version-code: version of the package

# Check to see if input has been provided:
if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
    echo "Please provide the base source bucket name, trademark approved solution name and version where the lambda code will eventually reside."
    echo "For example: ./build-s3-dist.sh solutions trademarked-solution-name v1.0.0"
    exit 1
fi

# Get reference for all important folders
template_dir="$PWD"
template_dist_dir="$template_dir/global-s3-assets"
build_dist_dir="$template_dir/regional-s3-assets"
source_dir="$template_dir/../source"

echo "------------------------------------------------------------------------------"
echo "[Init] Clean old dist folders"
echo "------------------------------------------------------------------------------"
echo "rm -rf $template_dist_dir"
rm -rf $template_dist_dir
echo "mkdir -p $template_dist_dir"
mkdir -p $template_dist_dir
echo "rm -rf $build_dist_dir"
rm -rf $build_dist_dir
echo "mkdir -p $build_dist_dir"
mkdir -p $build_dist_dir

echo "------------------------------------------------------------------------------"
echo "[Packing] Templates"
echo "------------------------------------------------------------------------------"
echo "cp $template_dir/smart-product-solution.yaml $template_dist_dir/smart-product-solution.template"
cp $template_dir/smart-product-solution.yaml $template_dist_dir/smart-product-solution.template

if [[ "$OSTYPE" == "darwin"* ]]; then
    # Mac OS
    echo "Updating code source bucket in template with $1"
    replace="s/%%BUCKET_NAME%%/$1/g"
    echo "sed -i '' -e $replace $template_dist_dir/smart-product-solution.template"
    sed -i '' -e $replace $template_dist_dir/smart-product-solution.template
    replace="s/%%SOLUTION_NAME%%/$2/g"
    echo "sed -i '' -e $replace $template_dist_dir/smart-product-solution.template"
    sed -i '' -e $replace $template_dist_dir/smart-product-solution.template
    replace="s/%%VERSION%%/$3/g"
    echo "sed -i '' -e $replace $template_dist_dir/smart-product-solution.template"
    sed -i '' -e $replace $template_dist_dir/smart-product-solution.template
else
    # Other linux
    echo "Updating code source bucket in template with $1"
    replace="s/%%BUCKET_NAME%%/$1/g"
    echo "sed -i -e $replace $template_dist_dir/smart-product-solution.template"
    sed -i -e $replace $template_dist_dir/smart-product-solution.template
    replace="s/%%SOLUTION_NAME%%/$2/g"
    echo "sed -i -e $replace $template_dist_dir/smart-product-solution.template"
    sed -i -e $replace $template_dist_dir/smart-product-solution.template
    replace="s/%%VERSION%%/$3/g"
    echo "sed -i -e $replace $template_dist_dir/smart-product-solution.template"
    sed -i -e $replace $template_dist_dir/smart-product-solution.template
fi

echo "------------------------------------------------------------------------------"
echo "[Rebuild] Console"
echo "------------------------------------------------------------------------------"
# build and copy console distribution files
cd $source_dir/console
rm -rf ./build
npm install
npm run build
mkdir $build_dist_dir/console
cp -r ./build/* $build_dist_dir/console

echo "------------------------------------------------------------------------------"
echo "[Rebuild] Resources - Authorizer"
echo "------------------------------------------------------------------------------"
cd $source_dir/resources/authorizer
npm run build

echo "------------------------------------------------------------------------------"
echo "[Rebuild] Resources - Logger"
echo "------------------------------------------------------------------------------"
cd $source_dir/resources/logger
npm run build

echo "------------------------------------------------------------------------------"
echo "[Rebuild] Resources - Metrics"
echo "------------------------------------------------------------------------------"
cd $source_dir/resources/metrics
npm run build

echo "------------------------------------------------------------------------------"
echo "[Rebuild] Resources - Utils"
echo "------------------------------------------------------------------------------"
cd $source_dir/resources/utils
npm run build

echo "------------------------------------------------------------------------------"
echo "[Rebuild] Resource - Custom Helper"
echo "------------------------------------------------------------------------------"
cd $source_dir/resources/helper
npm run build
cp ./dist/smart-product-helper.zip $build_dist_dir/smart-product-helper.zip

echo "------------------------------------------------------------------------------"
echo "[Rebuild] Resource - Cognito Helper"
echo "------------------------------------------------------------------------------"
cd $source_dir/resources/cognito
npm run build
cp ./dist/smart-product-cognito.zip $build_dist_dir/smart-product-cognito.zip

echo "------------------------------------------------------------------------------"
echo "[Rebuild] Resources - CICD Helper"
echo "------------------------------------------------------------------------------"
cd $source_dir/resources/cicd
npm run build
cp ./dist/smart-product-cicd.zip $build_dist_dir/smart-product-cicd.zip

echo "------------------------------------------------------------------------------"
echo "[Rebuild] Services - Admin"
echo "------------------------------------------------------------------------------"
cd $source_dir/services/api/admin
npm run build
cp ./dist/smart-product-admin-service.zip $build_dist_dir/smart-product-admin-service.zip

echo "------------------------------------------------------------------------------"
echo "[Rebuild] Services - Command"
echo "------------------------------------------------------------------------------"
cd $source_dir/services/api/command
npm run build
cp ./dist/smart-product-command-service.zip $build_dist_dir/smart-product-command-service.zip

echo "------------------------------------------------------------------------------"
echo "[Rebuild] Services - Event"
echo "------------------------------------------------------------------------------"
cd $source_dir/services/api/event
npm run build
cp ./dist/smart-product-event-service.zip $build_dist_dir/smart-product-event-service.zip

echo "------------------------------------------------------------------------------"
echo "[Rebuild] Services - Registration"
echo "------------------------------------------------------------------------------"
cd $source_dir/services/api/registration
npm run build
cp ./dist/smart-product-registration-service.zip $build_dist_dir/smart-product-registration-service.zip

echo "------------------------------------------------------------------------------"
echo "[Rebuild] Services - Status"
echo "------------------------------------------------------------------------------"
cd $source_dir/services/api/status
npm run build
cp ./dist/smart-product-status-service.zip $build_dist_dir/smart-product-status-service.zip

echo "------------------------------------------------------------------------------"
echo "[Rebuild] Services - Device"
echo "------------------------------------------------------------------------------"
cd $source_dir/services/api/device
npm run build
cp ./dist/smart-product-device-service.zip $build_dist_dir/smart-product-device-service.zip

echo "------------------------------------------------------------------------------"
echo "[Rebuild] Services - JITR"
echo "------------------------------------------------------------------------------"
cd $source_dir/services/jitr
npm run build
cp ./dist/smart-product-jitr-service.zip $build_dist_dir/smart-product-jitr-service.zip

echo "------------------------------------------------------------------------------"
echo "[Rebuild] Services - Event Proxy"
echo "------------------------------------------------------------------------------"
cd $source_dir/services/event-proxy
npm run build
cp ./dist/smart-product-event-proxy.zip $build_dist_dir/smart-product-event-proxy.zip

echo "------------------------------------------------------------------------------"
echo "[Rebuild] Services - Command Status"
echo "------------------------------------------------------------------------------"
cd $source_dir/services/command-status
npm run build
cp ./dist/smart-product-command-status.zip $build_dist_dir/smart-product-command-status.zip

echo "------------------------------------------------------------------------------"
echo "[Rebuild] Services - Notification"
echo "------------------------------------------------------------------------------"
cd $source_dir/services/notification
npm run build
cp ./dist/smart-product-notification-service.zip $build_dist_dir/smart-product-notification-service.zip

echo "------------------------------------------------------------------------------"
echo "[Rebuild] Services - Telemetry"
echo "------------------------------------------------------------------------------"
cd $source_dir/services/telemetry
npm run build
cp ./dist/smart-product-telemetry-service.zip $build_dist_dir/smart-product-telemetry-service.zip

echo "------------------------------------------------------------------------------"
echo "[Manifest] Generating console manifest"
echo "------------------------------------------------------------------------------"
cd $template_dir/manifest-generator
npm install --production
node app.js --target $build_dist_dir/console --output $build_dist_dir/site-manifest.json
