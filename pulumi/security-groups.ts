
import * as aws from "@pulumi/aws";

import { awsProvider } from './aws-provider';
import { prefix } from './config';
import { vpc } from './vpc';

// Security group
export const secGroup = new aws.ec2.SecurityGroup(
    "security-group",
    {
        vpcId: vpc.id,
        description: "Enables access to EC2",
        ingress: [
            // SSH
            {
                protocol: 'tcp',
                fromPort: 22,
                toPort: 22,
                cidrBlocks: [ "0.0.0.0/0" ],
            },
            // Kubernetes API
            {
                protocol: 'tcp',
                fromPort: 6443,
                toPort: 6443,
                cidrBlocks: [ "0.0.0.0/0" ],
            },
            // RKE2 supervisor API
            {
                protocol: 'tcp',
                fromPort: 9345,
                toPort: 9345,
                cidrBlocks: [ "0.0.0.0/0" ],
            },
            // kubelet metrics
            {
                protocol: 'tcp',
                fromPort: 10250,
                toPort: 10250,
                cidrBlocks: [ "0.0.0.0/0" ],
            },
            // etcd client
            {
                protocol: 'tcp',
                fromPort: 2379,
                toPort: 2379,
                cidrBlocks: [ "0.0.0.0/0" ],
            },
            // etcd peer port
            {
                protocol: 'tcp',
                fromPort: 2380,
                toPort: 2380,
                cidrBlocks: [ "0.0.0.0/0" ],
            },
            // etcd metrics port
            {
                protocol: 'tcp',
                fromPort: 2381,
                toPort: 2381,
                cidrBlocks: [ "0.0.0.0/0" ],
            },
            {
                protocol: 'tcp',
                fromPort: 30000,
                toPort: 32767,
                cidrBlocks: [ "0.0.0.0/0" ],
            },
            // Canal
            {
                protocol: 'udp',
                fromPort: 8472,
                toPort: 8472,
                cidrBlocks: [ "0.0.0.0/0" ],
            },
            {
                protocol: 'tcp',
                fromPort: 9099,
                toPort: 9099,
                cidrBlocks: [ "0.0.0.0/0" ],
            },
        ],
        egress: [
            {
                protocol: "-1",
                fromPort: 0,
                toPort: 0,
                cidrBlocks: ['0.0.0.0/0'],
                ipv6CidrBlocks: ["::/0"],
            }
        ],
        tags: {
            "Name": prefix,
        }
    },
    { provider: awsProvider }
);
