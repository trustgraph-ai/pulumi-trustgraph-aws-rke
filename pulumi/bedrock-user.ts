
// Create an IAM user for the EBS CSI driver

import * as aws from "@pulumi/aws";

import { awsProvider } from './aws-provider';
import { prefix } from './config';

export const aiUser = new aws.iam.User(
    "ai-user",
    {
        name: prefix + "-ai-user",
        path: "/",
    },
    { provider: awsProvider, }
);

// Add bedrock
new aws.iam.UserPolicyAttachment(
    "ai-role-policy-attachment-1",
    {
        user: aiUser.name,
        policyArn: "arn:aws:iam::aws:policy/AmazonBedrockFullAccess",
    },
    { provider: awsProvider, }
);

export const aiAccessKey = new aws.iam.AccessKey(
    "ai-access-key",
    {
        user: aiUser.name,
    },
    { provider: awsProvider, }
);
