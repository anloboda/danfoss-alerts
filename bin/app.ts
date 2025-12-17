#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { DanfossAlertsStack } from "../lib/danfoss-alerts-stack";

const app = new cdk.App();
new DanfossAlertsStack(app, "DanfossAlertsStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || "us-east-1",
  },
  description: "Danfoss Floor Temperature Monitoring Service",
});

