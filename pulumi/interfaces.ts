
import * as aws from "@pulumi/aws";

import { awsProvider } from './aws-provider';
import { serverAddress, agentAddresses } from './addresses';
import { agentNodeCount } from './config';
import { subnet1 } from './vpc';
import { serverSecGroup, agentSecGroup } from './security-groups';
import { nodeToNodeSecGroup } from './security-groups';

export const serverInterface = new aws.ec2.NetworkInterface(
    `network-interface-server`,
    {
        subnetId: subnet1.id,
        securityGroups: [ serverSecGroup.id, nodeToNodeSecGroup.id ],
    },
    { provider: awsProvider }
);

export const agentInterfaces = Array.from(Array(agentNodeCount).keys()).map(
    ix => new aws.ec2.NetworkInterface(
        `network-interface-agent-${ix}`,
        {
            subnetId: subnet1.id,
            securityGroups: [ agentSecGroup.id, nodeToNodeSecGroup.id ],
        },
        { provider: awsProvider }
    )
);

new aws.ec2.EipAssociation(
    `assocation-server`,
    {
        allocationId: serverAddress.id,
        networkInterfaceId: serverInterface.id,
    },
    { provider: awsProvider }
);

Array.from(Array(agentNodeCount).keys()).map(
    ix => new aws.ec2.EipAssociation(
        `assocation-agent-${ix}`,
        {
            allocationId: agentAddresses[ix].id,
            networkInterfaceId: agentInterfaces[ix].id,
        },
        { provider: awsProvider }
    )
);
