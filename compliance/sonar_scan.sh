#!/bin/bash

npx sonar-scanner \
  -Dsonar.projectKey=sonar-cloudvoyager \
  -Dsonar.projectName="CloudVoyager" \
  -Dsonar.host.url=http://localhost:9000 \
  -Dsonar.sources=. \
  -Dsonar.token="${SONAR_TOKEN:?Set SONAR_TOKEN environment variable}" \
  -Dsonar.branch.name=main \
  -Dsonar.javaOpts=-Xmx8192m \
  -Dsonar.scanner.debug=true \
  -X