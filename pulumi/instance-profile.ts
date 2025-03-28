
import * as aws from "@pulumi/aws";

import { awsProvider, accountId } from './aws-provider';
import { nodeRole } from './node-role';

export const instanceProfile = new aws.iam.InstanceProfile(
    "ec2-instance-profile",
    {
        role: nodeRole.name,
    },
    { provider: awsProvider, }
);
