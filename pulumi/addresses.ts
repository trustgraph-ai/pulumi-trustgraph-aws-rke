
import * as aws from "@pulumi/aws";

import { awsProvider } from './aws-provider';
import { prefix } from './config';
import { nodeCount } from './config';

export const addresses = Array.from(Array(nodeCount).keys()).map(
    ix => new aws.ec2.Eip(
        `address-${ix}`,
        {
            tags: {
                Name: `${prefix}-node-${ix}`,
            }
        },
        { provider: awsProvider }
    )
);
