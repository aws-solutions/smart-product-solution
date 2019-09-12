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

const uuidv4 = require('uuid/v4');

export function generateName(prefix: string, maxlength: number): string {
  const nameSufix = `-${uuidv4().split("-").pop()}`;
  if (maxlength > nameSufix.length)
    return `${prefix}`.substring(0, maxlength - nameSufix.length) + nameSufix
  else
    return `${nameSufix}`.substring(0, maxlength)
}