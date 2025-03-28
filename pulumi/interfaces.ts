
import * as aws from "@pulumi/aws";

import { awsProvider } from './aws-provider';
import { addresses } from './addresses';
import { nodeCount } from './config';
import { subnet1 } from './vpc';
import { secGroup } from './security-groups';

export const interfaces = Array.from(Array(nodeCount).keys()).map(
    ix => new aws.ec2.NetworkInterface(
        `network-interface-${ix}`,
        {
            subnetId: subnet1.id,
            securityGroups: [ secGroup.id ],
        },
        { provider: awsProvider }
    )
);

Array.from(Array(nodeCount).keys()).map(
    ix => new aws.ec2.EipAssociation(
        `assocation-${ix}`,
        {
            allocationId: addresses[ix].id,
            networkInterfaceId: interfaces[ix].id,
        },
        { provider: awsProvider }
    )
);
