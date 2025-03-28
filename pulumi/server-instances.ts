
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

import { prefix, region } from './config';
import { nodeType, volumeSize } from './config';
import { ami } from './config';
import { awsProvider, accountId } from './aws-provider';
import { serverTemplate } from './templates';
import { serverInterface } from './interfaces';
import { serverAddress } from './addresses';
import { keypair } from './keypair';
import { clusterToken } from './cluster-token';
import { instanceProfile } from './instance-profile';

const serverUserData = pulumi.all(
    [serverAddress.publicIp, serverInterface.privateIp, clusterToken.result]
).apply(
    ([external, internal, token]) => {
        if (external == undefined) {
            console.log("AWS EIP has no IP address!");
            return "";
        }
        if (internal == undefined) {
            console.log("AWS EIP has no IP address!");
            return "";
        }
        return btoa(
            serverTemplate.
                replace("%INTERNAL-ADDR%", internal).
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
        networkInterfaces: [
            {
                deviceIndex: 0,
                networkInterfaceId: serverInterface.id,
                deleteOnTermination: false,
            }
        ],
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
        userData: serverUserData,
        userDataReplaceOnChange: true,
    },
    { provider: awsProvider, }
);

