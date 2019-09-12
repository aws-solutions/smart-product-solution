/*********************************************************************************************************************
 *  Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
 *                                                                                                                    *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/LICENSE-2.0                                                                    *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/

/**
 * @author Solution Builders
 */

'use strict';

let AWS = require('aws-sdk');
const fs = require('fs');
const Logger = require('logger');

/**
 * Helper function to interact with AWS S3 for cfn custom resource.
 *
 * @class s3Helper
 */
class s3Helper {
  /**
   * @class s3Helper
   * @constructor
   */
  constructor() {
    this.creds = new AWS.EnvironmentCredentials('AWS'); // Lambda provided credentials
    this.downloadLocation = '/tmp/manifest.json';
  }

  /**
   * putConfigFile
   * Saves a JSON config file to S3 location.
   * @param {JSON} content -  JSON object.
   * @param {JSON} destS3Bucket -  S3 destination bucket.
   * @param {JSON} destS3key -  S3 destination key.
   */
  putConfigFile(content, destS3Bucket, destS3key) {
    // Handling Promise Rejection
    process.on('unhandledRejection', error => {
      throw error;
    });


    Logger.log(
      Logger.levels.ROBUST,
      `Attempting to save content blob destination location: ${destS3Bucket}/${destS3key}`
    );
    Logger.log(
      Logger.levels.ROBUST,
      `${JSON.stringify(content)}`
    );

    return new Promise((resolve, reject) => {
      let _content = `'use strict';

      const smart_product_config = {
        "aws_project_region": "${content.region}",
        "aws_user_pools_id": "${content.aws_user_pools_id}",
        "aws_user_pools_web_client_id": "${content.aws_user_pools_web_client_id}",
        "oauth": {},
        "aws_cloud_logic_custom": [
          {
            "name": "smart-product-api",
            "endpoint": "${content.endpoint}",
            "region": "${content.region}"
          }
        ]
      };`

      let params = {
        Bucket: destS3Bucket,
        Key: destS3key,
        Body: _content,
      };

      let s3 = new AWS.S3();
      s3.putObject(params, function (err, data) {
        if (err) {
          Logger.error(
            Logger.levels.INFO,
            `${err}`
          );
          reject(
            `Error creating ${destS3Bucket}/${destS3key} content \n${err}`
          );
        } else {
          Logger.log(
            Logger.levels.INFO,
            `${data}`
          );
          resolve(data);
        }
      });
    });
  }

  copyAssets(manifestKey, sourceS3Bucket, sourceS3prefix, destS3Bucket) {
    // Handling Promise Rejection
    process.on('unhandledRejection', error => {
      throw error;
    });

    Logger.log(
      Logger.levels.ROBUST,
      `manifest key: ${manifestKey} \n source bucket: ${sourceS3Bucket} \n source prefix: ${sourceS3prefix} \n destination bucket: ${destS3Bucket}`
    );

    let _self = this;
    return new Promise((resolve, reject) => {
      this._downloadManifest(sourceS3Bucket, manifestKey)
        .then(data => {
          fs.readFile(_self.downloadLocation, 'utf8', function (err, data) {
            if (err) {
              Logger.error(
                Logger.levels.INFO,
                `${err}`
              );
              reject(err);
            }

            let _manifest = _self._validateJSON(data);

            if (!_manifest) {
              reject('Unable to validate downloaded manifest file JSON');
            } else {
              _self
                ._uploadFile(
                  _manifest.files,
                  0,
                  destS3Bucket,
                  `${sourceS3Bucket}/${sourceS3prefix}`
                )
                .then(resp => {
                  Logger.log(
                    Logger.levels.ROBUST,
                    `${resp}`
                  );
                  resolve(resp);
                })
                .catch(err => {
                  Logger.error(
                    Logger.levels.INFO,
                    `${err}`
                  );
                  reject(err);
                });
            }
          });
        })
        .catch(err => {
          Logger.error(
            Logger.levels.INFO,
            `${err}`
          );
          reject(err);
        });
    });
  }

