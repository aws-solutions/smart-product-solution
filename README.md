## Smart Product Solution
Smart, connected products are completely transforming the value chain. As a result, companies are redefining their industries and rethinking nearly everything they do. The ability for smart products to monitor themselves, their environments and enable remote control, optimization, and automation allows manufacturers to think about their business in new ways. Freshly available features and functions can be delivered directly to their products and users to improve revenue and margins.

Smart, connected products have many of the same physical components that products have always had, but also have new features that make them more intelligent. They are embedded with sensors that enable communication and data transfer between the product and the web-enabled systems of the maker of the product, as well as the user of the product. These sensors collect information on a product’s environment and various interfaces now enable users to control products. To support this evolution, a new technology stack is needed to enable smart, smart products.

The Smart Product Solution is a deployable reference architecture demonstrating the "art of the possible" and enabling manufactures to jumpstart development of innovative smart product services. Using the Smart Product Solution, manufactures can rapidly deploy and build upon an open source architecture to enable smart product applications by converting valuable information from the real world into digital data that provides increased visibility to businesses of how users interact their products or services.

For more information and a detailed deployment guide visit the Smart Product solution [here](https://aws.amazon.com/solutions/implementations/smart-product-solution/).

## Running unit tests for customization
* Clone the repository, then make the desired code changes
* Next, run unit tests to make sure added customization passes the tests
```
cd ./deployment
chmod +x ./run-unit-tests.sh
./run-unit-tests.sh
```

## Building distributable for customization
* Configure the bucket name of your target Amazon S3 distribution bucket
```
export DIST_OUTPUT_BUCKET=my-bucket-name # bucket where customized code will reside
export VERSION=my-version # version number for the customized code
export SOLUTION_NAME=my-smart-solution # user defined solution's name
```
_Note:_ You would have to create an S3 bucket with the prefix 'my-bucket-name-<aws_region>'; aws_region is where you are testing the customized solution. Also, the assets in bucket should be publicly accessible.

* Now build the distributable:
```
chmod +x ./build-s3-dist.sh
./build-s3-dist.sh $DIST_OUTPUT_BUCKET $SOLUTION_NAME $$VERSION
```

* Deploy the distributable to an Amazon S3 bucket in your account. _Note:_ you must have the AWS Command Line Interface installed.
```
aws s3 cp ./global-s3-assets/ s3://my-bucket-name-<aws_region>/smart-product-solution/<my-version>/ --recursive --acl bucket-owner-full-control --profile aws-cred-profile-name
aws s3 cp ./regional-s3-assets/ s3://my-bucket-name-<aws_region>/smart-product-solution/<my-version>/ --recursive --acl bucket-owner-full-control --profile aws-cred-profile-name
```

* Get the link of the smart-product-solution.template uploaded to your Amazon S3 bucket.
* Deploy the Smart Product solution to your account by launching a new AWS CloudFormation stack using the link of the smart-product-solution.template.

## File Structure
The Smart Product solution consists of a management and owner console, IoT integrations and API microservices that facilitate the functional areas of the solution.

```
|-deployment/
  |-custom-deployment            [ Custom deployment CDK source directory ]
    |-bin/                       [ Custom deployment entrypoint of the CDK application ]
    |-lib/                       [ custom deployment CDK application's stacks ]
  |-build-s3-dist.sh             [ shell script for packaging distribution assets ]
  |-run-unit-tests.sh            [ shell script for executing unit tests ]
  |-smart-product-solution.yaml  [ solution CloudFormation deployment template ]
|-source/
  |-console/
    |-src/
  |-resources/
    |-authorizer                 [ Authorizer is a local package to create authentication and authorization claim ticket for solution services ]
    |-cognito                    [ Cognito is a Cognito trigger Lambda handler ]
    |- helper                    [ Helper is the AWS CloudFormation custom resource for aiding in the deployment of the solution ]
      |- lib/                    [ Helper libraries ]
    |- logger                    [ Logger is an auxiliary logging local package for solution services ]
    |- usage-metrics             [ Usage Metrics is an auxiliary local package to capture anonymous metrics pertinent for feedback on the solution ]
    |- utils                     [ Utils is a common util for the solution services ]
  |-services/
    |- api
      |- admin                     [ Adminstration API microservice ]
        |-lib/                     [ Administration microservice libraries ]
      |- command                   [ Device command API microservice ]
        |-lib/                     [ Device command API microservice libraries ]
      |- device                    [ Device API microservice ]
        |-lib/                     [ Device API microservice libraries ]
      |- event                     [ Device event API microservice ]
        |-lib/                     [ Device event API microservice libraries ]
      |- registration              [ Device registration API microservice ]
        |-lib/                     [ Device registration API microservice libraries ]
      |- status                    [ Device status API microservice ]
        |-lib/                     [ Device status API microservice libraries ]
    |- command-status              [ Device command status microservice ]
        |-lib/                     [ Device command status microservice libraries ]
    |- event-proxy                 [ Device event proxy microservice ]
      |-lib/                       [ Device event proxy microservice libraries ]
    |- jitr                        [ Just in time registration microservice ]
    |- notification                [ Notification microservice ]
      |-lib/                       [ Notification microservice libraries ]
    |- telemetry                   [ Telemetry transformation microservice ]
      |-lib/                       [ Telemetry transformation microservice libraries ]
```

Each microservice follows the structure of:

```
|-service-name/
  |-lib/
    |-[service module libraries and unit tests]
  |-index.js [injection point for microservice]
  |-package.json
```

***

Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
