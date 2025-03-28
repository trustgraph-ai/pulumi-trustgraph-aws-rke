
import * as aws from "@pulumi/aws";

import { awsProvider } from './aws-provider';
import { prefix } from './config';
import { vpc } from './vpc';

// Security group for servers
export const serverSecGroup = new aws.ec2.SecurityGroup(
    "server-security-group",
    {
        vpcId: vpc.id,
        description: "RKE2 servers",
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
            "Name": prefix + "-server",
        }
    },
    { provider: awsProvider }
);

// Security group for agents
export const agentSecGroup = new aws.ec2.SecurityGroup(
    "agent-security-group",
    {
        vpcId: vpc.id,
        description: "RKE2 servers",
        ingress: [
            // SSH
            {
                protocol: 'tcp',
                fromPort: 22,
                toPort: 22,
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
            "Name": prefix + "-agent",
        }
    },
    { provider: awsProvider }
);

// Security group
export const nodeToNodeSecGroup = new aws.ec2.SecurityGroup(
    "node-to-node-security-group",
    {
        vpcId: vpc.id,
        description: "Enables access to EC2",
        ingress: [
            // RKE2 supervisor API
            {
                protocol: 'tcp',
                fromPort: 9345,
                toPort: 9345,
                cidrBlocks: [ "0.0.0.0/0" ],
                securityGroups: [serverSecGroup.id, agentSecGroup.id],
            },
            // kubelet metrics
            {
                protocol: 'tcp',
                fromPort: 10250,
                toPort: 10250,
                cidrBlocks: [ "0.0.0.0/0" ],
                securityGroups: [serverSecGroup.id, agentSecGroup.id],
            },
            // etcd client
            {
                protocol: 'tcp',
                fromPort: 2379,
                toPort: 2379,
                cidrBlocks: [ "0.0.0.0/0" ],
                securityGroups: [serverSecGroup.id],
            },
            // etcd peer port
            {
                protocol: 'tcp',
                fromPort: 2380,
                toPort: 2380,
                cidrBlocks: [ "0.0.0.0/0" ],
                securityGroups: [serverSecGroup.id],
            },
            // etcd metrics port
            {
                protocol: 'tcp',
                fromPort: 2381,
                toPort: 2381,
                cidrBlocks: [ "0.0.0.0/0" ],
                securityGroups: [serverSecGroup.id],
            },
            // NodePort range
            {
                protocol: 'tcp',
                fromPort: 30000,
                toPort: 32767,
                cidrBlocks: [ "0.0.0.0/0" ],
                securityGroups: [serverSecGroup.id, agentSecGroup.id],
            },
            // Canal
            {
                protocol: 'udp',
                fromPort: 8472,
                toPort: 8472,
                cidrBlocks: [ "0.0.0.0/0" ],
                securityGroups: [serverSecGroup.id, agentSecGroup.id],
            },
            {
                protocol: 'tcp',
                fromPort: 9099,
                toPort: 9099,
                cidrBlocks: [ "0.0.0.0/0" ],
                securityGroups: [serverSecGroup.id, agentSecGroup.id],
            },
        ],
        egress: [
        ],
        tags: {
            "Name": prefix + "-node-to-node",
        }
    },
    { provider: awsProvider }
);

