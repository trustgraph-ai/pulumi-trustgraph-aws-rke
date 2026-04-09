
import * as aws from "@pulumi/aws";

import { prefix } from './config';
import { awsProvider } from './aws-provider';

// Create a node IAM role

// Create an RKE cluster node role
export const nodeRole = new aws.iam.Role(
    "node-role",
    {
        name: "rkeNodeRole-" + prefix,
        assumeRolePolicy: JSON.stringify({
            Version: "2012-10-17",
            Statement: [
                {
                    Effect: "Allow",
                    Principal: {
                        Service: "ec2.amazonaws.com",
                    },
                    Action: "sts:AssumeRole",
                }
            ],
        }),
    },
    { provider: awsProvider }
);

new aws.iam.RolePolicyAttachment(
    "cluster-role-policy-attachment-1",
    {
        role: nodeRole.name,
        policyArn: "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy",
    },
    { provider: awsProvider }
);
