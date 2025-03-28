
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

import { prefix, region } from './config';
import { nodeType, volumeSize } from './config';
import { ami } from './config';
import { awsProvider, accountId } from './aws-provider';
import { serverTemplate } from './templates';
import { interfaces } from './interfaces';
import { addresses } from './addresses';
import { keypair } from './keypair';
import { clusterToken } from './cluster-token';
import { instanceProfile } from './instance-profile';

const serverUserData = pulumi.all(
    [addresses[0].publicIp, clusterToken.result]
).apply(
    ([address, token]) => {
        if (address == undefined) {
            console.log("AWS EIP has no IP address!");
            return "";
        }
        return btoa(
            serverTemplate.
                replace("%MY-IP%", address).
                replace("%TOKEN%", token)
        );
    }
);

export const serverInstance = new aws.ec2.Instance(
    "ec2-instance-0",
    {
        ami: ami,
        availabilityZone: region + "a",
        instanceType: nodeType,
        keyName: keypair.keyName,
        networkInterfaces: [
            {
                deviceIndex: 0,
                networkInterfaceId: interfaces[0].id,
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
            Name: `${prefix}-node-0`,
        },
        userData: serverUserData,
        userDataReplaceOnChange: true,
    },
    { provider: awsProvider, }
);