  /**
   * Helper function to validate the JSON structure of contents of an import manifest file.
   * @param {string} body -  JSON object stringify-ed.
   * @returns {JSON} - The JSON parsed string or null if string parsing failed
   */
  _validateJSON(body) {
    try {
      let data = JSON.parse(body);
      Logger.log(
        Logger.levels.ROBUST,
        `${data}`
      );
      return data;
    } catch (e) {
      // failed to parse
      Logger.error(
        Logger.levels.INFO,
        'Manifest file contains invalid JSON.'
      );
      return null;
    }
  }

  _uploadFile(filelist, index, destS3Bucket, sourceS3prefix) {
    let _self = this;
    return new Promise((resolve, reject) => {
      if (filelist.length > index) {
        let params = {
          Bucket: destS3Bucket,
          Key: filelist[index],
          CopySource: [sourceS3prefix, filelist[index]].join('/'),
          MetadataDirective: 'REPLACE',
        };

        params.ContentType = this._setContentType(filelist[index]);
        params.Metadata = {
          'Content-Type': params.ContentType,
        };
        Logger.log(
          Logger.levels.ROBUST,
          `${params}`
        );
        let s3 = new AWS.S3();
        s3.copyObject(params, function (err, data) {
          if (err) {
            Logger.error(
              Logger.levels.INFO,
              `${params}`
            );
            reject(
              `error copying ${sourceS3prefix}/${filelist[index]}\n${err}`
            );
          } else {
            Logger.log(
              Logger.levels.ROBUST,
              `${sourceS3prefix}/${filelist[index]} uploaded successfully`
            );
            let _next = index + 1;
            _self
              ._uploadFile(filelist, _next, destS3Bucket, sourceS3prefix)
              .then(resp => {
                resolve(resp);
              })
              .catch(err2 => {
                reject(err2);
              });
          }
        });
      } else {
        resolve(`${index} files copied`);
      }
    });
  }

  /**
   * Helper function to download a manifest to local storage for processing.
   * @param {string} s3Bucket -  Amazon S3 bucket of the manifest to download.
   * @param {string} s3Key - Amazon S3 key of the manifest to download.
   * @param {string} downloadLocation - Local storage location to download the Amazon S3 object.
   */
  _downloadManifest(s3Bucket, s3Key) {
    let _self = this;
    return new Promise((resolve, reject) => {
      let params = {
        Bucket: s3Bucket,
        Key: s3Key,
      };

      Logger.log(
        Logger.levels.ROBUST,
        `Attempting to download manifest: ${JSON.stringify(params)}`
      );

      // check to see if the manifest file exists
      let s3 = new AWS.S3();
      s3.headObject(params, function (err, metadata) {
        if (err) {
          Logger.error(
            Logger.levels.INFO,
            `${err}`
          );
          // Handle no object on cloud here
          if (err.code === 'NotFound') {
            Logger.error(
              Logger.levels.INFO,
              `manifest file doesn't exist`
            );
            reject('Manifest file was not found.');
          } else {
            reject(err);
          }
        } else {
          Logger.log(
            Logger.levels.ROBUST,
            `manifest file doesn't exist`
          );
          Logger.log(
            Logger.levels.ROBUST,
            `${metadata}`
          );
          let file = require('fs').createWriteStream(_self.downloadLocation);

          s3.getObject(params)
            .on('httpData', function (chunk) {
              file.write(chunk);
            })
            .on('httpDone', function () {
              file.end();
              Logger.log(
                Logger.levels.ROBUST,
                `manifest downloaded for processing...`
              );
              resolve('success');
            })
            .send();
        }
      });
    });
  }

  _setContentType(file) {
    let _contentType = 'binary/octet-stream';
    if (file.endsWith('.html')) {
      _contentType = 'text/html';
    } else if (file.endsWith('.css')) {
      _contentType = 'text/css';
    } else if (file.endsWith('.png')) {
      _contentType = 'image/png';
    } else if (file.endsWith('.svg')) {
      _contentType = 'image/svg+xml';
    } else if (file.endsWith('.jpg')) {
      _contentType = 'image/jpeg';
    } else if (file.endsWith('.js')) {
      _contentType = 'application/javascript';
    }

    return _contentType;
  }
}

module.exports = s3Helper;
