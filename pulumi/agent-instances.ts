
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

import { prefix, region } from './config';
import { nodeType, agentNodeCount, volumeSize } from './config';
import { serverPrivateIp, agentPrivateIps } from './config';
import { ami } from './config';
import { awsProvider } from './aws-provider';
import { agentTemplate } from './templates';
import { agentAddresses } from './addresses';
import { keypair } from './keypair';
import { clusterToken } from './cluster-token';
import { instanceProfile } from './instance-profile';
import { serverInstance } from './server-instances';
import { subnet1 } from './vpc';
import { agentSecGroup, nodeToNodeSecGroup } from './security-groups';

export const agentInstances = Array.from(Array(agentNodeCount).keys()).map(
    ix => {

        const userData = pulumi.all([
            clusterToken.result
        ]).apply(
            ([token]) => {
                return btoa(
                    agentTemplate.
                        replace("%SERVER-ADDR%", serverPrivateIp).
                        replace("%INTERNAL-ADDR%", agentPrivateIps[ix]).
                        replace("%TOKEN%", token)
                )
            }
        );

        const instance = new aws.ec2.Instance(
            `ec2-agent-instance-${ix}`,
            {
                ami: ami,
                availabilityZone: region + "a",
                instanceType: nodeType,
                keyName: keypair.keyName,
                subnetId: subnet1.id,
                vpcSecurityGroupIds: [agentSecGroup.id, nodeToNodeSecGroup.id],
                privateIp: agentPrivateIps[ix],
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
                userDataBase64: userData,
                userDataReplaceOnChange: true,
            },
            {
                provider: awsProvider,
                dependsOn: [serverInstance]
            }
        );

        // Associate EIP with the agent instance
        new aws.ec2.EipAssociation(
            `association-agent-${ix}`,
            {
                allocationId: agentAddresses[ix].id,
                instanceId: instance.id,
            },
            { provider: awsProvider }
        );

        return instance;
    }
);
