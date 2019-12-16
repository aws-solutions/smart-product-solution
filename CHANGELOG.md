# Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2019-12-16
### Updated
- Update Node.JS version from 8 to 12
- Update CDK dependency version to 1.18.0
- Add adm-zip on CI/CD helper Lambda function to work on Node.JS 12.x platform
- Update custom resource helper: ```then().catch()``` to ```async/await```.
- Remove ```\n``` from README
- Update device microservice unit tests
- Remove ```finally``` statement from all unit tests
- Update console package version to fix vulnerability
- Add try/catch for sending anonymous data
- Add API Gateway access logging configuration

## [1.0.0] - 2019-09-12
### Added
- Smart Product Solution release