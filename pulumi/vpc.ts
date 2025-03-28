// Create a VPC and subnets.  Public IPs allocated on the subnets.

import * as aws from "@pulumi/aws";
import { awsProvider } from './aws-provider';

import { prefix, vpcCidr, region, subnet1Cidr } from './config';

// Create a VPC
export const vpc = new aws.ec2.Vpc(
    "vpc",
    {
        cidrBlock: vpcCidr,
        enableDnsHostnames: true,
        enableDnsSupport: true,
        tags: {
            Name: prefix,
        },
    },
    { provider: awsProvider }
);

// Create Subnets
export const subnet1 = new aws.ec2.Subnet(
    "subnet-1", {
        vpcId: vpc.id,
        cidrBlock: subnet1Cidr,
        mapPublicIpOnLaunch: true,
        availabilityZone: region + "a",
        tags: {
            Name: prefix + "-subnet1",
        },
    },
    { provider: awsProvider }
);

const gateway = new aws.ec2.InternetGateway(
    "internet-gateway",
    {
        vpcId: vpc.id,
        tags: {
            "Name": prefix,
        },
    },
    { provider: awsProvider }
);

const routetable = new aws.ec2.RouteTable(
    "routetable",
    {
        routes: [
            {
                cidrBlock: "0.0.0.0/0",
                gatewayId: gateway.id,
            }
        ],
        vpcId: vpc.id,
        tags: {
            "Name": prefix,
        }
    },
    { provider: awsProvider }
);

const association = new aws.ec2.MainRouteTableAssociation(
    "routetable-association",
    {
        routeTableId: routetable.id,
        vpcId: vpc.id,
    },
    { provider: awsProvider }
);
