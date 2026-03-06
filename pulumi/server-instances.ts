
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

import { prefix, region } from './config';
import { nodeType, volumeSize, serverPrivateIp } from './config';
import { ami } from './config';
import { awsProvider } from './aws-provider';
import { serverTemplate } from './templates';
import { serverAddress } from './addresses';
import { keypair } from './keypair';
import { clusterToken } from './cluster-token';
import { instanceProfile } from './instance-profile';
import { subnet1 } from './vpc';
import { serverSecGroup, nodeToNodeSecGroup } from './security-groups';

const serverUserData = pulumi.all(
    [serverAddress.publicIp, clusterToken.result]
).apply(
    ([external, token]) => {
        if (external == undefined) {
            console.log("AWS EIP has no IP address!");
            return "";
        }
        return btoa(
            serverTemplate.
                replace("%INTERNAL-ADDR%", serverPrivateIp).
                replace("%EXTERNAL-ADDR%", external).
                replace("%TOKEN%", token)
        );
    }
);

export const serverInstance = new aws.ec2.Instance(
    "ec2-server-instance",
    {
        ami: ami,
        availabilityZone: region + "a",
        instanceType: nodeType,
        keyName: keypair.keyName,
        subnetId: subnet1.id,
        vpcSecurityGroupIds: [serverSecGroup.id, nodeToNodeSecGroup.id],
        privateIp: serverPrivateIp,
        iamInstanceProfile: instanceProfile.name,
        rootBlockDevice: {
            volumeSize: volumeSize,
            volumeType: "gp3",
            deleteOnTermination: true,
            encrypted: true,
            tags: {
                Name: prefix,
            },
        },
        metadataOptions: {
            httpEndpoint: 'enabled',
            httpPutResponseHopLimit: 2,
        },
        tags: {
            Name: `${prefix}-server`,
        },
        userDataBase64: serverUserData,
        userDataReplaceOnChange: true,
    },
    { provider: awsProvider, }
);

// Associate EIP with the server instance
new aws.ec2.EipAssociation(
    "association-server",
    {
        allocationId: serverAddress.id,
        instanceId: serverInstance.id,
    },
    { provider: awsProvider }
);
