
import * as aws from "@pulumi/aws";

import { awsProvider } from './aws-provider';
import { prefix } from './config';
import { agentNodeCount } from './config';

export const serverAddress = new aws.ec2.Eip(
    "server-address",
    {
        tags: {
            Name: `${prefix}-server`,
        }
    },
    { provider: awsProvider }
);

export const agentAddresses = Array.from(Array(agentNodeCount).keys()).map(
    ix => new aws.ec2.Eip(
        `address-${ix}`,
        {
            tags: {
                Name: `${prefix}-agent-${ix}`,
            }
        },
        { provider: awsProvider }
    )
);
