
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

import { prefix, region } from './config';
import { nodeType, agentNodeCount, volumeSize } from './config';
import { ami } from './config';
import { awsProvider, accountId } from './aws-provider';
import { agentTemplate } from './templates';
import { agentInterfaces } from './interfaces';
import { agentAddresses, serverAddress } from './addresses';
import { keypair } from './keypair';
import { clusterToken } from './cluster-token';
import { instanceProfile } from './instance-profile';
import { serverInstance } from './server-instances';

export const agentInstances = Array.from(Array(agentNodeCount).keys()).map(
    ix => {

        const userData = pulumi.all([
            serverAddress.publicIp, agentAddresses[ix].publicIp,
            clusterToken.result
        ]).apply(
            ([server, me, token]) => {
                if (server === undefined) {
                    console.log("AWS EIP has no IP address!");
                    return "";
                }
                if (me === undefined) {
                    console.log("AWS EIP has no IP address!");
                    return "";
                }
                return btoa(
                    agentTemplate.
                        replace("%SERVER-IP%", server).
                        replace("%MY-IP%", me).
                        replace("%TOKEN%", token)
                )
            }
        );

        return new aws.ec2.Instance(
            `ec2-agent-instance-${ix}`,
            {
                ami: ami,
                availabilityZone: region + "a",
                instanceType: nodeType,
                keyName: keypair.keyName,
                networkInterfaces: [
                    {
                        deviceIndex: 0,
                        networkInterfaceId: agentInterfaces[ix].id,
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
                        Name: `${prefix}-node-${ix}`,
                    },
                },
                metadataOptions: {
                    httpEndpoint: 'enabled',
                    httpPutResponseHopLimit: 2,
                },
                tags: {
                    Name: `${prefix}-agent-${ix}`,
                },
                userData: userData,
                userDataReplaceOnChange: true,
            },
            {
                provider: awsProvider,
                dependsOn: [serverInstance]
            }
        )
    }
);

