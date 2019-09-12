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

// Utils class for reducing redundant code
class CommonUtils {
  constructor() {

  }

  /**
   * Generates DynamoDB query parameter.
   * @param {string} tableName - table name
   * @param {string} keyConditionExpression - key condition expression 
   * @param {JSON} expressionAttributeValues - expression attribute values
   * @param {JSON} expressionAttributeNames - expression attribute names
   * @param {string} filterExpression - filter expression
   * @param {string} indexName - index name
   * @param {boolean} scanIndexForward - scan index forward
   * @param {JSON|string} lastevalkey - last evaluated key
   * @param {string} projectionExpression - projection expression
   * @param {Number} limit - limit
   */
  generateDynamoDBQueryParams(tableName, keyConditionExpression, expressionAttributeValues, 
    expressionAttributeNames, filterExpression, indexName, scanIndexForward, lastevalkey,
    projectionExpression, limit) {
    let params = {
      TableName: tableName,
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      Limit: 50,
    };

    if (indexName) {
      params.IndexName = indexName;
    }

    if (scanIndexForward !== undefined) {
      params.ScanIndexForward = scanIndexForward
    }

    if (expressionAttributeNames) {
      params.ExpressionAttributeNames = expressionAttributeNames;
    }

    if (filterExpression) {
      params.FilterExpression = filterExpression;
    }

    if (projectionExpression) {
      params.ProjectionExpression = projectionExpression;
    }

    if (limit) {
      params.Limit = limit;
    }

    if (lastevalkey) {
      // If the LastEvaluatedKey is from the UI, parse the string to JSON object.
      if (typeof lastevalkey === 'string') {
        if (lastevalkey !== 'null') {
          params.ExclusiveStartKey = JSON.parse(decodeURIComponent(lastevalkey));
        }
      } else {
        if (lastevalkey !== null) {
          params.ExclusiveStartKey = lastevalkey;
        }
      }
    }

    return params;
  }
}

module.exports = CommonUtils;
